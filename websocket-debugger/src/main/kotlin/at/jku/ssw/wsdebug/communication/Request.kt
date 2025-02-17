package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.debugger.*
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

data class FilepathAndContent(val localUri: String, val content: String)

// https://stackoverflow.com/questions/68938577/kotlin-sealed-class-subtyping-in-jackson
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "task")
@JsonSubTypes(
    JsonSubTypes.Type(value = Compile::class, name = "COMPILE"),
    JsonSubTypes.Type(value = StepInto::class, name = "STEP_INTO"),
    JsonSubTypes.Type(value = StepOver::class, name = "STEP_OVER"),
    JsonSubTypes.Type(value = StepOut::class, name = "STEP_OUT"),
    JsonSubTypes.Type(value = RunToLine::class, name = "RUN_TO_LINE"),
    JsonSubTypes.Type(value = RunToEnd::class, name = "RUN_TO_END"),
    JsonSubTypes.Type(value = Input::class, name = "INPUT"),
)
sealed class Request {
    abstract val task: TaskKind
}

data class Compile(val classContents: List<FilepathAndContent>, val vscExtensionActive: Boolean, val internalClassPatterns: List<String>?, val openEditorLocalUri: String? =
    null) : Request() {
    override val task: TaskKind = TaskKind.COMPILE
}

abstract class StepRequest : Request() {
    abstract fun toDebuggerStepTask(debugger: Debugger) : DebuggerStepTask
}

class StepInto() : StepRequest() {
    override fun toDebuggerStepTask(debugger: Debugger): DebuggerStepTask {
        return StepIntoTask(debugger.getPreviousTraceState())
    }

    override val task: TaskKind = TaskKind.STEP_INTO
}

data class StepOut(val referenceStackDepth: Int) : StepRequest() {
    override val task: TaskKind = TaskKind.STEP_OUT

    override fun toDebuggerStepTask(debugger: Debugger): DebuggerStepTask {
        return StepOutTask(debugger.getPreviousTraceState(), referenceStackDepth)
    }
}

data class StepOver(val referenceStackDepth: Int) : StepRequest() {
    override val task: TaskKind = TaskKind.STEP_OVER

    override fun toDebuggerStepTask(debugger: Debugger): DebuggerStepTask {
        return StepOverTask(debugger.vm.getPreviousTraceState(), referenceStackDepth)
    }
}

data class RunToLine(val line: Int, val className: String) : StepRequest() {
    override val task: TaskKind = TaskKind.RUN_TO_LINE

    override fun toDebuggerStepTask(debugger: Debugger): DebuggerStepTask {
        return RunToLineTask(debugger.vm.getPreviousTraceState(), line, className)
    }
}

class RunToEnd() : StepRequest() {
    override val task: TaskKind = TaskKind.RUN_TO_END

    override fun toDebuggerStepTask(debugger: Debugger): DebuggerStepTask {
        return RunToEndTask(debugger.vm.getPreviousTraceState())
    }
}

data class Input(val text: String) : Request() {
    override val task: TaskKind = TaskKind.INPUT
}