package at.jku.ssw.javawiz.intellij.service.project

import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.app.JavaWizApplicationService
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import java.io.File
import java.io.FileWriter
import java.nio.file.Paths
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

enum class LogSource {
  PLUGIN,
  ACTION,
  BACKEND,
  FRONTEND,
  COMMUNICATION
}

@Service(Service.Level.PROJECT)
class LoggerProjectService(val project: Project) {
  val logDir: File

  init {
    val formatter = DateTimeFormatter.ofPattern(" yyyy-MM-dd HH-mm-ss")
    logDir = Paths.get(
      service<JavaWizApplicationService>().TEMP_DIR_PATH,
      Globals.Props.LOG,
      project.name + LocalDateTime.now().format(formatter)
    ).toFile()
    logDir.mkdirs()
  }

  val pluginLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_PLUGIN).toFile().apply { createNewFile() }
  val actionLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_ACTION).toFile().apply { createNewFile() }
  val backendLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_BACKEND).toFile().apply { createNewFile() }
  val frontendLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_FRONTEND).toFile().apply { createNewFile() }
  val communicationLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_COMMUNICATION).toFile().apply { createNewFile() }
  val generalLogFile =
    Paths.get(logDir.absolutePath, Globals.Props.LOG_FILE_NAME_GENERAL).toFile().apply { createNewFile() }

  // use a logging framework in the future
  fun log(logSource: LogSource, message: String) {
    if (!Globals.Props.LOG_ENABLED) return

    // Start Logging
    val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    val stackTrace = Thread.currentThread().stackTrace
    fun stackTraceText() =
      stackTrace.drop(1).joinToString(" <- ") { it.className.substringAfter(".") + "::" + it.methodName }

    val timestamp = LocalDateTime.now().format(formatter)
    val csvLine =
      "\"$timestamp\"" + Globals.Props.LOG_DELIMITER +
              "\"${message.replace("\"", "\"\"")}\"" + Globals.Props.LOG_DELIMITER // +
              // "\"${stackTraceText()}\"" + Globals.Props.LOG_DELIMITER

    val logFilePath = when (logSource) {
      LogSource.PLUGIN -> pluginLogFile
      LogSource.ACTION -> actionLogFile
      LogSource.BACKEND -> backendLogFile
      LogSource.FRONTEND -> frontendLogFile
      LogSource.COMMUNICATION -> communicationLogFile
    }.absolutePath
    // Write to a general log file
    FileWriter(
      generalLogFile,
      true
    ).append("[$logSource]${Globals.Props.LOG_DELIMITER}$csvLine\n")

    if (logFilePath != null) {
      // Write to a specific log file
      FileWriter(logFilePath, true).append("$csvLine\n")
    }

    // Write to the console
    println("[$logSource]: $csvLine")
  }
}

/*
else {
val path = Paths.get(
Globals.Paths.TEMP_DIR_PATH,
Globals.Props.LOG,
"general.log"
)

// Ensure the directory exists
Files.createDirectories(path.parent)
logFilePathGeneral = path.absolutePathString()
}
 */