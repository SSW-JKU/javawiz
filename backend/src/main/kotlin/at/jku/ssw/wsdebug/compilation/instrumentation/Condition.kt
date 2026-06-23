package at.jku.ssw.wsdebug.compilation.instrumentation

data class Condition(
    val beginLine: Int, val beginColumn: Int,
    val endLine: Int, val endColumn: Int, val content: String, val id: Int
);
