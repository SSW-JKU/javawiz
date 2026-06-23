package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

data class Class (
    override val begin: Int,
    override val end: Int,
    val name: String,
    val methods: List<Method>,
    //val initializations: Method
) : AstItem(begin, end)
