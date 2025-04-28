package at.jku.ssw.wsdebug.debugger.recording.identifiers

interface ClassName {
    val kind: String? get() = this::class.simpleName
    val className: String
}

interface MethodName {
    val kind get() = this::class.simpleName
    val name: String
}

interface URIName {
    val kind get() = this::class.simpleName
    val uri: String
}