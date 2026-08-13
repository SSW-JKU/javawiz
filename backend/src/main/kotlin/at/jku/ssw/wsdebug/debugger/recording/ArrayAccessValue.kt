package at.jku.ssw.wsdebug.debugger.recording

data class ArrayAccessValue(
    val indexValues: List<Int>,
    var evaluated: Boolean,
    val arrayObjectId: Long,
    val arrayAccess: at.jku.ssw.wsdebug.compilation.instrumentation.ArrayAccess
)
