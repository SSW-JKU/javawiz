package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class IfStatement(
    override val begin: Int,
    override val end: Int,
    override val condition: String,
    override val beginCondition: Int,
    override val endCondition: Int,
    override val trueCase: Block,
    val falseCase: Block? = null,
    override val methodCallExpressions: List<MethodCallExpr>,
) : Conditional(begin, end, condition,beginCondition, endCondition, trueCase, ConditionalType.IF)
