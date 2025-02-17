package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem
import java.util.*

data class Method(
    override val begin: Int,
    override val end: Int,
    val name: String,
    val signature: String,
    val body: Block,
    val className: String,
    val nArgs: Int,
    override val uuid: UUID
) : AstItem(begin, end)
