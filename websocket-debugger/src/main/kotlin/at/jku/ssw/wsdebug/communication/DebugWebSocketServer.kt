package at.jku.ssw.wsdebug.communication

import at.jku.ssw.wsdebug.asStringWithStackTrace
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import kotlin.concurrent.thread


class DebugWebSocketServer(address: InetSocketAddress) : WebSocketServer(address) {
    private var activeConnection: WebSocket? = null

    override fun onOpen(conn: WebSocket?, handshake: ClientHandshake?) {
        println("[WebSocket] Event: onOpen")
        println("  Connection with client is now established, ready to process requests")
        println("  Connection: $conn")
        println("  Handshake: $handshake")
        println()
        // only one debugging session / connection at a time, new ones preempt old ones
        activeConnection?.close()
        activeConnection = conn
        exitLatestDebugger()
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        println("[WebSocket] Event: onClose")
        println("  Connection: $conn")
        println("  Code: $code")
        println("  Reason: $reason")
        println("  Remote: $remote")
        println()
        exitLatestDebugger()
    }

    override fun onMessage(conn: WebSocket, message: String) {
        println("[WebSocket] Event: onMessage")
        println("  Connection: $conn")
        println("  Message: $message")

        thread(isDaemon = true, name = "Handler for $message") {
            conn.sendAndPrintResponse(generateResponse(message), 100)
        }
    }

    override fun onStart() {
        println("[WebSocket] Event: onStart")
        println("  DebugWebSocket is now running, ready to accept connection from client.")
        println()
        println("confirming_start") // needed in extension mode in order to make sure that frontend is launched after server has started
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        println("[WebSocket] Event: onError")
        println("  Connection: $conn")
        println("  Exception: ${ex.asStringWithStackTrace()}")
        println()
    }

    fun generateResponse(request: String): Response = generateResponseFromString(request)
}
