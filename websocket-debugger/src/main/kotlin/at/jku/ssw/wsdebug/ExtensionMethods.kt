package at.jku.ssw.wsdebug

import at.jku.ssw.wsdebug.communication.CompileSuccessResponse
import at.jku.ssw.wsdebug.communication.ErrorResponse
import at.jku.ssw.wsdebug.communication.Response
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.sun.jdi.VirtualMachine
import org.java_websocket.WebSocket

fun <A> A?.packIntoMutableList() = if (this == null) mutableListOf<A>() else mutableListOf(this)

fun String.identEachLine(amount: Int, shortenTo: Int = Integer.MAX_VALUE): String {
    return this.split("\n").map { line -> (" ".repeat(amount) + line).take(shortenTo) }.joinToString("\n")
}

fun Exception.asStringWithStackTrace() = this.toString() + "\nStack Trace: " + this.stackTrace.joinToString("\n") { it.toString() }

fun VirtualMachine.getEnabledRequests() = listOf(
    eventRequestManager().accessWatchpointRequests(),
    eventRequestManager().breakpointRequests(),
    eventRequestManager().classPrepareRequests(),
    eventRequestManager().classUnloadRequests(),
    eventRequestManager().exceptionRequests(),
    eventRequestManager().methodEntryRequests(),
    eventRequestManager().methodExitRequests(),
    eventRequestManager().modificationWatchpointRequests(),
    eventRequestManager().monitorContendedEnterRequests(),
    eventRequestManager().monitorWaitRequests(),
    eventRequestManager().monitorWaitedRequests(),
    eventRequestManager().stepRequests(),
    eventRequestManager().threadDeathRequests(),
    eventRequestManager().threadStartRequests(),
    eventRequestManager().vmDeathRequests()
).flatten().filter { it.isEnabled }

fun Exception.asSingleLineStringWithStackTrace() = asStringWithStackTrace().replace("\r\n", "\n").replace("\n", " ### ")

fun String.shorten(len: Int) =
    take(len) + if (length > len) "..." else ""

fun WebSocket.sendAndPrintResponse(response: Response, shortenProductionPrintTo: Int = Integer.MAX_VALUE) {
    val message = jacksonObjectMapper().writeValueAsString(response)
    println("  Response status: ${response.status}")
    if (response is ErrorResponse) {
        println("  Response error: ${response.error}")
    }
    if (response is CompileSuccessResponse) {
        with(response.data.toString().replace("\n", " ")) {
            val dataStr =
                if (DEVELOPMENT_MODE) {
                    toString()
                } else {
                    shorten(shortenProductionPrintTo)
                }
            println("  Response data: $dataStr")
        }
    }
    send(message)
}