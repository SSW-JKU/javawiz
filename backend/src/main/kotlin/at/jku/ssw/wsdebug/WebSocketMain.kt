package at.jku.ssw.wsdebug

import at.jku.ssw.wsdebug.communication.DebugWebSocketServer
import at.jku.ssw.wsdebug.logging.TeeStream
import kotlinx.coroutines.runBlocking
import java.io.PrintStream
import java.net.BindException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import kotlin.io.path.createDirectories
import kotlin.io.path.createFile
import kotlin.io.path.notExists
import kotlin.io.path.outputStream


private const val DEFAULT_PORT = 51234
private const val STARTUP_TIMEOUT_SECONDS = 5L

internal fun parseWebSocketPort(args: Array<String>): Int {
    return if (args.isNotEmpty()) {
        try {
            Integer.parseInt(args[0])
        } catch (e: NumberFormatException) {
            println("could not parse the port specified in the arguments, proceeding on default port")
            DEFAULT_PORT
        }
    } else {
        DEFAULT_PORT
    }
}

internal fun isTcpPortAvailable(port: Int): Boolean {
    return try {
        ServerSocket().use { socket ->
            socket.reuseAddress = false
            socket.bind(InetSocketAddress(port))
        }
        true
    } catch (ex: BindException) {
        false
    }
}

fun runWithWebSocket(args: Array<String>) {
    runBlocking { // not yet needed, but using this we could run coroutines in the future
        try {
            val homeDir = System.getProperty("user.home")

            val dateString = SimpleDateFormat("yyyyMMdd").format(Date())
            val stdoutLogFile = Path.of(homeDir, ".javawiz", "stdout_$dateString.log")
            if (stdoutLogFile.notExists()) {
                stdoutLogFile.parent.createDirectories()
                stdoutLogFile.createFile()
            }
            val stdoutLogStream = PrintStream(stdoutLogFile.outputStream(StandardOpenOption.APPEND), true)
            val stderrLogFile = Path.of(homeDir, ".javawiz", "stderr_$dateString.log")
            if (stderrLogFile.notExists()) {
                stderrLogFile.parent.createDirectories()
                stderrLogFile.createFile()
            }
            val stderrLogStream = PrintStream(stderrLogFile.outputStream(StandardOpenOption.APPEND), true)

            val stdoutTeeStream: PrintStream = TeeStream(System.out, stdoutLogStream)
            val stderrTeeStream: PrintStream = TeeStream(System.err, stderrLogStream)

            System.setOut(stdoutTeeStream)
            System.setErr(stderrTeeStream)

            println("Java information:")
            neon.jvm.printJavaInformation()

            val port = parseWebSocketPort(args)
            if (!isTcpPortAvailable(port)) {
                System.err.println("Cannot start JavaWiz backend: port $port is already in use.")
                System.err.println("Stop the process currently listening on port $port and start the backend again.")
                return@runBlocking
            }

            println("Websocket Debugger starting on port: $port")
            val startupFinished = CountDownLatch(1)
            val startupFailure = AtomicReference<Exception?>(null)
            val websocketServer = DebugWebSocketServer(
                InetSocketAddress(port),
                onStarted = { startupFinished.countDown() },
                onStartupFailure = { ex ->
                    startupFailure.set(ex)
                    startupFinished.countDown()
                }
            )
            websocketServer.start()
            if (!startupFinished.await(STARTUP_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                System.err.println("Cannot confirm JavaWiz backend startup on port $port within $STARTUP_TIMEOUT_SECONDS seconds.")
                websocketServer.stop()
                return@runBlocking
            }
            startupFailure.get()?.let { ex ->
                System.err.println("Cannot start JavaWiz backend on port $port: ${ex.message}")
                return@runBlocking
            }

            println("Start")

            Runtime.getRuntime().addShutdownHook(Thread {
                println("[Shutdown Hook] trying to stop websocket server")
                websocketServer.stop()
            })

            thread {
                // try {
                // Graceful shutdown by entering something in console
                while (readln().isEmpty()) {
                }
                // } catch(ex: Exception) {
                //     System.err.println("Encountered an error while waiting for console shutdown signal")
                // }
                println("[Console Input] trying to stop websocket server")
                websocketServer.stop()

            }
        } catch (ex : Exception) {
            System.err.println(ex.asSingleLineStringWithStackTrace())
        }
    }
    println("runBlocking completed")
}
