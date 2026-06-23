package at.jku.ssw.wsdebug.compilation.instrumentation

data class IndexWrapper(
    val beginLine: Int,
    val beginColumn: Int,
    val endLine: Int,
    val endColumn: Int,
    val accessID: Int,
    val dimension: Int,
    val outerIndexedVariableName: String
    ) {
}