package at.jku.ssw.javawiz.intellij.toolwindows

import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.app.JavaWizApplicationService
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.CefSettings
import org.cef.browser.CefBrowser
import org.cef.handler.CefDisplayHandlerAdapter

class JWToolWindowPanel(val project: Project) : SimpleToolWindowPanel(true) {
  // Initialize JCEF
  val cefClient = JBCefApp.getInstance().createClient()
  val browser = JBCefBrowser.createBuilder()
    .setClient(cefClient)
    .setUrl(service<JavaWizApplicationService>().DEFAULT_FRONTEND_URL_PATH)
    .build()

  init {
    cefClient.addDisplayHandler(object : CefDisplayHandlerAdapter() {
      override fun onStatusMessage(browser: CefBrowser?, value: String?) {
        project.service<LoggerProjectService>().log(LogSource.FRONTEND, "Browser Status Message: $value")
      }

      override fun onConsoleMessage(
        browser: CefBrowser,
        level: CefSettings.LogSeverity,
        message: String,
        source: String,
        line: Int
      ): Boolean {
        project.service<LoggerProjectService>().log(LogSource.FRONTEND, "Browser Console Message: $message")
        return false
      }
    }, browser.cefBrowser)

    setContent(browser.component)
    defaultFrontend()
  }

  fun defaultFrontend() {
    refreshFrontend(service<JavaWizApplicationService>().DEFAULT_FRONTEND_URL_PATH)
  }

  fun extensionModeFrontend() {
    refreshFrontend(buildJavaWizExtensionModeURL())
  }

  private fun refreshFrontend(url: String) {
    project.service<LoggerProjectService>().log(LogSource.FRONTEND, "Refreshing browser with URL: $url")
    ApplicationManager.getApplication().invokeLater {
      browser.loadURL(url)
    }
  }

  private fun buildJavaWizExtensionModeURL(): String {
    val frontendPort = project.service<JavaWizProjectService>().frontendPort
    val communicationPort = project.service<JavaWizProjectService>().communicationPort
    val debuggerPort = project.service<JavaWizProjectService>().debuggerPort
    return "${Globals.Props.HOST}:$frontendPort${Globals.Props.FRONTEND_ENDPOINT_ROOT}extensionMode${communicationPort};${debuggerPort}"
  }
}

class JavaWizToolWindowFactory : ToolWindowFactory {
  /**
   * https://intellij-support.jetbrains.com/hc/en-us/community/posts/360010449220-Intellij-Plugin-Development-Display-of-Web-Application-in-a-Panel-within-Intellij
   * https://intellij-support.jetbrains.com/hc/en-us/community/posts/15757368630418-how-to-Open-the-web-page-in-the-file-editor-position-
   */
  override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
    toolWindow.setIcon(Globals.GUI.GUI_ICON_RUN)
    toolWindow.setTitleActions(
      listOf(ActionManager.getInstance().getAction(Globals.Props.ACTION_ID_RUN))
    )

    // Initialize ToolWindow Listener
    setUpToolWindowListener(project, toolWindow)

    // Add the browser to the tool window
    val panel = JWToolWindowPanel(project)
    toolWindow.contentManager.addContent(
      ContentFactory.getInstance().createContent(panel, Globals.Props.FRONTEND_TABNAME, false)
    )

    // Open the CEF Dev Tools window if enabled (embedded devtools panel removed in JCEF 2026+)
    if (Globals.Props.USE_DEV_TOOLS) {
      panel.browser.cefBrowser.openDevTools()
    }
  }

  private fun setUpToolWindowListener(project: Project, toolWindow: ToolWindow) {
    project.messageBus.connect().subscribe(ToolWindowManagerListener.TOPIC, object : ToolWindowManagerListener {
      // This is "experimental and internal", but let's hope for the best
      override fun stateChanged(
        toolWindowManager: ToolWindowManager,
        toolWindow: ToolWindow,
        changeType: ToolWindowManagerListener.ToolWindowManagerEventType
      ) {
        when (changeType) {
          ToolWindowManagerListener.ToolWindowManagerEventType.HideToolWindow -> {
            project.service<LoggerProjectService>()
              .log(LogSource.FRONTEND, "Tool window [${toolWindow.title}] hidden -> Stop debugging")
            project.service<JavaWizProjectService>().endDebug()
          }

          else -> project.service<LoggerProjectService>()
            .log(LogSource.FRONTEND, "Tool window [${toolWindow.title}] event: $changeType")
        }
      }
    })
  }
}
