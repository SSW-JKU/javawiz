@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation

import at.jku.ssw.wsdebug.communication.FilepathAndContent
import at.jku.ssw.wsdebug.compilation.ast.AbstractSyntaxTree
import at.jku.ssw.wsdebug.compilation.ast.CallFixup
import at.jku.ssw.wsdebug.compilation.ast.generateAst
import at.jku.ssw.wsdebug.compilation.instrumentation.*
import at.jku.ssw.wsdebug.outerClassMatchesOuterClassPattern
import com.sun.tools.javac.tree.JCTree
import java.io.File
import java.io.StringWriter
import java.nio.file.Files
import java.nio.file.Paths
import javax.lang.model.element.Modifier
import javax.tools.*

val COMPILATION_DIR_NAME = "JavaWiz-on-the-fly-compiler"
val COMPILATION_OUTPUT_DIR = Files.createTempDirectory(COMPILATION_DIR_NAME).toAbsolutePath().toString()
val COMPILATION_INPUT_DIR = Files.createTempDirectory(COMPILATION_DIR_NAME)
val BASE_RESOURCE_PATH = "/additionalclasses/"
val JAVAWIZ_PACKAGE = "jwdebug"
val JAVAWIZ_CLASS = "\$JavaWiz"
val JAVAWIZ_PATH = "$JAVAWIZ_PACKAGE/$JAVAWIZ_CLASS.java"

fun compile(mainUri: String, sources: List<FilepathAndContent>, additionalSources: List<FilepathAndContent>, useFileManager: Boolean): CompileResult {

    val javac: JavaCompiler = ToolProvider.getSystemJavaCompiler()
    val sourceFiles = sources.map { FakeJavaSourceFile(it) }
    val main = sourceFiles.find { it.contents.localUri == mainUri }

    val fileManager = javac.getStandardFileManager(null, null, null)
    val additionalSourceFiles = additionalSources.map { FakeJavaSourceFile(it) }
    val compilationUnits = (mutableListOf(main) + additionalSourceFiles).toMutableList()
    if(useFileManager) {
        initializeFileManager(fileManager, mainUri, sourceFiles)
    }
    val outWriter = StringWriter()
    val diagnosticListener: DiagnosticListener<in JavaFileObject?>? = null

    val DEBUG_FLAG = "-g"
    val options: List<String> = listOf(DEBUG_FLAG)
    val classes: List<String>? = null

    val task = javac.getTask(
        outWriter, fileManager, diagnosticListener, options, classes, compilationUnits
    )
    return CompileResult(
        task.call(),
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
}

fun computeParseInfos(tree: JCTree.JCCompilationUnit, callFixup: CallFixup): ParseInfo? {
    try {
        val packageDot = if (tree.packageName == null) "" else (tree.packageName.toString() + ".")
        val typeNames = tree.typeDecls.filterIsInstance<JCTree.JCClassDecl>().flatMap { getTypeNames(packageDot, it) }
        val ast = generateAst(tree, callFixup)
        val conditions = generateConditions(tree)

        val (arrayAccesses, indexWrappers) = generateArrayAccessInfo(tree)
        val modPoints = modificationPoints(conditions, indexWrappers)
        val content = tree.sourceFile.getCharContent(true).toString()
        val modified = applyModifications(content, modPoints)

        val featureWarnings = generateWarnings(tree)

        return ParseInfo(
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
    } catch(e: NullPointerException) {
        /*
        * In all known cases, NPE is thrown when symbol table is not completely filled due to compile error.
        * I know no other way of checking whether a syntactically correct file contributes to a compile error.
        * If a compile error occurs, we do not want to stop handling the request but instead move on to files with complete symbol table.
        * Therefore, we just ignore files with incomplete symbol table.
        * Risk: NPE's thrown for other reasons will be erroneously caught as well.
        * */
        return null
    }
}

fun isInternal(compilationUnit: JCTree.JCCompilationUnit, internalClassPatterns: List<String>): Boolean {
    val packageDot = if (compilationUnit.packageName == null) "" else (compilationUnit.packageName.toString() + ".")
    val typeNames = compilationUnit.typeDecls.filterIsInstance<JCTree.JCClassDecl>().flatMap { getTypeNames(packageDot, it) }

    return typeNames.all { name ->
        outerClassMatchesOuterClassPattern(name, internalClassPatterns)
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

private fun getTypeNames(packageDot: String, tree: JCTree.JCClassDecl): List<String> {
    val flatInnerClassDeclarations = tree.members.filterIsInstance<JCTree.JCClassDecl>()
    val recursiveInnerClasses = flatInnerClassDeclarations.flatMap { inner ->
        getTypeNames("", inner).map {
            packageDot + tree.name.toString() + "\$" + it
        }
    }
    return listOf(packageDot + tree.name.toString()) + recursiveInnerClasses
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