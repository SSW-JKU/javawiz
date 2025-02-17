package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.DEVELOPMENT_MODE
import at.jku.ssw.wsdebug.compilation.CompileSendData
import at.jku.ssw.wsdebug.debugger.recording.Recordable
import at.jku.ssw.wsdebug.debugger.recording.StepResult
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.java_websocket.WebSocket

sealed class Response: Recordable {
    abstract val status: TaskResult
}

class ErrorResponse(val error: String, val request: Request?) : Response() {
    override val status = TaskResult.ERROR
}

class CompileSuccessResponse(val request: Compile, val data: CompileSendData) : Response() {
    override val status = TaskResult.SUCCESS
}

class CompileFailResponse(val request: Compile, val error: String): Response() {
    override val status = TaskResult.FAIL
}

class StepResultResponse(val request: Request, val data: StepResult): Response() {
    override val status = TaskResult.SUCCESS
}

class InputResponse(val request: Request, val data: StepResult?): Response() {
    override val status = TaskResult.SUCCESS
}

fun WebSocket.sendAndPrintResponse(response: Response, shortenProductionPrintTo: Int = Integer.MAX_VALUE) {
    val message = jacksonObjectMapper().writeValueAsString(response)
    println("  Response status: ${response.status}")
    if(response is ErrorResponse) {
        println("  Response error: ${response.error}")
    }
    if(response is CompileSuccessResponse) {
        with(response.data.toString().replace("\n", " ")) {
            val dataStr =
                if (DEVELOPMENT_MODE) {
                    this
                } else {
                    take(shortenProductionPrintTo) + if (length > shortenProductionPrintTo) "..." else ""
                }
            println("  Response data: $dataStr")
        }
    }
    send(message)
}