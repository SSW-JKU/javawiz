package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem
import java.util.*

data class MethodCallExpr(
    override val begin: Int,
    override val end: Int,
    val deltaBegin: Int,
    // is equal to name.length unless method call is a constructor call,
    // in which case name is a magic value and length is the distance between start of
    // expression and end of expression
    val length: Int,
    val name: String,
    var candidates: Set<UUID> = setOf(),
): AstItem(begin, end)
