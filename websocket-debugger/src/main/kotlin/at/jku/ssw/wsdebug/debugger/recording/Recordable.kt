package at.jku.ssw.wsdebug.debugger.recording

interface Recordable {
    val kind get() = this::class.simpleName
}