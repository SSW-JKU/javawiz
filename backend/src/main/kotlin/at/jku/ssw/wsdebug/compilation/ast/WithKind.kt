package at.jku.ssw.wsdebug.compilation.ast;

interface WithKind {
    val kind get() = this::class.simpleName
}