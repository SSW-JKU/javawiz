@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation

import at.jku.ssw.wsdebug.communication.FilepathAndContent
import at.jku.ssw.wsdebug.compilation.ast.AbstractSyntaxTree
import at.jku.ssw.wsdebug.compilation.ast.CallFixup
import at.jku.ssw.wsdebug.compilation.ast.generateAst
import at.jku.ssw.wsdebug.compilation.instrumentation.*
import com.sun.tools.javac.tree.JCTree
import java.io.File
import java.io.StringWriter
import java.nio.file.Files
import java.nio.file.Paths
import javax.lang.model.element.Modifier
import javax.tools.*
import kotlin.io.path.isRegularFile

val COMPILATION_DIR_NAME = "JavaWiz-on-the-fly-compiler"
val COMPILATION_OUTPUT_DIR = Files.createTempDirectory(COMPILATION_DIR_NAME).toAbsolutePath().toString()
val COMPILATION_INPUT_DIR = Files.createTempDirectory(COMPILATION_DIR_NAME)
val BASE_RESOURCE_PATH = "/additionalclasses/"
val JAVAWIZ_PACKAGE = "jwdebug"
val JAVAWIZ_CLASS = "\$JavaWiz"
val JAVAWIZ_PATH = "$JAVAWIZ_PACKAGE/$JAVAWIZ_CLASS.java"

fun compile(
    mainUri: String,
    sources: List<FilepathAndContent>,
    additionalSources: List<FilepathAndContent>,
    useFileManager: Boolean,
    timing: CompileTimingReport? = null,
    timingLabel: String = "javac"
): CompileResult {
    timing?.openBlock(timingLabel)
    println("OnTheFlyCompiler.compile called with mainUri '$mainUri', sources '${sources.map { it.localUri }}', additionalSources '${additionalSources.map { it.localUri }}', useFileManager '$useFileManager'")

    val tSetup = timing?.now()
    val javac: JavaCompiler = ToolProvider.getSystemJavaCompiler()
    val sourceFiles = sources.map { FakeJavaSourceFile(it) }
    val additionalSourceFiles = additionalSources.map { FakeJavaSourceFile(it) }
    val main = sourceFiles.find { it.contents.localUri == mainUri } ?: error("Main source file with URI $mainUri not found among provided sources.")

    val allSources = sourceFiles + additionalSourceFiles.filter { additionalSourceFile -> sourceFiles.none { sourceFile -> sourceFile.name == additionalSourceFile.name } }

    val fileManager = javac.getStandardFileManager(null, null, null)
    val mainCompilationUnit: List<FakeJavaSourceFile> = listOf(main)
    val outWriter = StringWriter()
    val diagnosticListener: DiagnosticListener<in JavaFileObject?>? = null

    val DEBUG_FLAG = "-g"
    val options: List<String> = listOf(DEBUG_FLAG)
    val classesToBeAnnotationProcessed: List<String>? = null
    if (tSetup != null) {
        timing.add("setup: ${timing.elapsed(tSetup)}ms (${sourceFiles.size} source files, ${additionalSourceFiles.size} additional files)")
    }

    if (useFileManager) {
        val tFileManager = timing?.now()
        initializeFileManager(fileManager, mainUri, allSources)
        if (tFileManager != null) {
            timing.add("initializeFileManager: ${timing.elapsed(tFileManager)}ms")
        }
    }

    val tGetTask = timing?.now()
    val task = javac.getTask(outWriter, fileManager, diagnosticListener, options, classesToBeAnnotationProcessed, mainCompilationUnit)
    if (tGetTask != null) {
        timing.add("getTask: ${timing.elapsed(tGetTask)}ms")
    }
    println(
        "Compilation calling javac.getTask with outWriter '$outWriter', fileManager '$fileManager', diagnosticListener '$diagnosticListener', options '$options', classes '$classesToBeAnnotationProcessed', " +
                "compilationUnits '$mainCompilationUnit'"
    )

    val tCall = timing?.now()
    val success = task.call()
    if (tCall != null) {
        timing.add("task.call: ${timing.elapsed(tCall)}ms")
    }
    timing?.closeBlock("(${sources.size} files)")
    return CompileResult(
        success,
        outWriter.toString(),
    )
}

private fun initializeFileManager(fileManager: StandardJavaFileManager, mainUri: String, sourceFiles: List<FakeJavaSourceFile>) {
    File(COMPILATION_OUTPUT_DIR).deleteRecursively()
    Files.createDirectories(Paths.get(COMPILATION_OUTPUT_DIR))
    fileManager.setLocation(StandardLocation.CLASS_OUTPUT, listOf(File(COMPILATION_OUTPUT_DIR)))

    File(COMPILATION_INPUT_DIR.toAbsolutePath().toString()).deleteRecursively()
    Files.createDirectories(COMPILATION_INPUT_DIR)

    // consider subdirectories that contain main class (e.g. /src/) as possible sources roots
    val sourcePaths = listOf(COMPILATION_INPUT_DIR) + (Paths.get(mainUri).parent?.map { COMPILATION_INPUT_DIR.resolve(it) } ?: listOf())

    fileManager.setLocation(StandardLocation.SOURCE_PATH, sourcePaths.map { it.toFile() })

    for (fake in sourceFiles) {
        val path = Paths.get(COMPILATION_INPUT_DIR.toString(), fake.name)
        Files.createDirectories(path.parent)
        Files.write(path, fake.contents.content.encodeToByteArray())
    }

    printInputDirectoryContents()
}

private fun printInputDirectoryContents() {
    println("Compilation input directory content (${COMPILATION_INPUT_DIR.toAbsolutePath()}):")
    Files.walk(COMPILATION_INPUT_DIR).use { paths ->
        paths
            .sorted()
            .forEach { path -> if (path.isRegularFile()) println("  $path") }
    }
}

fun modifyAndComputeParseInfos(tree: JCTree.JCCompilationUnit, callFixup: CallFixup, timing: CompileTimingReport): ParseInfo? {
    val label = tree.sourceFile.name.substringAfterLast('/')
    timing.openBlock("$label total")
    try {
        val t0 = timing.now()
        val packageDot = if (tree.packageName == null) "" else (tree.packageName.toString() + ".")
        val typeNames = tree.typeDecls.filterIsInstance<JCTree.JCClassDecl>().flatMap { getTypeNames(packageDot, it) }
        timing.add("collectTypeNames: ${timing.elapsed(t0)}ms (${typeNames.size} classes)")

        val t1 = timing.now()
        val ast = generateAst(tree, callFixup)
        timing.add("generateAst: ${timing.elapsed(t1)}ms (${typeNames.size} classes)")

        val t2 = timing.now()
        val conditions = generateConditions(tree)
        timing.add("generateConditions: ${timing.elapsed(t2)}ms (${conditions.size} conditions)")

        val t3 = timing.now()
        val (arrayAccesses, indexWrappers) = generateArrayAccessInfo(tree)
        timing.add("generateArrayAccessInfo: ${timing.elapsed(t3)}ms (${arrayAccesses.size} accesses, ${indexWrappers.size} wrappers)")

        val t4 = timing.now()
        val streamOps = generateStreamOps(tree)
        timing.add("generateStreamOps: ${timing.elapsed(t4)}ms (${streamOps.size} stream ops)")

        val t5 = timing.now()
        val modPoints = modificationPoints(conditions, indexWrappers, streamOps)
        timing.add("modificationPoints: ${timing.elapsed(t5)}ms (${modPoints.size} points)")

        val t6 = timing.now()
        val content = tree.sourceFile.getCharContent(true).toString()
        timing.add("readSourceContent: ${timing.elapsed(t6)}ms (${content.lines().size} lines)")

        val t7 = timing.now()
        val modified = applyModifications(content, modPoints)
        timing.add("applyModifications: ${timing.elapsed(t7)}ms (${content.lines().size} -> ${modified.lines().size} lines)")

        val t8 = timing.now()
        val featureWarnings = generateWarnings(tree)
        timing.add("generateWarnings: ${timing.elapsed(t8)}ms (${featureWarnings.size} warnings)")

        val parseInfo = ParseInfo(
            tree.sourceFile.name,
            packageDot.replace('.', '/') + tree.sourceFile.name.substringAfterLast('/'),
            content,
            modified,
            arrayAccesses,
            conditions.map { it.content },
            ast,
            typeNames,
            findMainClass(tree, packageDot),
            methodLines(ast),
            featureWarnings
        )
        timing.closeBlock()
        return parseInfo
    } catch (e: NullPointerException) {
        /*
        * In all known cases, NPE is thrown when symbol table is not completely filled due to compile error.
        * I know no other way of checking whether a syntactically correct file contributes to a compile error.
        * If a compile error occurs, we do not want to stop handling the request but instead move on to files with complete symbol table.
        * Therefore, we just ignore files with incomplete symbol table.
        * Risk: NPE's thrown for other reasons will be erroneously caught as well.
        * */
        timing.closeBlock("(skipped: incomplete symbol table)")
        return null
    }
}

private fun methodLines(ast: AbstractSyntaxTree): Set<Int> {
    val result = mutableSetOf<Int>()
    ast.file.classes
        .flatMap { it.methods }
        .forEach {
            result.addAll(IntRange(it.begin, it.end))
        }
    return result.toSet()
}

private fun findMainClass(tree: JCTree.JCCompilationUnit, packageDot: String): String? {
    val classDeclarations = tree.typeDecls.filterIsInstance<JCTree.JCClassDecl>().filterNot { it.modifiers.toString().contains("interface") }
    return classDeclarations.find { cls ->
        cls.members.filterIsInstance<JCTree.JCMethodDecl>().filter { it.name.contentEquals("main") }.any {
            it.params.length() == 1 &&
                    it.params[0].vartype.toString() == "String[]" &&
                    it.restype.toString() == "void" &&
                    it.mods.getFlags()
                        .contains(Modifier.PUBLIC) &&
                    it.mods.getFlags().contains(Modifier.STATIC)
        }
    }?.let { packageDot + it.name }
}

data class ParseInfo(
    val localUri: String,
    val packageExtendedUri: String,
    val source: String,
    val modifiedSource: String,
    val arrayAccesses: List<ArrayAccess>,
    val conditions: List<String>,
    val ast: AbstractSyntaxTree,
    val typeNames: List<String>,
    val mainClass: String?,
    val methodLines: Set<Int>,
    val featureWarnings: Set<String>
)

fun getTypeNames(packageDot: String, tree: JCTree.JCClassDecl): List<String> {
    val flatInnerClassDeclarations = tree.members.filterIsInstance<JCTree.JCClassDecl>()
    val recursiveInnerClasses = flatInnerClassDeclarations.flatMap { inner ->
        getTypeNames("", inner).map {
            packageDot + tree.name.toString() + "\$" + it
        }
    }
    return listOf(packageDot + tree.name.toString()) + recursiveInnerClasses
}
