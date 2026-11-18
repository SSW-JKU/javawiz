package at.jku.ssw.javawiz.intellij.action

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

/**
 * Throws an exception on purpose, so that maintainers can check that error reports from a
 * JavaWiz version installed from JetBrains Marketplace arrive on the plugin's Marketplace page.
 * Reports from a locally built plugin never arrive there, so this has to ship in a release.
 *
 * The action is in no menu or toolbar; it can only be found with Help | Find Action. It is also
 * hidden and does nothing unless the IDE was started with the property `javawiz.errorReportTest=true`.
 * To set it, add that line in Help | Edit Custom Properties and restart the IDE: IntelliJ turns each
 * line of that file into a Java system property at startup.
 *
 * When run, the exception reaches IntelliJ's error dialog, which names JavaWiz as the cause and
 * offers to report it. This class is temporary: remove it once a report has arrived.
 */
class ThrowTestException : AnAction() {

  /** Shows the action only when the maintainer turned it on. */
  override fun update(e: AnActionEvent) {
    e.presentation.isEnabledAndVisible = isTurnedOn()
  }

  /** `update` reads only a system property, so it can run on a background thread. */
  override fun getActionUpdateThread() = ActionUpdateThread.BGT

  override fun actionPerformed(e: AnActionEvent) {
    // IntelliJ normally runs only enabled actions, but a keyboard shortcut can skip `update`.
    if (!isTurnedOn()) return
    throw IllegalStateException(
      "JavaWiz test exception: thrown on purpose to check that error reports reach JetBrains Marketplace"
    )
  }

  private fun isTurnedOn() = System.getProperty("javawiz.errorReportTest") == "true"
}
