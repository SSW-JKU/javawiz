package at.jku.ssw.wsdebug.debugger.recording

data class InputBufferInfo(
    val past: String,
    val future: String,
    val done: Boolean,
    val latestValue: String,
    val latestMethod: String,
    val traceSuccess: Boolean
) {
    companion object {
        val EMPTY = InputBufferInfo("", "", false, "no value", "no method called", traceSuccess = true)
        val FAILED = InputBufferInfo("", "", false, "no value", "no method called", traceSuccess = false)
    }
}
