package at.jku.ssw.wsdebug

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress
import java.net.ServerSocket

internal class WebSocketMainTest {
    @Test
    fun tcpPortAvailabilityDetectsOccupiedPort() {
        ServerSocket().use { socket ->
            socket.bind(InetSocketAddress(0))

            assertFalse(isTcpPortAvailable(socket.localPort))
        }
    }

    @Test
    fun tcpPortAvailabilityAcceptsFreePort() {
        val port = ServerSocket().use { socket ->
            socket.bind(InetSocketAddress(0))
            socket.localPort
        }

        assertTrue(isTcpPortAvailable(port))
    }
}
