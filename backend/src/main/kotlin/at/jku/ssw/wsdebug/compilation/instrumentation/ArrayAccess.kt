package at.jku.ssw.wsdebug.compilation.instrumentation

import at.jku.ssw.wsdebug.debugger.recording.Recordable

data class ArrayAccess(
    val id: Int,
    val indexExpressions: List<IndexExpression>,
    val assignmentTarget: AssignmentTarget?,
    val assignmentSourceVariableNames: List<String>,
    val isWrittenTo: Boolean, // save yourself some sleep by never renaming this field to 'isAssignmentTarget'.
) : Recordable

