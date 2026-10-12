package at.jku.ssw.wsdebug.debugger.recording

data class LoadedClass( //a class name together with its static fields
    val `class`: String,
    val staticFields: List<Var>,
    val isHeapTraversalStop: Boolean,
    val isJavaDataStructure: Boolean,
    /** Whether fields are collected: the class is traversable or explicitly supported as a data structure. */
    val hasCollectedFields: Boolean
) : Recordable
