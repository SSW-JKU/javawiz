@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.asStringWithStackTrace
import at.jku.ssw.wsdebug.compilation.*
import at.jku.ssw.wsdebug.compilation.ast.CallFixup
import at.jku.ssw.wsdebug.debugger.Debugger
import at.jku.ssw.wsdebug.debugger.StartStepTask
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS
import at.jku.ssw.wsdebug.debugger.vm.jdi.JDIVirtualMachine
import at.jku.ssw.wsdebug.identEachLine
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.sun.source.util.JavacTask
import com.sun.tools.javac.tree.JCTree
import java.io.StringWriter
import java.nio.file.Paths
import javax.tools.ToolProvider

private var latestDebugger: Debugger? = null

internal fun exitLatestDebugger() {
    latestDebugger?.exit()
    latestDebugger = null
}

internal fun generateResponseFromString(message: String): Response {
    return try {
        val jsonWorker = jacksonObjectMapper()
        val request: Request = jsonWorker.readValue(message)

        generateResponse(request)
    } catch (ex: Exception) {
        println("  Could not convert message to request: ${ex.asStringWithStackTrace()}")
        ErrorResponse("Could not convert message to request: ${ex.message}", request = null)
    }
}

internal fun generateResponse(request: Request): Response {
    return try {
        println("  Request:\n" + request.toString().identEachLine(4))
        processRequest(request) ?: ErrorResponse("Could not process request", request)
    } catch (ex: Exception) {
        println("  Error while processing request: ${ex.asStringWithStackTrace()}")
        ErrorResponse("Error while processing request: ${ex.message}", request)
    } catch (e: Error) {
        println("  Error while processing request: ${e.stackTraceToString()}")
        ErrorResponse("Error while processing request: ${e.message}", request)
    }
}

private fun processRequest(request: Request): Response? {
    when (request) {
        is Compile -> {
            return handleCompileRequest(request)
        }

        is StepRequest -> {
            latestDebugger?.let { debugger ->
                return StepResultResponse(request, debugger.step(request.toDebuggerStepTask(debugger)))
            }
        }

        is Input -> {
            latestDebugger?.let { debugger ->
                // either continue the last uncompleted request, or if no uncompleted request exists make a single step into
                return InputResponse(request, debugger.inputAndContinueInterruptedStep(request.text))
            }
        }
    }
    return null
}

private fun handleCompileRequest(request: Compile): Response {
    exitLatestDebugger()
    val internalClassPatterns = (request.internalClassPatterns ?: INTERNAL_CLASS_PATTERNS) + "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS"
    val additionalSourcePaths = if (request.vscExtensionActive) {
        listOf(JAVAWIZ_PATH)
    } else {
        listOf(JAVAWIZ_PATH, "In.java", "Out.java", "Rand.java").filter { name -> request.classContents.none { it.localUri.endsWith(name) } }
    }

    val requestSourceFiles = request.classContents.map { FilepathAndContent(it.localUri, it.content.replace('\t', ' ')) }
    val additionalSourceCodes = additionalSourcePaths.map { name ->
        FilepathAndContent(
            name,
            request.let { it.javaClass.getResourceAsStream(BASE_RESOURCE_PATH + name)?.reader()?.readText() ?: "" },
        )
    }

    val sources = requestSourceFiles + additionalSourceCodes
    val sourceFiles = sources.map { FakeJavaSourceFile(it) }
    val javac = ToolProvider.getSystemJavaCompiler()
    val out = StringWriter()
    val task = javac.getTask(
        out, null, null, null, null, sourceFiles
    ) as JavacTask

    val trees = task.parse()
    task.analyze() // needed for filling the symbol table
    val (internalCompilationUnits, compilationUnits) = trees.filterIsInstance<JCTree.JCCompilationUnit>().partition { cu -> isInternal(cu, internalClassPatterns) }

    fun modifiedUri(parseInfo: ParseInfo) = if (request.vscExtensionActive) parseInfo.localUri else parseInfo.packageExtendedUri
    val unchangedFiles = internalCompilationUnits.map { unit ->
        val packageDot = if (unit.packageName == null) "" else (unit.packageName.toString() + ".")
        val prefix = if (request.vscExtensionActive) "" else packageDot.replace(".", "/")
        FilepathAndContent(
            prefix + unit.sourceFile.name,
            unit.sourceFile.getCharContent(true).toString()
        )
    }

    val callFixup = CallFixup()
    val parseInfos = compilationUnits.mapNotNull { computeParseInfos(it, callFixup) }
    callFixup.resolve(task.types)
    var mainParseInfo: ParseInfo? = null
    if(request.openEditorLocalUri != null) {
        mainParseInfo = parseInfos.find{ info -> info.localUri == request.openEditorLocalUri && info.mainClass != null}
    }
    if(mainParseInfo == null) {
        mainParseInfo = parseInfos.find { it.mainClass != null }
    }
    if (mainParseInfo == null) {
        val message = out.toString().ifEmpty {
            "Could not find main class"
        }
        return CompileFailResponse(request, message)
    }


    val modifiedSources = parseInfos.map {
        FilepathAndContent(modifiedUri(it), it.modifiedSource)
    }


    val mainUri = modifiedUri(mainParseInfo)
    val modifiedCompileResult = compile(
        mainUri,
        modifiedSources + unchangedFiles,
        additionalSourceCodes,
        useFileManager = true
    )

    if (!modifiedCompileResult.success) {
        val unmodifiedSources = parseInfos.map {
            FilepathAndContent(modifiedUri(it), it.source)
        }
        val unmodifiedCompileResult = compile(
            mainUri,
            unmodifiedSources + unchangedFiles,
            additionalSourceCodes,
            useFileManager = false
        )
        if (unmodifiedCompileResult.success) {
            throw Exception("Source code modification caused an unexpected compile error: " + modifiedCompileResult.compileOutput)
        }
        return CompileFailResponse(request, unmodifiedCompileResult.compileOutput)
    }
    latestDebugger = Debugger(
        JDIVirtualMachine(
            mainParseInfo.mainClass!!,
            Paths.get(COMPILATION_OUTPUT_DIR).toAbsolutePath().toString(),
            parseInfos,
            internalClassPatterns
        )
    )
    val firstStepResult = latestDebugger!!.step(StartStepTask())
    val warnings = generateWarnings(parseInfos)
    return CompileSuccessResponse(
        request,
        CompileSendData(
            modifiedCompileResult,
            firstStepResult,
            parseInfos.flatMap { it.typeNames },
            parseInfos.map { it.ast },
            warnings
        )
    )
}

private fun generateWarnings(parseInfos: List<ParseInfo>) = buildSet {
    parseInfos.filter { it.featureWarnings.isNotEmpty() }
        .forEach { addAll(it.featureWarnings) }
}.toList()