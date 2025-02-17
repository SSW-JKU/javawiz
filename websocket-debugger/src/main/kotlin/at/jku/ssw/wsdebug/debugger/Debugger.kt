package at.jku.ssw.wsdebug.debugger

import at.jku.ssw.wsdebug.debugger.recording.TraceState
import at.jku.ssw.wsdebug.debugger.recording.*

val MAX_STACK_DEPTH = 100
val MAX_STACK_DEPTH_EXCEEDED_MESSAGE = "JavaWiz maximum stack depth (${MAX_STACK_DEPTH}) exceeded"

class Debugger(val vm: at.jku.ssw.wsdebug.debugger.vm.VirtualMachine) {
    private var latestStepTask: DebuggerStepTask? = null

    init {
        vm.launchAndSetup()
    }

    fun exit() {
        vm.exit(1)
    }

    fun step(task: DebuggerStepTask, resumeVM: Boolean = true): StepResult {
        latestStepTask = task

        val traceStates = mutableListOf<TraceState>()
        var intermediateStepResult: StepResult

        intermediateStepResult = if (resumeVM) vm.resumeAndSingleStep() else vm.handleSingleStep() ?: vm.resumeAndSingleStep()
        traceStates += intermediateStepResult.traceStates

        while (vm.isRunning() &&
            !intermediateStepResult.isWaitingForInput &&
            intermediateStepResult.traceStates.isNotEmpty() &&
            !task.targetReached(traceStates.last())
        ) {
            intermediateStepResult = vm.resumeAndSingleStep()
            traceStates += intermediateStepResult.traceStates
        }

        // TODO: Find out why we kill the debuggee
        // It should automatically end once we reach the end of the program...

        // Stop the VM when we ran to end
        if (task is RunToEndTask && !intermediateStepResult.isWaitingForInput) {
            // The following fails if the VM is already disconnected
            try {
                vm.exit(1)
            } catch (ex: java.lang.Exception) {
                println("  on vm.exit(1): VM was already disconnected, no need to .exit(1) it manually.")
            }
        }

        return StepResult(traceStates, intermediateStepResult.isWaitingForInput, intermediateStepResult.isVMRunning)
    }

    fun inputAndContinueInterruptedStep(s: String): StepResult? {
        vm.input(s)

        val hasUncompletedStepRequest = latestStepTask?.targetNotReached(vm.getPreviousTraceState()) ?: false
        if (hasUncompletedStepRequest) {
            // The previous step request could not be finalized because we found out were waiting for input.
            // This led to a timeout in handleStep's vm.eventQueue().remove(1000).
            // Now that the debuggee got input data, it should have processed that input, continued execution, and
            // there should be a new entry in the event set, i.e., now we should have a BreakPointEvent to process.
            // We must _not_ call vm.resume() now, otherwise the eventQueue and the VM drift apart from each other which
            // would lead to a com.sun.jdi.IncompatibleThreadStateException that caused https://javawiz.youtrack.cloud/issue/JW-60
            return step(latestStepTask!!, false)
        }
        // We just wrote the input to the debugger but did not perform a step
        return null
    }

    fun getPreviousTraceState(): TraceState {
        return vm.getPreviousTraceState()
    }
}
