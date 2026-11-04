package at.jku.ssw.javawiz.intellij.components

import at.jku.ssw.javawiz.intellij.general.FileContent
import at.jku.ssw.javawiz.intellij.general.FrontendMessage
import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.general.ResponseData
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.toolwindows.TerminalToolWindowFactory
import com.intellij.ide.scratch.ScratchRootType
import com.intellij.lang.java.JavaLanguage
import com.intellij.notification.Notification
import com.intellij.notification.Notifications
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.WriteAction
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.TextEditor
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.RegisterToolWindowTask
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.testFramework.PlatformTestUtil
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase5
import com.intellij.util.ui.UIUtil
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import javax.swing.JTextPane
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Checks the messages the JavaWiz frontend sends to the plugin and their effects on editors and the
 * I/O tool window. Messages are passed straight to [Communication.processFrontendMessage], so the
 * test covers the protocol handling and the real project service without starting the WebSocket server.
 */
internal class CommunicationTest :
  LightJavaCodeInsightFixtureTestCase5(LightJavaCodeInsightFixtureTestCase.JAVA_25) {

  /** These tests use inline snippets and therefore have no external test-data root. */
  override fun getTestDataPath(): String = ""

  private val service get() = fixture.project.service<JavaWizProjectService>()

  @BeforeEach
  fun registerToolWindowsAndResetTerminal() {
    ApplicationManager.getApplication().invokeAndWait {
      // Headless tests do not create the tool windows declared in plugin.xml. Registering a window
      // with RegisterToolWindowTask gives the service a lightweight test window under the same ID.
      // The windows stay registered: the service caches them for the lifetime of the shared light
      // project, so replacing them would leave the service holding stale panels.
      val toolWindowManager = ToolWindowManager.getInstance(fixture.project)
      if (toolWindowManager.getToolWindow(Globals.Props.GUI_FRONTEND_TOOLWINDOWID) == null) {
        toolWindowManager.registerToolWindow(RegisterToolWindowTask(id = Globals.Props.GUI_FRONTEND_TOOLWINDOWID))
      }
      if (toolWindowManager.getToolWindow(Globals.Props.GUI_TERMINAL_TOOLWINDOWID) == null) {
        val terminal = toolWindowManager.registerToolWindow(RegisterToolWindowTask(id = Globals.Props.GUI_TERMINAL_TOOLWINDOWID))
        TerminalToolWindowFactory().createToolWindowContent(fixture.project, terminal)
      }
    }
    service.clearConsoleHistory()
    service.terminalToolWindowPanel.isWritingEnabled = false
    flushEdt()
  }

  /** The light project is shared between tests, so a launch file must not leak into the next test. */
  @AfterEach
  fun clearLaunchFile() {
    service.launchFile = null
  }

  @Test
  fun testHoverLineSucceedsAndEchoesMessage() {
    val response = process("""{"kind":"hoverLine","line":3}""")

    assertEquals("SUCCESS", response.result)
    val message = response.getValue("message").jsonObject
    assertEquals("hoverLine", message.getValue("kind").jsonPrimitive.content)
    assertEquals(3, message.getValue("line").jsonPrimitive.int)
  }

  @Test
  fun testRejectsMessagesMissingRequiredFields() {
    for (json in listOf(
      """{"kind":"hoverLine"}""",
      """{"kind":"highlightLine","line":1}""",
      """{"kind":"highlightLine","uri":"Main.java"}""",
      """{"kind":"changeConsoleHistory"}""",
    )) {
      assertEquals("FAILED", process(json).result, json)
    }
  }

  @Test
  fun testIgnoresUnknownMessageKinds() {
    assertEquals("SUCCESS", process("""{"kind":"futureKind"}""").result)
  }

  @Test
  fun testHighlightsRequestedLine() {
    val file = fixture.configureByText("Main.java", "class Main {\n  void run() {}\n}\n").virtualFile

    assertEquals("SUCCESS", process("""{"kind":"highlightLine","line":2,"uri":"Main.java"}""").result)

    assertEquals(listOf(listOf(1)), highlightedLines(file))
  }

  @Test
  fun testIgnoresHighlightForUnknownFile() {
    val file = fixture.configureByText("Main.java", "class Main {}").virtualFile

    assertEquals("SUCCESS", process("""{"kind":"highlightLine","line":1,"uri":"Missing.java"}""").result)

    assertTrue(highlightedLines(file).all { it.isEmpty() })
  }

  @Test
  fun testReturnsProjectFileContents() {
    fixture.addFileToProject("pkg/Helper.java", "package pkg; class Helper {}")
    fixture.addFileToProject(".hidden/Secret.java", "class Secret {}")
    fixture.addFileToProject("notes.txt", "note")
    fixture.configureByText("Main.java", "class Main {}")
    // WriteCommandAction is IntelliJ's required wrapper for document edits. The edit stays unsaved,
    // so the file on disk still holds the original text.
    WriteCommandAction.runWriteCommandAction(fixture.project) {
      fixture.editor.document.insertString(0, "// unsaved\n")
    }

    val response = Json.decodeFromString<ResponseData>(rawProcess("""{"kind":"getFileContents"}"""))

    assertEquals("SUCCESS", response.result)
    assertEquals(
      listOf(
        FileContent("Main.java", "// unsaved\nclass Main {}"),
        FileContent("pkg/Helper.java", "package pkg; class Helper {}"),
      ),
      response.data.fileContents.sortedBy { it.localUri },
    )
    // Without a launched file, the plugin names no main file, even though Main.java is in the
    // editor. The action always passes the file to start, so a guess would only hide mistakes.
    assertEquals("", response.data.openEditorLocalUri)
  }

  @Test
  fun testSendsLaunchFileAsMainFile() {
    val other = fixture.addFileToProject(
      "pkg/Other.java",
      "package pkg; class Other { public static void main(String[] args) {} }",
    ).virtualFile
    // The editor shows Main.java, but the user launched Other.java (for example from the Project
    // tree or a run configuration). The launched file must win.
    fixture.configureByText("Main.java", "class Main { public static void main(String[] args) {} }")
    service.launchFile = other

    val response = Json.decodeFromString<ResponseData>(rawProcess("""{"kind":"getFileContents"}"""))

    assertEquals("pkg/Other.java", response.data.openEditorLocalUri)
  }

  @Test
  fun testSendsAndHighlightsScratchLaunchFile() {
    fixture.configureByText("Main.java", "class Main { public static void main(String[] args) {} }")
    val scratchText = "class Scratch {\n  public static void main(String[] args) {}\n}\n"
    // Scratch files live in the IDE's scratch folder, outside the project's content roots.
    var scratch: VirtualFile? = null
    ApplicationManager.getApplication().invokeAndWait {
      scratch = ScratchRootType.getInstance()
        .createScratchFile(fixture.project, "scratch.java", JavaLanguage.INSTANCE, scratchText)
    }
    val scratchFile = scratch!!
    try {
      service.launchFile = scratchFile

      val response = Json.decodeFromString<ResponseData>(rawProcess("""{"kind":"getFileContents"}"""))

      assertEquals(scratchFile.name, response.data.openEditorLocalUri)
      assertTrue(FileContent(scratchFile.name, scratchText) in response.data.fileContents, response.data.fileContents.toString())

      assertEquals("SUCCESS", process("""{"kind":"highlightLine","line":2,"uri":"${scratchFile.name}"}""").result)
      assertEquals(listOf(listOf(1)), highlightedLines(scratchFile))
    } finally {
      ApplicationManager.getApplication().invokeAndWait {
        FileEditorManager.getInstance(fixture.project).closeFile(scratchFile)
        WriteAction.run<Exception> { scratchFile.delete(this) }
      }
    }
  }

  @Test
  fun testConsoleEnabledTogglesTerminalInput() {
    assertEquals("SUCCESS", process("""{"kind":"consoleEnabled","consoleEnabled":true}""").result)
    assertTrue(service.terminalToolWindowPanel.isWritingEnabled)

    assertEquals("SUCCESS", process("""{"kind":"consoleEnabled","consoleEnabled":false}""").result)
    assertEquals(false, service.terminalToolWindowPanel.isWritingEnabled)
  }

  @Test
  fun testChangeConsoleHistoryRendersHistory() {
    val response = process(
      """{"kind":"changeConsoleHistory","newConsoleHistory":[""" +
        """{"output":"Enter a number:","input":"42","error":""},""" +
        """{"output":"\nResult: 84","input":"","error":"Boom"}]}"""
    )

    assertEquals("SUCCESS", response.result)
    flushEdt()
    assertEquals("Enter a number: 42\nResult: 84 Boom", terminalText())
  }

  @Test
  fun testCompileErrorShowsMessageInTerminal() {
    // The frontend sends line breaks in compiler output as the two characters `\` and `n`.
    val response = process("""{"kind":"compileError","message":"Main.java:1: error\\nexpected"}""")

    assertEquals("SUCCESS", response.result)
    flushEdt()
    assertEquals("Main.java:1: error\nexpected", terminalText())
  }

  @Test
  fun testSuppressesNotificationsWithoutSession() {
    val notifications = mutableListOf<Notification>()
    // Notifications.TOPIC is the application-wide channel on which IntelliJ announces each notification.
    ApplicationManager.getApplication().messageBus.connect(fixture.testRootDisposable)
      .subscribe(Notifications.TOPIC, object : Notifications {
        override fun notify(notification: Notification) {
          notifications += notification
        }
      })

    assertEquals("SUCCESS", process("""{"kind":"notification","type":"error","message":"lost"}""").result)
    flushEdt()

    assertEquals(emptyList(), notifications)
  }

  private val JsonObject.result get() = getValue("result").jsonPrimitive.content

  /** Handles one frontend message and returns the plugin's JSON response. */
  private fun rawProcess(json: String): String =
    service.communication.processFrontendMessage(Json.decodeFromString<FrontendMessage>(json))

  private fun process(json: String): JsonObject = Json.parseToJsonElement(rawProcess(json)).jsonObject

  /** Returns, for each text editor of [file], the zero-based document lines that carry a highlighter. */
  private fun highlightedLines(file: VirtualFile): List<List<Int>> {
    var lines = emptyList<List<Int>>()
    ApplicationManager.getApplication().invokeAndWait {
      lines = FileEditorManager.getInstance(fixture.project).getEditors(file)
        .filterIsInstance<TextEditor>()
        .map { textEditor ->
          val editor = textEditor.editor
          editor.markupModel.allHighlighters.map { editor.document.getLineNumber(it.startOffset) }
        }
    }
    return lines
  }

  /**
   * Returns the text shown in the I/O tool window. It reads the document directly because
   * `JTextPane.getText()` converts line breaks to the operating system's line separator.
   */
  private fun terminalText(): String {
    val pane = UIUtil.findComponentOfType(service.terminalToolWindowPanel, JTextPane::class.java)!!
    return pane.styledDocument.getText(0, pane.styledDocument.length)
  }

  /** Runs UI updates that production code queued with `invokeLater`, so assertions see their result. */
  private fun flushEdt() {
    ApplicationManager.getApplication().invokeAndWait {
      PlatformTestUtil.dispatchAllInvocationEventsInIdeEventQueue()
    }
  }
}
