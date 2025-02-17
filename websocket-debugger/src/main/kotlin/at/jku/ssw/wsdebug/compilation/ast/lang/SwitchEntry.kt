package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class SwitchEntry(
    override val begin: Int,
    override val end: Int,
    val labels: List<String>,
    val block: Block,
    val isDefault: Boolean = false
): AstItem(begin, end)
