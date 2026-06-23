package at.jku.ssw.wsdebug.compilation.instrumentation

data class StreamOperation (
    val beginLine: Int, val beginColumn: Int,
    val endLine: Int, val endColumn: Int,
    val name: String, val id: Int, val hasParam: Boolean = false, val param: String = "",
    val streamID: Int,
    val streamType: String?,
    val castType: String?,
    val endMiddleArgLine: Int? = null, val endMiddleArgColumn: Int? = null,
    val realEndLine: Int, val realEndColumn: Int
)
