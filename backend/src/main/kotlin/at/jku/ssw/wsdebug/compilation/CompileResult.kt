package at.jku.ssw.wsdebug.compilation

data class CompileResult(
    val success: Boolean,
    val compileOutput: String,
)
