@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation

import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner
import com.sun.tools.javac.code.Symbol

val IMPORT_BLACKLIST = listOf(
    "java.util.concurrent",
    "java.awt",
    "java.lang.reflect",
    "java.awt",
    "javafx",
)
val IDENT_BLACKLIST = listOf("Thread", "Runnable")
private val STREAM_TYPES = setOf(
    "java.util.stream.BaseStream",
    "java.util.stream.Stream",
    "java.util.stream.IntStream",
    "java.util.stream.LongStream",
    "java.util.stream.DoubleStream"
)

enum class UnsupportedFeature(val diagnostic: String) {
    PARALLEL_STREAM(
        "Parallel stream execution is unsupported; use a sequential stream instead. " +
                "Explicit parallel calls are rejected even when followed by sequential()."
    )
}

fun generateWarnings(tree: JCTree.JCCompilationUnit): Set<String> {
    val visitor = WarningGenerator()
    tree.accept(visitor)
    return visitor.warnings
}

fun detectUnsupportedFeatures(tree: JCTree.JCCompilationUnit): Set<UnsupportedFeature> {
    val visitor = WarningGenerator()
    tree.accept(visitor)
    return visitor.unsupportedFeatures
}

class WarningGenerator() : TreeScanner() {
    var warnings = mutableSetOf<String>()
    var unsupportedFeatures = mutableSetOf<UnsupportedFeature>()

    override fun visitIdent(tree: JCTree.JCIdent) {
        val name = tree.toString()
        if (IDENT_BLACKLIST.contains(name)) {
            warnings += name
        }
        super.visitIdent(tree)
    }


    override fun visitImport(tree: JCTree.JCImport) {
        val importedPackageName = tree.toString()
        for(packageName in IMPORT_BLACKLIST) {
            if(importedPackageName.startsWith("import $packageName")) {
                warnings += packageName
            }
        }
        super.visitImport(tree)
    }

    override fun visitLambda(tree: JCTree.JCLambda) {
        warnings += "Lambda expressions"
        super.visitLambda(tree)
    }

    override fun visitApply(tree: JCTree.JCMethodInvocation) {
        val method = (tree.meth as? JCTree.JCFieldAccess)?.sym as? Symbol.MethodSymbol
        val isParallelStream = method?.name?.contentEquals("parallelStream") == true &&
                method.owner.qualifiedName.contentEquals("java.util.Collection")
        val isParallelBaseStream = method?.name?.contentEquals("parallel") == true &&
                method.owner.qualifiedName.toString() in STREAM_TYPES
        if (isParallelStream || isParallelBaseStream) {
            unsupportedFeatures += UnsupportedFeature.PARALLEL_STREAM
        }
        super.visitApply(tree)
    }

    override fun visitClassDef(tree: JCTree.JCClassDecl) {
        if (tree.typeParameters.isNotEmpty()) {
            warnings += "Generics"
        }
        super.visitClassDef(tree)
    }
}
