package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.compilation.CompileSendData
import at.jku.ssw.wsdebug.debugger.recording.Recordable
import at.jku.ssw.wsdebug.debugger.recording.StepResult

sealed class Response : Recordable {
    abstract val status: TaskResult
}

class ErrorResponse(val error: String, val request: Request?) : Response() {
    override val status = TaskResult.ERROR
}

class CompileSuccessResponse(val request: Compile, val data: CompileSendData) : Response() {
    override val status = TaskResult.SUCCESS
}

class CompileFailResponse(val request: Compile, val error: String) : Response() {
    override val status = TaskResult.FAIL
}

class StepResultResponse(val request: Request, val data: StepResult) : Response() {
    override val status = TaskResult.SUCCESS
}

class InputResponse(val request: Request, val data: StepResult?) : Response() {
    override val status = TaskResult.SUCCESS
}