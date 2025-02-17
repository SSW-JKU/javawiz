package at.jku.ssw.wsdebug.compilation.ast.lang

import at.jku.ssw.wsdebug.compilation.ast.AstItem

class AstFile (
    override val begin: Int,
    override val end: Int,
    val classes: List<Class>
) : AstItem(begin, end)