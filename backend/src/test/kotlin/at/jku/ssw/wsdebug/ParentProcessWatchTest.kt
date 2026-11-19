package at.jku.ssw.wsdebug

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.file.Path
import java.util.concurrent.TimeUnit

/** How long the backend may take to notice that its parent ended; the JDK checks at most every 5 s. */
private const val BACKEND_EXIT_TIMEOUT_SECONDS = 20L
private const val BACKEND_START_TIMEOUT_MS = 30_000L

/**
 * Checks that the backend ends when the process that started it ends without any cleanup,
 * as when an IDE crashes or is killed. [FakeIde] stands in for the IDE.
 */
internal class ParentProcessWatchTest {
    @Test
    fun backendEndsWhenItsParentIsKilled() {
        val port = ServerSocket().use { socket ->
            socket.bind(InetSocketAddress(0))
            socket.localPort
        }
        val fakeIde = ProcessBuilder(javaCommand(FakeIde::class.java.name, port.toString()))
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        var backend: ProcessHandle? = null
        try {
            val backendPid = fakeIde.inputStream.bufferedReader().readLine()?.toLong()
                ?: error("the fake IDE did not report the backend's process id")
            backend = ProcessHandle.of(backendPid).orElseThrow()
            waitUntilListening(port)

            fakeIde.destroyForcibly()

            val backendEnded = backend.onExit().completeOnTimeout(null, BACKEND_EXIT_TIMEOUT_SECONDS, TimeUnit.SECONDS).get()
            assertTrue(backendEnded != null, "the backend still runs $BACKEND_EXIT_TIMEOUT_SECONDS s after its parent was killed")
            assertFalse(backend.isAlive)
            assertTrue(isTcpPortAvailable(port), "the backend's port $port is still in use")
        } finally {
            fakeIde.destroyForcibly()
            backend?.descendants()?.forEach { it.destroyForcibly() }
            backend?.destroyForcibly()
        }
    }

    private fun waitUntilListening(port: Int) {
        val deadline = System.currentTimeMillis() + BACKEND_START_TIMEOUT_MS
        while (System.currentTimeMillis() < deadline) {
            try {
                // Connecting instead of binding, so the probe cannot take the port from the starting backend.
                Socket("localhost", port).close()
                return
            } catch (_: IOException) {
                Thread.sleep(200)
            }
        }
        error("the backend did not start listening on port $port within $BACKEND_START_TIMEOUT_MS ms")
    }
}

/**
 * Stands in for an IDE: starts the backend on the port given as the only argument, prints the
 * backend's process id on the first line of standard output, and then waits until it is killed.
 */
internal object FakeIde {
    @JvmStatic
    fun main(args: Array<String>) {
        val backend = ProcessBuilder(javaCommand("at.jku.ssw.wsdebug.MainKt", args[0]))
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start()
        println(backend.pid())
        System.out.flush()
        Thread.sleep(Long.MAX_VALUE)
    }
}

/** Builds a command that runs [mainClass] in a new JVM with the same Java and class path as this one. */
private fun javaCommand(mainClass: String, vararg args: String): List<String> = listOf(
    Path.of(System.getProperty("java.home"), "bin", "java").toString(),
    "--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
    "--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED",
    "--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
    "-cp", System.getProperty("java.class.path"),
    mainClass,
) + args
