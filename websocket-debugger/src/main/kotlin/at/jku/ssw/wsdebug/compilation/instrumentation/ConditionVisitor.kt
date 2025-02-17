@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")
package at.jku.ssw.wsdebug.compilation.instrumentation

import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

fun generateConditions(tree: JCTree.JCCompilationUnit): List<Condition> {
    val visitor = ConditionVisitor(Positioning(tree))
    tree.accept(visitor)
    return visitor.getConditions()
}

class ConditionVisitor(val pos: Positioning): TreeScanner() {
    private val conditions = mutableListOf<Condition>()


    fun getConditions(): List<Condition> {
        return conditions.toList()
    }


    override fun visitIf(that: JCTree.JCIf) {
        addCondition(that.condition)
        super.visitIf(that)
    }

    override fun visitForLoop(that: JCTree.JCForLoop) {
        val cond = that.cond
        super.visitForLoop(that)
        if(cond == null) return
        if(containsInstanceCheck(cond)) return
        conditions += Condition(
            beginLine = pos.getBeginLine(cond) - 1,
            beginColumn = pos.getBeginColumn(cond) - 1, // indexing is different in the case of for-loop conditions for some reason
            endLine = pos.getEndLine(cond) - 1,
            endColumn = pos.getEndColumn(cond) - 1,
            cond.toString(),
            conditions.size
        )
    }

    override fun visitWhileLoop(that: JCTree.JCWhileLoop) {
        addCondition(that.condition)
        super.visitWhileLoop(that)
    }

    override fun visitDoLoop(that: JCTree.JCDoWhileLoop) {
        addCondition(that.condition)
        super.visitDoLoop(that)
    }

    private fun addCondition(cond: JCTree.JCExpression) {
        if(containsInstanceCheck(cond)) return
        conditions += Condition(
            beginLine = pos.getBeginLine(cond) - 1,
            beginColumn = pos.getBeginColumn(cond),
            endLine = pos.getEndLine(cond) - 1,
            endColumn = pos.getEndColumn(cond) - 2,
            cond.toString(),
            conditions.size
        )
    }
}

private fun containsInstanceCheck(cond: JCTree.JCExpression): Boolean {
    return cond.toString().contains("instanceof")  // instrumenting if(a instanceof B c) breaks flow analysis; therefore we do not instrument conditions in this case
}