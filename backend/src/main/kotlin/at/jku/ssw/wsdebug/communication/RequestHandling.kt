@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.asStringWithStackTrace
import at.jku.ssw.wsdebug.compilation.*
import at.jku.ssw.wsdebug.compilation.ast.CallFixup
import at.jku.ssw.wsdebug.debugger.Debugger
import at.jku.ssw.wsdebug.debugger.StartStepTask
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.DATA_STRUCTURE_CLASSES
import at.jku.ssw.wsdebug.debugger.vm.VirtualMachine.Companion.INTERNAL_CLASS_PATTERNS
import at.jku.ssw.wsdebug.debugger.vm.jdi.JDIVirtualMachine
import at.jku.ssw.wsdebug.identEachLine
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
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
        println("[request]\n" + request.toString().identEachLine(4))
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
    val timing = CompileTimingReport()
    try {
        val tShutdown = timing.now()
        exitLatestDebugger()
        timing.add("shutdown previous debugger: ${timing.elapsed(tShutdown)}ms")

        val tRequestSetup = timing.now()
        val excludeFromSteppingPatterns = (request.excludeFromSteppingPatterns ?: INTERNAL_CLASS_PATTERNS) + "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS"
        val excludeFieldsPatterns = (request.excludeFieldsPatterns ?: INTERNAL_CLASS_PATTERNS) + "$JAVAWIZ_PACKAGE.$JAVAWIZ_CLASS"
        val detailedFieldsPatterns = request.detailedFieldsPatterns ?: DATA_STRUCTURE_CLASSES
        val additionalSourcePaths = if (request.vscExtensionActive) {
            listOf(JAVAWIZ_PATH)
        } else {
            listOf(JAVAWIZ_PATH, "In.java", "Out.java", "Rand.java").filter { name -> request.classContents.none { it.localUri.endsWith(name) } }
        }

        val requestSourceFiles = request.classContents.map { FilepathAndContent(it.localUri, it.content.replace('\t', ' ')) }
        timing.add("request setup: ${timing.elapsed(tRequestSetup)}ms (${requestSourceFiles.size} request files, ${additionalSourcePaths.size} additional paths)")

        val tAdditionalSources = timing.now()
        val additionalSourceCodes = additionalSourcePaths.map { name ->
            FilepathAndContent(
                name,
                request.let { it.javaClass.getResourceAsStream(BASE_RESOURCE_PATH + name)?.reader()?.readText() ?: "" },
            )
        }
        timing.add("load additional sources: ${timing.elapsed(tAdditionalSources)}ms (${additionalSourceCodes.size} files)")

        val tInitialJavacSetup = timing.now()
        val sources = requestSourceFiles + additionalSourceCodes
        val sourceFiles = sources.map { FakeJavaSourceFile(it) }
        val javac = ToolProvider.getSystemJavaCompiler()
        val out = StringWriter()
        val task = javac.getTask(
            out, null, null, null, null, sourceFiles
        ) as JavacTask
        timing.add("initial javac setup: ${timing.elapsed(tInitialJavacSetup)}ms (${sourceFiles.size} files)")

        timing.openBlock("parse + analyze")
        val tParse = timing.now()
        val trees = task.parse().toList()
        timing.add("parse: ${timing.elapsed(tParse)}ms (${trees.size} trees)")

        val tAnalyze = timing.now()
        val analyzedElements = task.analyze().toList() // needed for filling the symbol table
        timing.add("analyze (fill symbol table): ${timing.elapsed(tAnalyze)}ms (${analyzedElements.size} elements)")

        val tCollectUnits = timing.now()
        val allUnits = trees.filterIsInstance<JCTree.JCCompilationUnit>()
        timing.add("collect compilation units: ${timing.elapsed(tCollectUnits)}ms (${allUnits.size} units)")
        timing.closeBlock("(${allUnits.size} units)")

        // Classes marked as "excludeFromStepping" are not modified, i.e., we do not track their boolean condition evaluations and their array accesses.
        val tPartition = timing.now()
        val (internalCompilationUnits, compilationUnits) = allUnits.partition { cu -> isInternal(cu, excludeFromSteppingPatterns) }
        timing.add("partition internal files: ${timing.elapsed(tPartition)}ms (${compilationUnits.size} user, ${internalCompilationUnits.size} internal)")

        val tUnchangedFiles = timing.now()
        val unmodifiedInternalSources = internalCompilationUnits.map { unit ->
            val packageDot = if (unit.packageName == null) "" else (unit.packageName.toString() + ".")
            val prefix = if (request.vscExtensionActive) "" else packageDot.replace(".", "/")
            FilepathAndContent(
                prefix + unit.sourceFile.name,
                unit.sourceFile.getCharContent(true).toString()
            )
        }
        timing.add("collect unchanged internal files: ${timing.elapsed(tUnchangedFiles)}ms (${unmodifiedInternalSources.size} files)")

        val callFixup = CallFixup()
        timing.openBlock("instrumentation")
        val parseInfos = compilationUnits.mapNotNull { modifyAndComputeParseInfos(it, callFixup, timing) }
        val totalConditions = parseInfos.sumOf { it.conditions.size }
        val totalArrayAccesses = parseInfos.sumOf { it.arrayAccesses.size }
        timing.closeBlock("(${compilationUnits.size} user + ${internalCompilationUnits.size} internal files) | $totalConditions conditions, $totalArrayAccesses array accesses")

        val tCallFixup = timing.now()
        callFixup.resolve(task.types)
        timing.add("callFixup.resolve: ${timing.elapsed(tCallFixup)}ms")

        val tMainClassSelection = timing.now()
        var mainParseInfo: ParseInfo? = null
        if (request.openEditorLocalUri != null) {
            println("Frontend explicitly requested ${request.openEditorLocalUri} as main class")
            mainParseInfo = parseInfos.find { info -> info.localUri == request.openEditorLocalUri && info.mainClass != null }
            if (mainParseInfo != null) {
                println("Requested main class found")
            } else {
                println("Requested main class not found. Following main classes would have been available: " + parseInfos.filter { info -> info.mainClass != null }
                    .map { it.localUri })
            }
        }
        if (mainParseInfo == null) {
            mainParseInfo = parseInfos.find { it.mainClass != null }
            println("Using first main class: " + mainParseInfo?.localUri)
        }
        timing.add("main class selection: ${timing.elapsed(tMainClassSelection)}ms (${mainParseInfo?.localUri ?: "none"})")
        if (mainParseInfo == null) {
            val message = out.toString().ifEmpty {
                "Could not find main class"
            }
            return CompileFailResponse(request, message)
        }

        fun modifiedUri(parseInfo: ParseInfo) = if (request.vscExtensionActive) parseInfo.localUri else parseInfo.packageExtendedUri

        val tModifiedSources = timing.now()
        val modifiedSources = parseInfos.map {
            FilepathAndContent(modifiedUri(it), it.modifiedSource)
        }
        timing.add("collect modified sources: ${timing.elapsed(tModifiedSources)}ms (${modifiedSources.size} files)")


        val mainUri = modifiedUri(mainParseInfo)
        val modifiedCompileResult = compile(
            mainUri,
            modifiedSources + unmodifiedInternalSources,
            additionalSourceCodes,
            useFileManager = true,
            timing = timing,
            timingLabel = "javac (modified)"
        )

        if (!modifiedCompileResult.success) {
            val tUnmodifiedSources = timing.now()
            val originalSources = parseInfos.map {
                FilepathAndContent(modifiedUri(it), it.source)
            }
            timing.add("collect original sources: ${timing.elapsed(tUnmodifiedSources)}ms (${originalSources.size} files)")

            val unmodifiedCompileResult = compile(
                mainUri,
                originalSources + unmodifiedInternalSources,
                additionalSourceCodes,
                useFileManager = false,
                timing = timing,
                timingLabel = "javac (unmodified)"
            )

            if (unmodifiedCompileResult.success) {
                throw Exception("Source code modification caused an unexpected compile error: " + modifiedCompileResult.compileOutput)
            }
            return CompileFailResponse(request, unmodifiedCompileResult.compileOutput)
        }

        val tJdiLaunch = timing.now()
        latestDebugger = Debugger(
            JDIVirtualMachine(
                mainParseInfo.mainClass!!,
                Paths.get(COMPILATION_OUTPUT_DIR).toAbsolutePath().toString(),
                parseInfos,
                excludeFromSteppingPatterns,
                excludeFieldsPatterns,
                detailedFieldsPatterns,
            )
        )
        timing.add("JDI launch: ${timing.elapsed(tJdiLaunch)}ms")

        val tFirstStep = timing.now()
        val firstStepResult = latestDebugger!!.step(StartStepTask())
        timing.add("first step: ${timing.elapsed(tFirstStep)}ms")

        val tWarnings = timing.now()
        val warnings = generateWarnings(parseInfos)
        timing.add("aggregate warnings: ${timing.elapsed(tWarnings)}ms (${warnings.size} warnings)")

        val tResponse = timing.now()
        return CompileSuccessResponse(
            request,
            CompileSendData(
                modifiedCompileResult,
                firstStepResult,
                parseInfos.flatMap { it.typeNames },
                parseInfos.map { it.ast },
                warnings
            )
        ).also {
            timing.add("build compile response: ${timing.elapsed(tResponse)}ms")
        }
    } finally {
        timing.printWithTotal()
    }
}

private fun generateWarnings(parseInfos: List<ParseInfo>) = buildSet {
    parseInfos.filter { it.featureWarnings.isNotEmpty() }
        .forEach { addAll(it.featureWarnings) }
}.toList()

private fun isInternal(compilationUnit: JCTree.JCCompilationUnit, internalClassPatterns: List<String>): Boolean {
    val packageDot = if (compilationUnit.packageName == null) "" else (compilationUnit.packageName.toString() + ".")
    val typeNames = compilationUnit.typeDecls.filterIsInstance<JCTree.JCClassDecl>().flatMap { getTypeNames(packageDot, it) }

    return typeNames.all { name -> name.outerClassMatchesOuterClassPattern(internalClassPatterns) }
}