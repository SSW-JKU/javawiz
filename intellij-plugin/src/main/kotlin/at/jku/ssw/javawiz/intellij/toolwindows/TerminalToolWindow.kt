package at.jku.ssw.javawiz.intellij.toolwindows

import at.jku.ssw.javawiz.intellij.general.ConsoleHistoryItem
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.Color
import java.awt.event.FocusEvent
import java.awt.event.FocusListener
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import java.util.*
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
  private val writingTextField = JTextField().apply {
    background = JBColor.WHITE
    isEnabled = false
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
    }

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

      // scroll to bottom
      historyTextPane.caretPosition = doc.length
    }
  }
}

class TerminalToolWindowFactory : ToolWindowFactory {
  override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
    val content = ContentFactory.getInstance()
      .createContent(TerminalToolWindowPanel(project), null, false)
    toolWindow.contentManager.addContent(content)
  }
}
