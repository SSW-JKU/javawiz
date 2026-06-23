package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class Switch(
    override val begin: Int,
    override val end: Int,
    val selector: String,
    val entries: List<SwitchEntry>,
    val defaultEntry: SwitchEntry?
) : AstItem(begin, end)
