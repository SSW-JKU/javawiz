package at.jku.ssw.wsdebug.debugger.recording

data class StepResult(
    val traceStates: List<TraceState> = mutableListOf(),
    val isWaitingForInput: Boolean = false,
    val isVMRunning: Boolean = true
) {
    constructor(newTraceState: TraceState, isWaitingForInput: Boolean = false, isVMRunning: Boolean = true) :
            this(mutableListOf(newTraceState), isWaitingForInput, isVMRunning)

    infix fun merge(next: StepResult) =
        StepResult(
            this.traceStates + next.traceStates,
            this.isWaitingForInput || next.isWaitingForInput,
            this.isVMRunning && next.isVMRunning
        )
}