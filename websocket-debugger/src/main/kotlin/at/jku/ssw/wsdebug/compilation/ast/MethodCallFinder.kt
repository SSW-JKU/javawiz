@file:Suppress("JAVA_MODULE_DOES_NOT_EXPORT_PACKAGE")

package at.jku.ssw.wsdebug.compilation.ast

import at.jku.ssw.wsdebug.compilation.ast.lang.MethodCallExpr
import at.jku.ssw.wsdebug.compilation.instrumentation.Positioning
import com.sun.tools.javac.tree.JCTree
import com.sun.tools.javac.tree.TreeScanner

class MethodCallFinder(
    val pos: Positioning,
    val containingDisplayString: String,
    val callFixup: CallFixup
) : TreeScanner() {
    private val methodCalls: MutableList<MethodCallExpr> = mutableListOf()

    fun getMethodCalls() = methodCalls.toList()
    var maxOffset = 0

    override fun visitApply(methodInvocation: JCTree.JCMethodInvocation) {
        super.scan(methodInvocation.typeargs)
        super.scan(methodInvocation.meth)
        val meth: JCTree.JCExpression = methodInvocation.meth
        var scope: JCTree.JCExpression? = null
        if (meth is JCTree.JCFieldAccess) {
            scope = meth.selected
        }
        var name = CONSTRUCTOR_NAME
        val length: Int
        val methodString = meth.toString()
        if (methodString != "this" && methodString != "super") {
            val scopeLength = if (scope !== null) scope.toString().dropWhile { c -> c.isWhitespace() }.length + 1 else 0
            name = methodString.substring(scopeLength)
            length = name.length
            maxOffset = containingDisplayString.indexOf(name, maxOffset)
        } else {
            length = methodString.length
            maxOffset = containingDisplayString.indexOf(methodString, maxOffset)
        }

        val methodCall = MethodCallExpr(
            pos.getBeginLine(methodInvocation),
            Math.max(pos.getEndLine(methodInvocation), pos.getBeginLine(methodInvocation)), // endLine is zero for artificially added super calls
            maxOffset,
            length,
            name,
        )
        callFixup.tryRegisterCall(methodInvocation, methodCall)
        ++maxOffset
        methodCalls.add(methodCall)
        super.scan(methodInvocation.args)
    }

    override fun visitNewClass(tree: JCTree.JCNewClass) {
        maxOffset = containingDisplayString.indexOf("new", maxOffset)
        val endOffset = containingDisplayString.indexOf("(", maxOffset)
        val boxLength = endOffset - maxOffset
        val constructorCall = MethodCallExpr(
            pos.getBeginLine(tree),
            pos.getEndLine(tree),
            maxOffset,
            boxLength,
            CONSTRUCTOR_NAME,
        )
        methodCalls.add(
           constructorCall
        )
        callFixup.tryRegisterConstructorCall(tree, constructorCall)
        ++maxOffset
        super.visitNewClass(tree)
    }
}