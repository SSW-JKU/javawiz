package at.jku.ssw.javawiz.intellij.components

import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.app.JavaWizApplicationService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import at.jku.ssw.javawiz.intellij.toolwindows.JWToolWindowPanel
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import java.util.concurrent.CompletableFuture

class Frontend(project: Project) : Component(project) {
  // Http Server Information
  private lateinit var httpServer: ApplicationEngine
  override var isRunning: Boolean = false
  override var readyFuture: CompletableFuture<Boolean> = CompletableFuture()

  var port = -1

  override fun start(port: Int): Boolean {
    this.port = port
    try {
      readyFuture = CompletableFuture<Boolean>()
      if (isRunning) stop()
      initializeHttpServer(port)
      project.service<LoggerProjectService>()
        .log(LogSource.FRONTEND, "Starting frontend server on thread ${Thread.currentThread().name} ...")
      httpServer.start(wait = false)
      return true
    } catch (e: Exception) {
      project.service<LoggerProjectService>().log(LogSource.FRONTEND, "[ERROR] Error starting server: $e")
      return false
    }
  }

  override fun stop(): Boolean {
    try {
      if (isRunning) {
        httpServer.stop(100, 100)
      }
      return true
    } catch (e: Exception) {
      project.service<LoggerProjectService>()
        .log(LogSource.FRONTEND, "[ERROR] Error when exiting the server: $e")
      return false
    }
  }

  // Initialize the HTTP server
  private fun initializeHttpServer(frontEndPort: Int) {
    httpServer = embeddedServer(Netty, port = frontEndPort, module = fun Application.() {
      routing {
        project.service<LoggerProjectService>()
          .log(
            LogSource.FRONTEND,
            "Configuring to serve frontend from path ${service<JavaWizApplicationService>().JAVAWIZ_FRONTEND_URL_PATH} on port $port ..."
          )
        singlePageApplication { vue(service<JavaWizApplicationService>().JAVAWIZ_FRONTEND_URL_PATH) }
        get(Globals.Props.FRONTEND_ENDPOINT_STATUS) {
          call.respondText { "working fine..." }
        }
      }
    })

    httpServer.environment.monitor.subscribe(ApplicationStopped) {
      isRunning = false
      project.service<LoggerProjectService>().log(LogSource.FRONTEND, "Frontend server stopped.")
    }

    httpServer.environment.monitor.subscribe(ApplicationStarted) {
      isRunning = true
      readyFuture.complete(true)
      project.service<LoggerProjectService>()
        .log(LogSource.FRONTEND, "Frontend server is running at ${Globals.Props.HOST}:${frontEndPort}")

      // Refresh the browser to show the frontend
      val frontendToolWindowPanel = ToolWindowManager.getInstance(project)
        .getToolWindow(Globals.Props.GUI_FRONTEND_TOOLWINDOWID)
        ?.contentManager?.contents?.get(0)?.component as? JWToolWindowPanel
      frontendToolWindowPanel?.extensionModeFrontend()
    }
  }
}