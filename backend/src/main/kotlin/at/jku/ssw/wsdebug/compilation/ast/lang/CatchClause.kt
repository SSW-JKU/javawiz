package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class CatchClause(
    override val begin: Int,
    override val end: Int,
    val parameter: String,
    val beginParameter: Int,
    val endParameter: Int,
    val body: Block
) : AstItem(begin, end)
