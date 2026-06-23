@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation

import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

val IMPORT_BLACKLIST = listOf(
    "java.util.concurrent",
    "java.awt",
    "java.lang.reflect",
    "java.awt",
    "javafx",
)
val IDENT_BLACKLIST = listOf("Thread", "Runnable")

fun generateWarnings(tree: JCTree.JCCompilationUnit): Set<String> {
    val visitor = WarningGenerator()
    tree.accept(visitor)
    return visitor.warnings
}

class WarningGenerator() : TreeScanner() {
    var warnings = mutableSetOf<String>()

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

    override fun visitClassDef(tree: JCTree.JCClassDecl) {
        if (tree.typeParameters.isNotEmpty()) {
            warnings += "Generics"
        }
        super.visitClassDef(tree)
    }
}