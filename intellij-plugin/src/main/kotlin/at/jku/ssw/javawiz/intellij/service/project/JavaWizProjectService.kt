package at.jku.ssw.javawiz.intellij.service.project

// this must not be removed!
import at.jku.ssw.javawiz.intellij.components.Communication
import at.jku.ssw.javawiz.intellij.components.Component
import at.jku.ssw.javawiz.intellij.components.Debugger
import at.jku.ssw.javawiz.intellij.components.Frontend
import at.jku.ssw.javawiz.intellij.general.*
import at.jku.ssw.javawiz.intellij.service.app.JavaWizApplicationService
import at.jku.ssw.javawiz.intellij.toolwindows.InputListener
import at.jku.ssw.javawiz.intellij.toolwindows.JWToolWindowPanel
import at.jku.ssw.javawiz.intellij.toolwindows.TerminalToolWindowPanel
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.ide.projectView.ProjectView
import com.intellij.ide.projectView.impl.AbstractProjectViewPane
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.ex.EditorEventMulticasterEx
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.MarkupModel
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.project.BaseProjectDirectories.Companion.getBaseDirectories
import com.intellij.openapi.project.Project
import com.intellij.openapi.roots.ProjectRootManager
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.psi.PsiClass
import com.intellij.psi.PsiFileSystemItem
import kotlinx.serialization.json.Json
import java.io.IOException
import java.net.ServerSocket
import java.util.concurrent.TimeUnit

// this must not be removed: import kotlinx.serialization.encodeToString
import kotlinx.serialization.encodeToString

// Useful manager calls
// WindowManager.getInstance().getFrame(project)
// WindowManager.getInstance().getStatusBar(project)
// WindowManager.getInstance().getIdeFrame(project)
// ...
// ApplicationManager.getApplication().getService<>()
// ApplicationManager.getApplication().invokeAndWait {  }
// ...
// ToolWindowManager.getInstance(project).getToolWindow(id)
// ProjectManager.getInstance().openProjectsProjectManager.getInstance().openProjects

// Get via project.service<JavaWizProjectService>()
@Service(Service.Level.PROJECT)
class JavaWizProjectService(private val project: Project) : Disposable {
  init {
    // Every time a first use the project service, we access the global application service (which is responsible for JAR extraction)
    // This ensures that the temp dir with all files is created
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Initializing project service, accessing temp dir")
    service<JavaWizApplicationService>().printTempDir()
  }

  // components
  val communication = Communication(project)
  val debugger = Debugger(project)
  val frontend = Frontend(project)

  // gui
  val frontendToolWindow: ToolWindow by lazy {
    ToolWindowManager.getInstance(project).getToolWindow(Globals.Props.GUI_FRONTEND_TOOLWINDOWID)
      ?: error("[ERROR] Frontend ToolWindow not found")
  }

  val frontendToolWindowPanel: JWToolWindowPanel by lazy {
    frontendToolWindow.contentManager.contents[0].component as JWToolWindowPanel
  }
  val terminalToolWindow: ToolWindow by lazy {
    ToolWindowManager.getInstance(project).getToolWindow(Globals.Props.GUI_TERMINAL_TOOLWINDOWID)
      ?: error("[ERROR] Terminal ToolWindow not found")
  }
  val terminalToolWindowPanel: TerminalToolWindowPanel by lazy {
    (terminalToolWindow.contentManager.contents[0].component as TerminalToolWindowPanel).also {
      // Initialize input listener on first access to terminalToolWindowPanel (lazy init)
      it.addInputListener(InputListener { input ->
        communication.sendConsoleInput(project, input)
      })
    }
  }

  val isJavaWizRunning: Boolean
    get() = frontend.isRunning && debugger.isRunning && communication.isRunning

  var connectionInitialized: Boolean = false

  // Guard against re-entrant endDebug() calls.
  // communication.stop() can trigger the WebSocket session's finally-block, which calls
  // endDebug() again. The flag prevents a redundant concurrent shutdown.
  @Volatile
  private var isShuttingDown: Boolean = false

  var frontendPort = -1
  var communicationPort = -1
  var debuggerPort = -1

  // project files
  private val projectBaseDir: VirtualFile? = project.getBaseDirectories().firstOrNull()

  private val stopDebugOnDocumentChangeListener = object : DocumentListener {
    override fun documentChanged(event: DocumentEvent) {
      project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Document changed: ${event.document} --> JavaWiz endDebug")
      if (isJavaWizRunning) {
        endDebug()
      }
    }
  }

  init {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "JavaWizProjectService initialized")
  }

  //-------------------------------------------------
  // Public Methods
  //-------------------------------------------------
  fun startDebug(callback: () -> Unit) {
    attachDocumentListeners()

    findAvailablePorts()

    startGUIFrontend(project)
    startGUITerminal(project)
    runJavaWiz(callback)
  }

  fun endDebug(callback: () -> Unit = {}) {
    // Prevent re-entrant calls: communication.stop() can trigger the WebSocket session's
    // finally-block, which calls endDebug() again. Guard here to avoid redundant shutdowns.
    if (isShuttingDown) {
      project.service<LoggerProjectService>().log(LogSource.PLUGIN, "endDebug() skipped — shutdown already in progress.")
      return
    }
    isShuttingDown = true

    if (!(isJavaWizRunning || debugger.isRunning || communication.isRunning || frontend.isRunning)) {
      project.service<LoggerProjectService>().log(LogSource.PLUGIN, "No active debug session to end.")
      isShuttingDown = false
      return
    }

    try {
      endDebugImpl(callback)
    } finally {
      isShuttingDown = false
    }
  }

  private fun endDebugImpl(callback: () -> Unit = {}) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "endDebug() called")
    try {
      // correct connection state
      connectionInitialized = false

      // Stop all components regardless of whether all three were fully started —
      // this ensures cleanup even after a partial startup failure.
      // Order mirrors the VSCode extension: backend first, frontend second,
      // communication last. Stopping communication last means the WebSocket
      // session's finally-block fires only after everything else is already
      // torn down, so the re-entrant endDebug() call it triggers is harmlessly
      // ignored by the isShuttingDown guard.
      debugger.stop()
      frontend.stop()
      communication.stop()

      // Reset port assignments so stale values are never visible after session end
      frontendPort = -1
      communicationPort = -1
      debuggerPort = -1

      // UI teardown must happen on the EDT
      ApplicationManager.getApplication().invokeAndWait {
        removeHighlights(project)
        // Reset the plugin gui windows
        frontendToolWindowPanel.defaultFrontend()
        frontendToolWindow.hide(null)
        terminalToolWindow.hide(null)
      }

      // Notify the user
      callback()

      // Log the end of the debug session
      project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Debug session ended successfully.")

    } catch (e: Exception) {
      project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Error while ending debug session: $e")
    }
  }

  //-------------------------------------------------
  // private methods for startup
  //-------------------------------------------------
  private fun attachDocumentListeners() {
    // Add Listeners (Help: https://intellij-support.jetbrains.com/hc/en-us/community/posts/4578776718354-How-do-I-listen-for-editor-focus-events)
    val multicaster = EditorFactory.getInstance().eventMulticaster
    if (multicaster is EditorEventMulticasterEx) {
      // remove if already attached
      multicaster.removeDocumentListener(stopDebugOnDocumentChangeListener)
      // (re-)attach
      multicaster.addDocumentListener(stopDebugOnDocumentChangeListener, this)
    }
  }

  // opens the frontend GUI and then executes startGUITerminal()
  private fun startGUIFrontend(project: Project, callback: () -> Unit = {}) {
    ApplicationManager.getApplication().invokeAndWait {
      // MW: The following line does not work on my machine, the alternative splitting into two statements does work
      // frontendToolWindow.activate({ startGUITerminal(project, callback) }, true)

      frontendToolWindow.activate(null, true)
    }
  }

  // opens the terminal GUI and then executes runJavaWiz()
  private fun startGUITerminal(project: Project, callback: () -> Unit = {}) {
    ApplicationManager.getApplication().invokeAndWait {
      // MW: The following line does not work on my machine, the alternative splitting into two statements does work
      // guiTerminalToolWindow?.activate({ runJavaWiz(project, callback) }, false)

      terminalToolWindow.activate(null, true)
    }
  }

  // starts the JavaWiz components and refreshes the frontend
  private fun runJavaWiz(callback: () -> Unit = {}) {
    ApplicationManager.getApplication().invokeAndWait {
      startComponent(communication, communicationPort) ?: callback()
      startComponent(debugger, debuggerPort) ?: callback()
      startComponent(frontend, frontendPort) ?: callback()
    }
    callback()
  }

  private fun startComponent(component: Component, port: Int): Boolean? {
    component.start(port)
    try {
      component.readyFuture.get(Globals.Props.TIMEOUT_DURATION_MS, TimeUnit.MILLISECONDS)
      project.service<LoggerProjectService>()
        .log(LogSource.PLUGIN, "${component.javaClass.simpleName} started successfully.")
      return true
    } catch (e: Exception) {
      project.service<LoggerProjectService>()
        .log(LogSource.PLUGIN, "[ERROR] ${component.javaClass.simpleName} could not be started in time: $e")
      endDebug()
      return null
    }
  }

  private fun afterStartupFinished() {
    // correct connection state
    connectionInitialized = true

    // finished!
    project.service<LoggerProjectService>()
      .log(LogSource.PLUGIN, "startup process finished, first highlight line received, JavaWiz is running.")
  }

  //-------------------------------------------------
  // Private Methods
  //-------------------------------------------------

  private fun getProjectFiles(): Map<String, VirtualFile> {
    val projectFiles : MutableMap<String, VirtualFile> = mutableMapOf()

    // Initialize Project Files Map
    val roots =
      ProjectRootManager.getInstance(project).contentRoots // TODO: check how this is different from projectBaseDir (which is currently unused?)
    for (root in roots) {
      collectJavaFiles(root, root, projectFiles)
    }

    return projectFiles
  }

  private fun collectJavaFiles(root: VirtualFile, file: VirtualFile, projectFiles: MutableMap<String, VirtualFile>) {
    if (file.isDirectory) {
      @Suppress("UnsafeVfsRecursion")
      file.children.forEach { collectJavaFiles(root, it, projectFiles) }
    } else if (file.extension in Globals.Props.DEBUGABLE_EXTENSION) {
      val localUri = VfsUtilCore.getRelativePath(file, root) ?: file.name
      projectFiles[localUri] = file
    }
  }

  private fun setPorts(project: Project, value: IntArray?): Boolean {
    if (value == null || value.size != 3) return false

    frontendPort = value[0]
    communicationPort = value[1]
    debuggerPort = value[2]

    return true
  }

  private fun findAvailablePorts() {
    // Scan sequentially from STARTPORT. Each candidate port is probed by opening a
    // ServerSocket — if it succeeds the socket is kept open (not closed immediately)
    // so no other process can claim it between the probe and the Ktor bind.
    // All three sockets are released together just before setPorts() hands the port
    // numbers to the components, minimising the remaining TOCTOU window to a
    // near-zero back-to-back close/bind on the same machine.
    var currentPort = Globals.Props.STARTPORT
    val sockets = mutableListOf<ServerSocket>()

    try {
      while (sockets.size < 3) {
        try {
          sockets.add(ServerSocket(currentPort))
          project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Port $currentPort is available.")
        } catch (e: IOException) {
          project.service<LoggerProjectService>()
            .log(LogSource.PLUGIN, "Port $currentPort already in use, trying next port. ($e)")
        }
        currentPort++
      }
      val ports = intArrayOf(sockets[0].localPort, sockets[1].localPort, sockets[2].localPort)
      sockets.forEach { it.close() }
      setPorts(project, ports)
    } catch (e: Exception) {
      sockets.forEach { runCatching { it.close() } }
      project.service<LoggerProjectService>()
        .log(LogSource.PLUGIN, "[ERROR] Could not find available ports: $e")
      e.printStackTrace()
    }
  }

  private fun removeHighlights(project: Project) {
    for ((_, file) in getProjectFiles()) {
      val editors = FileEditorManager.getInstance(project).getEditors(file)
      for (editor in editors) {
        if (editor is TextEditor) {
          val markupModel: MarkupModel = editor.editor.markupModel
          markupModel.removeAllHighlighters()
        }
      }
    }
  }

  private fun setFocusToToolWindow(toolWindow: ToolWindow) {
    ApplicationManager.getApplication().invokeAndWait {
      toolWindow.activate(null, true, true)
    }
  }

  //-------------------------------------------------
  // Handle Frontend Requests
  //-------------------------------------------------
  fun highlightLine(aLineNumber: Int, filePath: String) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Highlighting line: $aLineNumber in file: $filePath")
    val entry = getProjectFiles()[filePath.replace("\"", "")] ?: return

    val fileManager = FileEditorManager.getInstance(project)
    ApplicationManager.getApplication().invokeAndWait { // Ensure this runs on the EDT - else it throws an exception
      val editors = fileManager.openFile(entry, true)// fileManager.getEditors(entry)
      for (editor in editors) {
        if (editor is TextEditor) {
          val markupModel: MarkupModel = editor.editor.markupModel
          markupModel.removeAllHighlighters()
          markupModel.addLineHighlighter(
            aLineNumber - 1, // 0 is the first line
            HighlighterLayer.SELECTION,
            Globals.GUI.EDITOR_TEXTATTR_EXEC
          )
        }
      }

      // set Focus to JavaWiz Tool Windows
      setFocusToToolWindow(frontendToolWindow)
    }

    // Update the connectionInitialized state once we receive the first "highlight line" request after a new start
    if (isJavaWizRunning && !connectionInitialized) afterStartupFinished()
  }

  fun hoverLine(aLineNumber: Int) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Hovering line: $aLineNumber")
  }

  fun setWritingEnabled(enabled: Boolean) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Setting writing enabled: $enabled")
    terminalToolWindowPanel.isWritingEnabled = enabled
    // set the focus to the right tool window
    setFocusToToolWindow(if (enabled) terminalToolWindow else frontendToolWindow)

    /* This was a non-perfect prototype for a real terminal,
    // according to CoPilot, we need to invoke this on the EDT
    /* Copilot Comment:
        Your plugin likely gets unloaded because setWritingEnabled accesses
        the Terminal API (TerminalToolWindowManager) from a coroutine or
        background thread, and the terminal widget is created asynchronously
        on the Event Dispatch Thread (EDT). If the coroutine resumes before
        the terminal is initialized, or if an exception occurs
        (e.g., accessing UI from the wrong thread), the plugin system may
        treat this as a critical error and unload your plugin.
     */
    invokeLater{
            val terminalToolWindowManager = getTerminalManagerTool()
            var terminal = getTerminal(terminalToolWindowManager)
            if (terminal == null) {
                terminal = terminalToolWindowManager.createShellWidget(
                        projectBaseDir.toString(),
                        Constants.PLUGIN_NAME,
                        true,
                        true)
            }
        }
     */
  }

  fun changeConsoleHistory(history: List<ConsoleHistoryItem>) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Changing console history")
    terminalToolWindowPanel.setHistory(history)
  }

  fun changeConsoleHistory(text: String) {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Changing console history (plain text)")
    terminalToolWindowPanel.setHistory(listOf(at.jku.ssw.javawiz.intellij.general.ConsoleHistoryItem(
      input = "", output = text.replace("\\n", "\n"), error = ""
    )))
  }

  fun clearConsoleHistory() {
    terminalToolWindowPanel.setHistory(emptyList())
    /* This was a non-perfect prototype for a real terminal
    ApplicationManager.getApplication().invokeAndWait {
            val terminalToolWindowManager = getTerminalManagerTool()
            var terminal = getTerminal(terminalToolWindowManager)
            if (terminal != null) {
                terminal.sendCommandToExecute("clear")
            }
        }
     */
  }

  fun showInformationMessage(type: String, message: String) {
    val notificationType = when (type) {
      "information" -> NotificationType.INFORMATION
      "warning" -> NotificationType.WARNING
      "error" -> NotificationType.ERROR
      else -> NotificationType.INFORMATION
    }

    Notifications.Bus.notify(
      Notification(
        Globals.Props.NOTIFICATION_GROUPID,
        Globals.Props.NOTIFICATION_TITLE,
        message,
        notificationType
      )
    )

    setFocusToToolWindow(frontendToolWindow)
  }

  fun getFileContents(message: FrontendMessage): String {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "Getting all files with content")

    // map the result from DEBUGGABLE_EXTENSION to FileContent
    // Prefer unsaved editor content over the content on disk
    val fileEditorManager = FileEditorManager.getInstance(project)
    val fileContents = getProjectFiles().map { (localUri, file) ->
      val document = fileEditorManager.getEditors(file)
        .filterIsInstance<TextEditor>()
        .firstOrNull()
        ?.editor
        ?.document
      val content = document?.text ?: VfsUtilCore.loadText(file)
      FileContent(localUri, content)
    }

    // create the response (this must match the *exact* expected format in the frontend)!!!!
    val response = ResponseData(
      message = message, //Message(Constants.Strings.MESSAGE_KIND_FILE_CONTENT),
      result = Globals.Strings.MESSAGE_RESULT_SUCCESS,
      data = GetFileContentsData(fileContents, run {
        val selectedFile = FileEditorManager.getInstance(project).selectedFiles.firstOrNull()
          ?: getSelectedProjectViewFile()
        val roots = ProjectRootManager.getInstance(project).contentRoots
        selectedFile?.let { f -> roots.firstNotNullOfOrNull { root -> VfsUtilCore.getRelativePath(f, root) } }
          ?: selectedFile?.name
          ?: ""
      })
    )

    // parse to JSON and send it to the client
    return Json.encodeToString(response)
  }

  private fun getSelectedProjectViewFile(): VirtualFile? {
    var selectedFile: VirtualFile? = null
    val readSelection = Runnable {
      selectedFile = ProjectView.getInstance(project).currentProjectViewPane
        ?.selectedUserObjects
        ?.firstNotNullOfOrNull { selectedElement ->
          when (val value = AbstractProjectViewPane.extractValueFromNode(selectedElement)) {
            is VirtualFile -> value.takeUnless { it.isDirectory }
            is PsiFileSystemItem -> value.virtualFile.takeUnless { it.isDirectory }
            is PsiClass -> value.containingFile?.virtualFile?.takeUnless { it.isDirectory }
            else -> null
          }
        }
    }

    val application = ApplicationManager.getApplication()
    if (application.isDispatchThread) {
      readSelection.run()
    } else {
      application.invokeAndWait(readSelection)
    }
    return selectedFile
  }

  override fun dispose() {
    project.service<LoggerProjectService>().log(LogSource.PLUGIN, "JavaWizProjectService disposed")
    // Here we can add code that should be executed when the project closes (most probably due to closing IntelliJ)
    endDebug()
  }
}
