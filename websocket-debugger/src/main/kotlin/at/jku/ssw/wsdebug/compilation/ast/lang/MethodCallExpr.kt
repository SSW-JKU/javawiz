package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem
import java.util.*

data class MethodCallExpr(
    override val begin: Int,
    override val end: Int,
    val deltaBegin: Int,
    val name: String,
    var candidates: Set<UUID> = setOf(),
): AstItem(begin, end)
