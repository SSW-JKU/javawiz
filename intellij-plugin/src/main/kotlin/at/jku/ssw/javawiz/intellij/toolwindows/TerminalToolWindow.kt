package at.jku.ssw.javawiz.intellij.toolwindows

import at.jku.ssw.javawiz.intellij.general.ConsoleHistoryItem
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.ui.components.TextComponentEmptyText
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.Color
import java.awt.event.FocusEvent
import java.awt.event.FocusListener
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import java.util.*
import java.util.function.Predicate
import javax.swing.*
import javax.swing.text.SimpleAttributeSet
import javax.swing.text.StyleConstants

fun interface InputListener : EventListener {
  fun input(text: String)
}

class TerminalToolWindowPanel(val project: Project) : SimpleToolWindowPanel(true) {
  private val historyTextPane = JTextPane().apply {
    isEditable = false
    background = JBColor.WHITE
  }
  /**
   * The field the user types program input into. It is enabled only while the program waits for
   * input, and then shows the hint "Type your input and press Enter" while it is empty.
   */
  internal val writingTextField = JBTextField().apply {
    background = JBColor.WHITE
    isEnabled = false
    emptyText.text = "Type your input and press Enter"
    // IntelliJ hides this placeholder text while the field has the focus, but the field always gets
    // the focus when the program asks for input. This client property replaces that rule: show the
    // hint whenever the field is enabled (input is expected) and empty, focused or not.
    putClientProperty(
      TextComponentEmptyText.STATUS_VISIBLE_FUNCTION,
      Predicate<JBTextField> { it.isEnabled && it.text.isEmpty() },
    )
  }
  private val sendButton = JButton("Send Input").apply {
    isEnabled = false
  }

  var isWritingEnabled = false
    set(value) {
      field = value
      writingTextField.isEnabled = value
      sendButton.isEnabled = value
      if (!value) {
        writingTextField.text = ""
      }
      // Adds or removes the input hint at the end of the output text.
      renderHistory()
    }

  /** The console history shown in the output text; kept so that [isWritingEnabled] can redraw it. */
  @Volatile
  private var history: List<ConsoleHistoryItem> = emptyList()

  val inputListeners = mutableListOf<InputListener>()

  fun addInputListener(listener: InputListener) {
    inputListeners += listener
  }

  init {
    val mainPanel = JPanel(BorderLayout())
    mainPanel.add(JBScrollPane(historyTextPane), BorderLayout.CENTER)

    val inputBar = JPanel(BorderLayout())
    inputBar.add(writingTextField, BorderLayout.CENTER)
    inputBar.add(sendButton, BorderLayout.EAST)
    mainPanel.add(inputBar, BorderLayout.SOUTH)

    setContent(mainPanel)
    initListeners()
  }

  private fun fireInputListeners() {
    val text = writingTextField.text
    inputListeners.forEach { it.input(text) }
    writingTextField.text = ""
  }

  private fun initListeners() {
    addFocusListener(object : FocusListener {
      override fun focusGained(e: FocusEvent?) {
        ApplicationManager.getApplication().invokeAndWait {
          writingTextField.grabFocus()
        }
      }
      override fun focusLost(e: FocusEvent?) {}
    })

    writingTextField.addKeyListener(object : KeyAdapter() {
      override fun keyPressed(e: KeyEvent?) {
        if (e != null && e.keyCode == KeyEvent.VK_ENTER) {
          e.consume() // prevent newline insertion
          fireInputListeners()
        }
      }
    })

    sendButton.addActionListener {
      fireInputListeners()
    }
  }

  fun setHistory(history: List<ConsoleHistoryItem>) {
    this.history = history
    renderHistory()
  }

  /**
   * Redraws the output text from [history]. While the program waits for input, it ends with the
   * hint "Type your input and press Enter" in italic grey, where the typed input will appear.
   */
  private fun renderHistory() {
    val history = history
    val showInputHint = isWritingEnabled
    ApplicationManager.getApplication().invokeLater {
      val doc = historyTextPane.styledDocument
      doc.remove(0, doc.length)

      val outputAttrs = SimpleAttributeSet().apply {
        StyleConstants.setForeground(this, JBColor.foreground())
      }
      val inputAttrs = SimpleAttributeSet().apply {
        StyleConstants.setForeground(this, Color(0x2B7FD4)) // blue
      }
      val errorAttrs = SimpleAttributeSet().apply {
        StyleConstants.setForeground(this, JBColor.RED)
      }

      for (item in history) {
        if (item.output.isNotEmpty()) doc.insertString(doc.length, item.output, outputAttrs)
        if (item.input.isNotEmpty()) doc.insertString(doc.length, " ${item.input}", inputAttrs)
        if (item.error.isNotEmpty()) doc.insertString(doc.length, " ${item.error}", errorAttrs)
      }
      if (showInputHint) {
        val hintAttrs = SimpleAttributeSet().apply {
          StyleConstants.setForeground(this, JBColor.GRAY)
          StyleConstants.setItalic(this, true)
        }
        // A leading space, as for typed input above.
        doc.insertString(doc.length, " Type your input and press Enter", hintAttrs)
      }

      // scroll to bottom
      historyTextPane.caretPosition = doc.length
    }
  }
}

class TerminalToolWindowFactory : ToolWindowFactory {
  override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
    val panel = TerminalToolWindowPanel(project)
    val content = ContentFactory.getInstance().createContent(panel, null, false)
    // When the tool window is activated, for example because the program waits for input, IntelliJ
    // moves the focus to this component. Without it, the output text area would get the focus and
    // the user would have to click into the input field before typing.
    content.preferredFocusableComponent = panel.writingTextField
    toolWindow.contentManager.addContent(content)
  }
}
