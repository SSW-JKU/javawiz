package at.jku.ssw.wsdebug.compilation.ast

abstract class AstItem(
    open val begin: Int,
    open val end: Int
): WithKind, Unique
