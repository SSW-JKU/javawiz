package at.jku.ssw.wsdebug.debugger

import at.jku.ssw.wsdebug.debugger.recording.TraceState

sealed class DebuggerTask() {
    abstract val task: DebuggerTaskKind
 }

abstract class DebuggerStepTask() : DebuggerTask() {
    abstract val startFrom: TraceState
    abstract fun targetReached(traceState: TraceState?): Boolean
    fun targetNotReached(traceState: TraceState?): Boolean = traceState != null && !targetReached(traceState)
}

class StartStepTask() : DebuggerStepTask() {
    override val startFrom: TraceState
        get() = error("no trace state before first step")

    override val task: DebuggerTaskKind = DebuggerTaskKind.STEP_INTO

    override fun targetReached(traceState: TraceState?): Boolean {
        return true
    }
}

data class StepIntoTask(override val startFrom: TraceState) : DebuggerStepTask() {
    override val task: DebuggerTaskKind = DebuggerTaskKind.STEP_INTO

    override fun targetReached(traceState: TraceState?): Boolean {
        return traceState != null && traceState !== startFrom
    }
}

data class StepOutTask(override val startFrom: TraceState, val referenceStackDepth: Int) : DebuggerStepTask() {
    override val task: DebuggerTaskKind = DebuggerTaskKind.STEP_OUT

    override fun targetReached(traceState: TraceState?): Boolean {
        return traceState != null && traceState !== startFrom && traceState.stack.size < referenceStackDepth
    }
}

data class StepOverTask(override val startFrom: TraceState, val referenceStackDepth: Int) : DebuggerStepTask() {
    override val task: DebuggerTaskKind = DebuggerTaskKind.STEP_OVER
    override fun targetReached(traceState: TraceState?): Boolean {
        return traceState != null && traceState !== startFrom && traceState.stack.size <= referenceStackDepth
    }
}

data class RunToLineTask(override val startFrom: TraceState, val line: Int, val className: String) : DebuggerStepTask() {
    override val task: DebuggerTaskKind = DebuggerTaskKind.RUN_TO_LINE

    override fun targetReached(traceState: TraceState?): Boolean {
        return traceState != null && traceState !== startFrom && traceState.line == line && traceState.stack.first().`class` == className
    }
}

data class RunToEndTask(override val startFrom: TraceState) : DebuggerStepTask() {
    override val task: DebuggerTaskKind = DebuggerTaskKind.RUN_TO_END

    override fun targetReached(traceState: TraceState?): Boolean {
        return false
    }
}