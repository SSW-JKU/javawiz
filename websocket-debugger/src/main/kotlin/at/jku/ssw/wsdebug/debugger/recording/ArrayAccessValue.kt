package at.jku.ssw.wsdebug.debugger.recording

data class ArrayAccessValue(
    val indexValues: List<Int>,
    var evaluated: Boolean,
    val arrayObjectID: Long,
    val arrayAccess: at.jku.ssw.wsdebug.compilation.instrumentation.ArrayAccess
)
