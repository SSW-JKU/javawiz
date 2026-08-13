package at.jku.ssw.wsdebug.compilation.instrumentation

data class IndexWrapper(
    val beginLine: Int,
    val beginColumn: Int,
    val endLine: Int,
    val endColumn: Int,
    val accessId: Int,
    val dimension: Int,
    val outerIndexedVariableName: String
    ) {
}
