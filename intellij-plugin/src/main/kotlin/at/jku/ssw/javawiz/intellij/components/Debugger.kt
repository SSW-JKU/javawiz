package at.jku.ssw.javawiz.intellij.components

import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.app.JavaWizApplicationService
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import java.io.IOException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

class Debugger(project: Project) : Component(project) {
  var jar: Process? = null
  override var isRunning: Boolean = false
    get() = jar != null && jar!!.isAlive
  private var processBuilder: ProcessBuilder? = null
  override var readyFuture: CompletableFuture<Boolean> = CompletableFuture()

  var port = -1

  fun initProcessBuilder(debuggerPort: Int) {
    val command = listOf(
      "java",
      "--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED",
      "--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED",
      "--add-exports=jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED",
      "-jar",
      service<JavaWizApplicationService>().BACKEND_JAR_PATH,
      debuggerPort.toString()
    )

    processBuilder = ProcessBuilder(command)
    // processBuilder?.inheritIO() // This will redirect the output and error streams of the process to the console
    // alternative:
    processBuilder?.redirectOutput(ProcessBuilder.Redirect.PIPE)
    processBuilder?.redirectError(ProcessBuilder.Redirect.PIPE)
  }

  override fun start(port : Int): Boolean {
    this.port = port
    try {
      readyFuture = CompletableFuture<Boolean>()
      if (isRunning) stop()   // stop any leftover process before starting a new one
      initProcessBuilder(port)
      jar = processBuilder?.start()
      if (jar != null && isRunning) captureProcessOutput(jar!!)
      else throw IOException("Backend process could not be started")
      project.service<LoggerProjectService>()
        .log(LogSource.BACKEND, "Debugger is running at ${Globals.Props.HOST}:${port}")
      return true
    } catch (e: Exception) {
      e.printStackTrace()
      jar = null
      project.service<LoggerProjectService>().log(LogSource.BACKEND, "Error starting backend: $e")
      return false
    }
  }

  override fun stop(): Boolean {
    try {
      if (isRunning) {
        // MW: My Windows machine hangs when trying to close these streams, so I commented them out for now.
        // jar?.inputStream?.close()
        // jar?.errorStream?.close()
        // jar?.outputStream?.close()
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Stopping debugger process...")
        project.service<LoggerProjectService>().log(
          LogSource.BACKEND,
          "Debugger process has following children PIDs: ${jar?.children()?.map { it.pid() }?.toList()}"
        )
        project.service<LoggerProjectService>().log(
          LogSource.BACKEND,
          "Debugger process has following descendants PIDs: ${jar?.descendants()?.map { it.pid() }?.toList()}"
        )
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Killing all descendents...")
        jar?.descendants()?.forEach { processHandle ->
          processHandle.destroy()
        }
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Killing the backend process (pid ${jar?.pid()}) itself...")
        jar?.destroy()
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Wait for process end...")
        val exited = jar?.waitFor(Globals.Props.PROCESS_STOP_TIMEOUT_MS, TimeUnit.MILLISECONDS) ?: true
        if (!exited) {
          project.service<LoggerProjectService>().log(LogSource.BACKEND, "Process did not exit in time — forcing termination.")
          jar?.destroyForcibly()
          jar?.waitFor(Globals.Props.PROCESS_FORCE_STOP_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        }
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Debugger stopped.")
      } else {
        project.service<LoggerProjectService>().log(LogSource.BACKEND, "Debugger was not running.")
      }
      return true
    } catch (e: Exception) {
      project.service<LoggerProjectService>().log(LogSource.BACKEND, "Error when exiting the debugger.: $e")
      return false
    }
  }


  private fun captureProcessOutput(process: Process) {
    // Handle standard output
    Thread {
      process.inputStream.bufferedReader().use { reader ->
        reader.lineSequence().forEach { line ->
          project.service<LoggerProjectService>().log(LogSource.BACKEND, line)
          if (line.contains("confirming_start"))
            readyFuture.complete(true)
        }
      }
    }.start()

    // Handle error output
    Thread {
      process.errorStream.bufferedReader().use { reader ->
        reader.lineSequence().forEach { line ->
          project.service<LoggerProjectService>().log(LogSource.BACKEND, "[ERROR] $line")
        }
      }
    }.start()
  }
}
