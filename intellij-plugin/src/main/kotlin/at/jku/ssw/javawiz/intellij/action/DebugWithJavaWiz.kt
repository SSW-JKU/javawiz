package at.jku.ssw.javawiz.intellij.action

import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import com.intellij.execution.actions.ExecutorAction
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.components.service

// https://plugins.jetbrains.com/docs/intellij/action-system.html
// Every IntelliJ Platform action should override AnAction.update() and must override
// AnAction.actionPerformed().
class DebugWithJavaWiz() : ExecutorAction(JWExecutor()) {
  override fun actionPerformed(e: AnActionEvent) {
    // Check if the project is null
    if (e.project == null) {
      error("[ERROR] DebugWithJavaWiz action performed without project, this should not happen!")
    }

    val project = e.project!!

    project.service<LoggerProjectService>()
            .log(LogSource.ACTION, "DebugWithJavaWiz action performed")

    // Start JavaWiz with the current project
    if (project.service<JavaWizProjectService>().isJavaWizRunning)
            project.service<JavaWizProjectService>().endDebug { update(e) }
    else project.service<JavaWizProjectService>().startDebug { update(e) }
  }

  override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

  // https://plugins.jetbrains.com/docs/intellij/action-system.html#overriding-the-anactionupdate-method
  // Called on different occasions due to UI changes (e.g., mouse movements / clicks)
  // and manually called after starting/stopping JavaWiz to update the button state
  override fun update(e: AnActionEvent) {
    val presentation: Presentation = e.presentation

    if (e.project == null) {
      presentation.isEnabled = false
      presentation.isVisible = false
      return
    }

    val project = e.project!!
    project.service<LoggerProjectService>().log(LogSource.ACTION, "DebugWithJavaWiz action update")

    if (project.service<JavaWizProjectService>().isJavaWizRunning) {
      if (project.service<JavaWizProjectService>().connectionInitialized) {
        presentation.isEnabled = true
        presentation.isVisible = true
        presentation.text = Globals.Props.GUI_BUTTON_STOP
        presentation.icon = Globals.GUI.GUI_ICON_STOP
      } else {
        presentation.isEnabled = false
        presentation.isVisible = false
        presentation.text = "Changing Connection State..."
        presentation.icon = Globals.GUI.GUI_ICON_DISABLED
      }
    } else {
      presentation.isEnabled = true
      presentation.isVisible = true
      presentation.text = Globals.Props.GUI_BUTTON_RUN
      presentation.icon = Globals.GUI.GUI_ICON_RUN
    }
  }
}