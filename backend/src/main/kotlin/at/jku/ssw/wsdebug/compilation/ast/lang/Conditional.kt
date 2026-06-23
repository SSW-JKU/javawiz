package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

open class Conditional(
    override val begin: Int,
    override val end: Int,
    open val condition: String,
    open val beginCondition: Int,
    open val endCondition: Int,
    open val trueCase: Block,
    open val type: ConditionalType,
    open val methodCallExpressions: List<MethodCallExpr> = emptyList(),
): AstItem(begin, end)
