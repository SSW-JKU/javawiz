package at.jku.ssw.javawiz.intellij.components

import at.jku.ssw.javawiz.intellij.general.ConsoleMessage
import at.jku.ssw.javawiz.intellij.general.FrontendMessage
import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.general.Response
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import java.time.Duration
import java.util.concurrent.CompletableFuture

// this must not be removed: import kotlinx.serialization.encodeToString
import kotlinx.serialization.encodeToString

// Help: https://ktor.io/docs/server-create-websocket-application.html
class Communication(project: Project) : Component(project) {
  override var isRunning: Boolean = false
  override var readyFuture: CompletableFuture<Boolean> = CompletableFuture()

  private lateinit var communicationServer: ApplicationEngine

  // Only the most-recent frontend connection is kept. Replacing the list with a
  // single reference eliminates stale-session writes and the "first vs. all"
  // ambiguity that existed with the previous synchronizedList approach.
  @Volatile private var activeSession: WebSocketServerSession? = null

  var port = -1

  override fun start(port: Int): Boolean {
    this.port = port
    try {
      readyFuture = CompletableFuture<Boolean>()
      if (isRunning) {
        stop()
      }
      initializeWebSocketServer(port)
      communicationServer.start(wait = false)
      return true
    } catch (e: Exception) {
      project.service<LoggerProjectService>()
        .log(LogSource.COMMUNICATION, "Error when exiting the server.: $e")
      return false
    }
  }

  override fun stop(): Boolean {

      if (isRunning) {
        val scope = CoroutineScope(Dispatchers.IO)

        // We cannot stop the server if we are currently in the process of answering a message.
        // For example, if we call .stop() while being in the process of answering a "compileError" message,
        // it would block indefinitely.
        // Thus, we start this in a coroutine, finish answering the request, and then the server is stopped.
        scope.launch {
          try {
            activeSession?.close(CloseReason(CloseReason.Codes.NORMAL, "JavaWiz stopped"))
            communicationServer.stop(100, 100)
          } catch (e: Exception) {
            project.service<LoggerProjectService>()
              .log(LogSource.COMMUNICATION, "Error when exiting the server.: $e")
          }
        }
      }
      return true
  }

  fun sendConsoleInput(project: Project, consoleInput: String) = runBlocking {
    val session = activeSession ?: return@runBlocking
    val response = ConsoleMessage(kind = "consoleInput", consoleInput = consoleInput)
    val jsonResponse = Json.encodeToString(response)
    try {
      session.send(Frame.Text(jsonResponse))
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Sent frame: $jsonResponse")
    } catch (e: Exception) {
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Failed to send frame, clearing stale session: $e")
      activeSession = null
    }
  }

  private fun initializeWebSocketServer(communicationPort: Int) {
    communicationServer = embeddedServer(Netty, port = communicationPort, module = fun Application.() {
      install(WebSockets.Plugin) {
        pingPeriod = Duration.ofSeconds(15)
        timeout = Duration.ofSeconds(15)
        maxFrameSize = Long.MAX_VALUE
        masking = false
      }

      routing {
        webSocket("/") { // WebSocket endpoint
          // Gracefully close any existing session before replacing it (last connection wins).
          val previous = activeSession
          if (previous != null && previous !== this) {
            project.service<LoggerProjectService>()
              .log(LogSource.COMMUNICATION, "New connection received — closing previous session.")
            try {
              previous.close(CloseReason(CloseReason.Codes.NORMAL, "Replaced by new connection"))
            } catch (e: Exception) {
              project.service<LoggerProjectService>()
                .log(LogSource.COMMUNICATION, "Error closing previous session: $e")
            }
          }
          activeSession = this
          project.service<LoggerProjectService>().log(
            LogSource.COMMUNICATION,
            "Connected to Frontend Websocket server at ${Globals.Props.HOST}:${communicationPort}"
          )

          // Listen for incoming frames
          try {
            for(frame in incoming) {
              val jsonText = (frame as Frame.Text).readText()

              // log received frames (for debugging purposes)
              project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Received frame: $jsonText")

              // handle frames
              try {
                // Parse the incoming JSON text to FrontendMessage -> if the format is wrong, skip it
                // Wrong format could be caused by a confirmation message from the frontend (e.g.: change console history)
                val frontendMessage = Json.decodeFromString<FrontendMessage>(jsonText)
                val response = processFrontendMessage(frontendMessage)
                send(Frame.Text(response))

                // Log the sent frame (for debugging purposes)
                project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Sent frame: $response")
              } catch (e: Exception) {
                project.service<LoggerProjectService>()
                  .log(LogSource.COMMUNICATION, "Message could not be parsed: $e")
              }
            }
          // TODO: calling.stop in endDebug() does not proceed to here. Neither any of the catch blocks, nor the
          // finally part...
          } catch (e: ClosedReceiveChannelException) {
              project.service<LoggerProjectService>()
                .log(LogSource.COMMUNICATION, "WebSocket channel closed: $e")
              if (activeSession === this) {
                activeSession = null
                project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "No active WebSocket connections.")
                project.service<JavaWizProjectService>().endDebug()
              }
          } catch (e: Throwable) {
            project.service<LoggerProjectService>()
              .log(LogSource.COMMUNICATION, "Error in WebSocket channel: $e")
            if (activeSession === this) {
              activeSession = null
              project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "No active WebSocket connections.")
              project.service<JavaWizProjectService>().endDebug()
            }
          } finally {
            project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "End of WebSocket handler reached")
          }
        }
      }
    })

    communicationServer.environment.monitor.subscribe(ApplicationStopped) {
      isRunning = false
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Communication server stopped.")
    }

    communicationServer.environment.monitor.subscribe(ApplicationStarted) {
      isRunning = true
      readyFuture.complete(true)
      project.service<LoggerProjectService>()
        .log(LogSource.COMMUNICATION, "Communication server is running at ${Globals.Props.HOST}:${communicationPort}")
    }
  }

  /**
   * returns a Frame to the client which has to be sent, otherwise the default response is sent
   */
  private fun processFrontendMessage(message: FrontendMessage): String {
    // create default Responses
    val defaultResponseFailed = Json.encodeToString(
      Response(
        message = message,
        result = Globals.Strings.MESSAGE_RESULT_FAILED
      )
    )
    val defaultResponseSuccess = Json.encodeToString(
      Response(
        message = message,
        result = Globals.Strings.MESSAGE_RESULT_SUCCESS
      )
    )
    var response: String? = null

    try {
      when (message.kind) {
        Globals.Strings.MESSAGE_KIND_HIGH_LINE -> project.service<JavaWizProjectService>()
          .highlightLine(message.line ?: return defaultResponseFailed, message.uri ?: return defaultResponseFailed)

        Globals.Strings.MESSAGE_KIND_HOVER_LINE -> project.service<JavaWizProjectService>()
          .hoverLine(message.line ?: return defaultResponseFailed)

        Globals.Strings.MESSAGE_KIND_GET_FILE_CONTENTS -> response =
          project.service<JavaWizProjectService>().getFileContents(message)

        Globals.Strings.MESSAGE_KIND_CONSOLE_ENABLED -> project.service<JavaWizProjectService>()
          .setWritingEnabled(message.consoleEnabled ?: false)

        Globals.Strings.MESSAGE_KIND_CHANGE_HISTORY -> {
          project.service<JavaWizProjectService>().clearConsoleHistory()

          val history = message.newConsoleHistory
            ?: return defaultResponseFailed // "true" required on initialization (where size is 0)
          project.service<JavaWizProjectService>().changeConsoleHistory(history)
        }

        Globals.Strings.MESSAGE_KIND_NOTIFICATION -> {
          if (project.service<JavaWizProjectService>().isJavaWizRunning) { // suppress disconnected error during shutdown
            project.service<JavaWizProjectService>().showInformationMessage(
              message.type ?: return defaultResponseFailed,
              message.message ?: return defaultResponseFailed
            )
          }
        }

        Globals.Strings.MESSAGE_KIND_COMPILE_ERROR -> {
          project.service<JavaWizProjectService>().changeConsoleHistory(message.message ?: return defaultResponseFailed)
          project.service<JavaWizProjectService>().endDebug()
        }
      }
    } catch (e: Exception) {
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Error receiving frame: $e")
      return defaultResponseFailed
    }

    if (response != null) {
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Sending response: $response")
    } else {
      project.service<LoggerProjectService>().log(LogSource.COMMUNICATION, "Sending standard success response")
    }

    return response ?: defaultResponseSuccess
  }
}