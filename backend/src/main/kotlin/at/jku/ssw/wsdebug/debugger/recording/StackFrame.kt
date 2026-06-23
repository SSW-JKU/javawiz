package at.jku.ssw.wsdebug.debugger.recording

data class StackFrame(
    val line: Int,
    val `class`: String,
    val method: String,
    val signature: String, // according to jni spec
    val displaySignature: String, // e.g. Person[] getChildren(int i, char j, int[] k )
    val genericSignature: String?,
    val localVariables: MutableList<Var>,
    val conditionValues: Collection<ConditionValue>,
    val arrayAccessValues: Collection<ArrayAccessValue>,
    val `this`: ReferenceVal?,
    val internal: Boolean
) : Recordable