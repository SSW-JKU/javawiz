package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class TryCatchFinally(
    override val begin: Int,
    override val end: Int,
    val tryBlock: Block,
    val catchClauses: List<CatchClause>,
    val finallyBlock: Block?,
): AstItem(begin, end)
