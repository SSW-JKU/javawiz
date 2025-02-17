package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.debugger.recording.Recordable

interface AssignmentTarget : Recordable
data class ArrayAccessTarget(val id: Int) : AssignmentTarget
data class VariableTarget(val name: String) : AssignmentTarget
