@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

private class VariableCollectingVisitor(): TreeScanner() {
    val names = mutableListOf<String>()

    override fun visitIdent(tree: JCTree.JCIdent) {
        names += tree.name.toString()
        super.visitIdent(tree)
    }
}

fun getVariableNames(tree: JCTree): List<String> {
    val visitor = VariableCollectingVisitor()
    tree.accept(visitor)
    return visitor.names
}