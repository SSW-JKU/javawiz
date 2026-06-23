package at.jku.ssw.wsdebug.debugger.recording

data class LoadedClass( //a class name together with its static fields
    val `class`: String,
    val staticFields: List<Var>,
    val detailedFieldsOnly: Boolean = false
) : Recordable