package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class Statement(
    override val begin: Int,
    override val end: Int,
    val code: String,
    val methodCallExpressions: List<MethodCallExpr>,
    val type: StatementType = StatementType.OTHER,
    var endOfStatementList: Boolean = false,
): AstItem(begin, end)
