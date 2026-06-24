package at.jku.ssw.javawiz.intellij.general

import com.intellij.icons.AllIcons
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.ScalableIcon
import com.intellij.util.IconUtil
import com.intellij.util.ui.UIUtil
import com.intellij.xdebugger.ui.DebuggerColors
import java.awt.Color
import java.awt.Component
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.image.BufferedImage
import java.util.*
import javax.swing.Icon

object Globals {
  object Props {
    private var properties: Properties

    init {
      val inputStream = Globals::class.java.classLoader.getResourceAsStream("Config/config.properties")
        ?: throw IllegalStateException("config.properties not found in classpath")
      properties = Properties().apply { load(inputStream) }
    }

    //-------------------------------------------------
    // Constants from config.properties
    //-------------------------------------------------
    // Notification
    val NOTIFICATION_GROUPID: String = properties.getProperty("notificationGroupId")
    val NOTIFICATION_TITLE: String = properties.getProperty("notificationTitle")

    // GUI
    val GUI_FRONTEND_TOOLWINDOWID: String = properties.getProperty("guiFrontendId")
    val GUI_TERMINAL_TOOLWINDOWID: String = properties.getProperty("guiTerminalId")
    val GUI_EXECUTOR_ID: String = properties.getProperty("guiExecuterId")
    val GUI_CONTEXT: String = properties.getProperty("guiContextId")
    val GUI_BUTTON_RUN: String = properties.getProperty("guiButtonTitleRun")
    val GUI_BUTTON_STOP: String = properties.getProperty("guiButtonTitleStop")

    // Plugin Information
    val PLUGIN_NAME: String = properties.getProperty("pluginName")
    val PLUGIN_ID: String = properties.getProperty("pluginId")
    val PLUGIN_VERSION: String = properties.getProperty("pluginVersion")
    val PLUGIN_EXTRACTION_PATH: String = properties.getProperty("pluginExtractionPath")

    // Directory Structure
    val FRONTEND: String = properties.getProperty("dirFrontend")
    val BACKEND: String = properties.getProperty("dirBackend")
    val DEFAULT: String = properties.getProperty("dirDefault")
    val LOG: String = properties.getProperty("dirLog")

    // Backend (Debugger - Jar)
    val BACKEND_JAR_NAME: String = properties.getProperty("backendJarName")

    // Frontend (Http Server)
    val FRONTEND_TABNAME: String = properties.getProperty("frontendTabName")
    val FRONTEND_ENDPOINT_STATUS: String = properties.getProperty("frontendEndpointStatus")
    val FRONTEND_ENDPOINT_ROOT: String = properties.getProperty("frontendEndpointRoot")

    // Default Ressource Paths
    val DEFAULT_INDEX_URL: String = properties.getProperty("defaultIndexURL")

    // LOG
    val LOG_ENABLED: Boolean = properties.getProperty("logEnabled").toBoolean()
    val LOG_DELIMITER: String = properties.getProperty("logDelimiter")
    val LOG_FILE_NAME_PLUGIN: String = properties.getProperty("logFileNamePlugin")
    val LOG_FILE_NAME_ACTION: String = properties.getProperty("logFileNameAction")
    val LOG_FILE_NAME_FRONTEND: String = properties.getProperty("logFileNameFrontend")
    val LOG_FILE_NAME_BACKEND: String = properties.getProperty("logFileNameBackend")
    val LOG_FILE_NAME_COMMUNICATION: String = properties.getProperty("logFileNameCommunication")
    val LOG_FILE_NAME_GENERAL: String = properties.getProperty("logFileNameGeneral")

    // Ports
    val STARTPORT: Int = properties.getProperty("portStartport").toInt()

    // General
    val HOST: String = properties.getProperty("hostName")
    val DEBUGABLE_EXTENSION: List<String> = properties.getProperty("debugableExtensions").split(",")
    val TIMEOUT_DURATION_MS: Long = properties.getProperty("timeoutDurationMs").toLong()
    val PROCESS_STOP_TIMEOUT_MS: Long = properties.getProperty("processStopTimeoutMs").toLong()
    val PROCESS_FORCE_STOP_TIMEOUT_MS: Long = properties.getProperty("processForceStopTimeoutMs").toLong()

    // JCEF Browser Configurations
    val USE_DEV_TOOLS: Boolean = properties.getProperty("useDevTools").toBoolean()

    // Actions & Run Configurations
    val ACTION_ID_RUN: String = properties.getProperty("actionID")
  }

  object Strings {
    // Message Keys & Values
    const val MESSAGE_KIND_HIGH_LINE = "highlightLine"
    const val MESSAGE_KIND_HOVER_LINE = "hoverLine"
    const val MESSAGE_KIND_CONSOLE_ENABLED = "consoleEnabled"
    const val MESSAGE_KIND_GET_FILE_CONTENTS = "getFileContents"
    const val MESSAGE_KIND_CHANGE_HISTORY = "changeConsoleHistory"
    const val MESSAGE_KIND_NOTIFICATION = "notification"
    const val MESSAGE_KIND_COMPILE_ERROR = "compileError"

    const val MESSAGE_RESULT_SUCCESS = "SUCCESS"
    const val MESSAGE_RESULT_FAILED = "FAILED"
  }

  object GUI {
    // GUI Icons
    val GUI_ICON_DISABLED = AllIcons.Actions.Cancel
    val GUI_ICON_RUN: Icon = ThemeAwareMonochromeIcon(
      IconUtil.scale(IconLoader.getIcon("/wizard-hat.png", Globals::class.java), null, 16f / 640f)
    )
    val GUI_ICON_STOP = AllIcons.Actions.Suspend

    // Editor — resolved lazily to avoid accessing EditorColorsManager outside the EDT at class-load time
    val EDITOR_TEXTATTR_EXEC by lazy {
      EditorColorsManager.getInstance().globalScheme.getAttributes(DebuggerColors.EXECUTIONPOINT_ATTRIBUTES)
    }
  }
}

private class ThemeAwareMonochromeIcon(private val delegate: Icon) : ScalableIcon {
  override fun getIconWidth(): Int = delegate.iconWidth

  override fun getIconHeight(): Int = delegate.iconHeight

  override fun getScale(): Float = (delegate as? ScalableIcon)?.scale ?: 1f

  override fun scale(scaleFactor: Float): Icon = ThemeAwareMonochromeIcon(
    (delegate as? ScalableIcon)?.scale(scaleFactor)
      ?: IconUtil.scale(delegate, null, scaleFactor)
  )

  override fun paintIcon(c: Component?, g: Graphics, x: Int, y: Int) {
    val image = BufferedImage(iconWidth, iconHeight, BufferedImage.TYPE_INT_ARGB)
    val imageGraphics = image.createGraphics()
    try {
      delegate.paintIcon(c, imageGraphics, 0, 0)
      imageGraphics.composite = java.awt.AlphaComposite.SrcAtop
      imageGraphics.color = iconColor()
      imageGraphics.fillRect(0, 0, iconWidth, iconHeight)
    } finally {
      imageGraphics.dispose()
    }

    (g.create() as Graphics2D).use { graphics ->
      graphics.drawImage(image, x, y, null)
    }
  }

  private fun iconColor(): Color {
    val background = UIUtil.getPanelBackground()
    val brightness = (background.red * 299 + background.green * 587 + background.blue * 114) / 1000

    return if (brightness < 128) Color.WHITE else Color.BLACK
  }
}

private inline fun Graphics2D.use(block: (Graphics2D) -> Unit) {
  try {
    block(this)
  } finally {
    dispose()
  }
}
