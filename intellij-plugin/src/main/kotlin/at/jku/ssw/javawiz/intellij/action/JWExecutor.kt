package at.jku.ssw.javawiz.intellij.action

import at.jku.ssw.javawiz.intellij.general.Globals
import com.intellij.execution.Executor
import org.jetbrains.annotations.NonNls
import javax.swing.Icon

class JWExecutor : Executor() {

  override fun getToolWindowId(): String {
    return Globals.Props.GUI_EXECUTOR_ID
  }

  override fun getToolWindowIcon(): Icon {
    return icon
  }

  override fun getIcon(): Icon {
    return Globals.GUI.GUI_ICON_RUN
  }

  override fun getDisabledIcon(): Icon {
    return Globals.GUI.GUI_ICON_DISABLED
  }

  override fun getDescription(): String {
    return Globals.Props.GUI_BUTTON_RUN
  }

  override fun getActionName(): String {
    return Globals.Props.GUI_BUTTON_RUN
  }

  override fun getId(): String {
    return Globals.Props.GUI_EXECUTOR_ID
  }

  override fun getStartActionText(): String {
    return Globals.Props.GUI_BUTTON_RUN
  }

  override fun getContextActionId(): String {
    return Globals.Props.GUI_CONTEXT
  }

  override fun getHelpId(): @NonNls String? {
    return null
  }
}

