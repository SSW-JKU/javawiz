package at.jku.ssw.wsdebug.debugger.recording

data class ConditionValue(val id: Int, val expression: String, val value: Boolean, var evaluated : Boolean) // id is only unique within a given SourceCode