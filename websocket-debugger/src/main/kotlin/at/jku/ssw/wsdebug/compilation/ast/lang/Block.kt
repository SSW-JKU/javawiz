package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class Block(
    override val begin: Int,
    override val end: Int,
    val statements: List<AstItem>
) : AstItem(begin, end)
