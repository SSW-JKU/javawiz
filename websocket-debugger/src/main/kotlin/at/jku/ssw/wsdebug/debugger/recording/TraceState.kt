package at.jku.ssw.wsdebug.debugger.recording

data class TraceState(
    val sourceFileUri: String,
    // val sourceCode : SourceCode,
    val line: Int, // currently active line
    val stack: List<StackFrame>, // function stack; it depends on the StepRequest depth and class filters (defined in Main.kt) which methods appear here
    val heap: MutableList<HeapItem>, // active references to Arrays, Strings and Objects
    val loadedClasses: List<LoadedClass>, // classes together with their static fields
    val output: String, // stdout output produced since the last step
    val error: String, // stderr output produced since the last step
    val input: String, // stdin since the last step
    val inputBufferInfo: InputBufferInfo, // info on how far the buffer in the modified In.java class has read
    val timeSinceLastStep : Long, // milliseconds since last step was processed
    val stepProcessingTime : Long // time passed between receiving the step requesst and building the trace state
) : Recordable
