package at.jku.ssw.javawiz.intellij.action

import at.jku.ssw.javawiz.intellij.contributors.hasJavaWizMainClass
import at.jku.ssw.javawiz.intellij.general.Globals
import at.jku.ssw.javawiz.intellij.service.project.JavaWizProjectService
import at.jku.ssw.javawiz.intellij.service.project.LogSource
import at.jku.ssw.javawiz.intellij.service.project.LoggerProjectService
import com.intellij.execution.RunManager
import com.intellij.execution.application.ApplicationConfiguration
import com.intellij.execution.configurations.RunConfiguration
import com.intellij.ide.highlighter.JavaFileType
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiJavaFile
import com.intellij.psi.PsiManager

/**
 * The "Debug with JavaWiz" action: starts a JavaWiz session for one Java file, or stops the running
 * session.
 *
 * IntelliJ shows the same action in several places. They fall into two kinds, which decide
 * differently which file to start (see [launchFileOrNull]):
 *
 * | Kind of place                                             | File to start                                       | Without a file |
 * |-----------------------------------------------------------|-----------------------------------------------------|----------------|
 * | Context-file places: gutter icon, editor and Project tree context menus | the clicked file, if it has a startable main | hidden |
 * | Run widget places: toolbar, Run menu, and all others      | the run widget's choice, like IntelliJ's Run button | disabled, with the reason as text |
 *
 * See https://plugins.jetbrains.com/docs/intellij/action-system.html for how actions work.
 */
class DebugWithJavaWiz : AnAction() {

  /** Stops the running session, or starts one for the file that [launchFileOrNull] chooses. */
  override fun actionPerformed(e: AnActionEvent) {
    val project = e.project ?: error("DebugWithJavaWiz action performed without a project")
    log(project, "DebugWithJavaWiz action performed (place: ${e.place})")

    val projectService = project.service<JavaWizProjectService>()
    if (projectService.isJavaWizRunning) {
      projectService.endDebug { updatePresentation(e) }
      return
    }

    // `update` disables or hides the action when there is no file to start, and IntelliJ performs
    // only enabled actions. A missing file therefore means the context changed between the two calls.
    val launchFile = launchFileOrNull(e, project)
    if (launchFile == null) {
      log(project, "DebugWithJavaWiz action performed without a file to start; ignored")
      return
    }
    projectService.startDebug(launchFile) { updatePresentation(e) }
  }

  /**
   * Returns the Java file whose `main` method JavaWiz should run when the action is invoked at
   * `e.place`, or `null` if there is none. The rules per place are listed in the class comment.
   * It is read when the user clicks, because the editor focus may change while JavaWiz starts.
   *
   * Needs read access, because it may inspect a file's classes or resolve a run configuration's
   * main class: call it on the UI thread or inside a read action, as IntelliJ does for
   * `actionPerformed` and `update`.
   */
  internal fun launchFileOrNull(e: AnActionEvent, project: Project): VirtualFile? =
    if (isContextFilePlace(e.place)) contextJavaMainFileOrNull(e, project) else runWidgetFileOrNull(project)

  /**
   * Runs [update] on a background thread. It reads files and run configurations, which IntelliJ
   * allows there inside the read action it holds during `update`, and which would slow down the UI
   * thread.
   */
  override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

  /**
   * Called by IntelliJ whenever the action may be shown, for example when a menu opens or the
   * toolbar refreshes. See
   * https://plugins.jetbrains.com/docs/intellij/action-system.html#overriding-the-anactionupdate-method
   */
  override fun update(e: AnActionEvent) {
    updatePresentation(e)
  }

  /**
   * Sets the action's text, icon, and state for the place where it is shown. While a session runs,
   * every place offers "Stop JavaWiz". Otherwise each kind of place (see the class comment) has its
   * own function. Also called after a session starts or stops, so the button changes immediately.
   */
  private fun updatePresentation(e: AnActionEvent) {
    val presentation = e.presentation
    val project = e.project ?: return hide(presentation)
    log(project, "DebugWithJavaWiz action update")

    val projectService = project.service<JavaWizProjectService>()
    when {
      projectService.isJavaWizRunning -> updateRunningSessionPresentation(presentation, projectService.connectionInitialized)
      isContextFilePlace(e.place) -> updateContextFilePresentation(presentation, e, project)
      else -> updateRunWidgetPresentation(presentation, project)
    }
  }

  /**
   * Shows "Stop JavaWiz" once the session is connected. While the connection is being set up, the
   * action is hidden, so it cannot be clicked twice.
   */
  private fun updateRunningSessionPresentation(presentation: Presentation, connectionInitialized: Boolean) {
    if (!connectionInitialized) return hide(presentation)
    presentation.isEnabledAndVisible = true
    presentation.text = Globals.Props.GUI_BUTTON_STOP
    presentation.icon = Globals.GUI.GUI_ICON_STOP
  }

  /**
   * Context-file places (gutter icon, editor and Project tree context menus): offer the clicked file
   * if it has a startable main class, and leave the entry out otherwise, as context menus do.
   */
  private fun updateContextFilePresentation(presentation: Presentation, e: AnActionEvent, project: Project) {
    val launchFile = contextJavaMainFileOrNull(e, project)
    if (launchFile != null) showStart(presentation, launchFile) else hide(presentation)
  }

  /**
   * Main toolbar button, Run menu entry, and every other place that is not tied to a file, such as
   * a keyboard shortcut or the JavaWiz tool window. Like IntelliJ's Run button, the action stays in
   * place but is disabled when there is nothing to start, and its text says why.
   */
  private fun updateRunWidgetPresentation(presentation: Presentation, project: Project) {
    val launchFile = runWidgetFileOrNull(project)
    if (launchFile != null) showStart(presentation, launchFile)
    else showDisabled(presentation, runWidgetDisabledReason(project))
  }

  /**
   * Returns why the run widget offers nothing to start, worded like IntelliJ's Run button
   * ("Cannot run the current file: the editor is not in focus"). Call it only when
   * [runWidgetFileOrNull] returned `null`.
   */
  private fun runWidgetDisabledReason(project: Project): String = when {
    RunManager.getInstance(project).selectedConfiguration != null -> Globals.Props.GUI_BUTTON_DISABLED_RUN_CONFIGURATION
    FileEditorManager.getInstance(project).selectedFiles.isEmpty() -> Globals.Props.GUI_BUTTON_DISABLED_NO_EDITOR
    currentJavaFileOrNull(project) != null -> Globals.Props.GUI_BUTTON_DISABLED_NO_MAIN_IN_EDITOR
    else -> Globals.Props.GUI_BUTTON_DISABLED_NO_APPLICATION_IN_EDITOR
  }

  /** Enables the action and names the file a click would start, for example "Debug Main.java with JavaWiz". */
  private fun showStart(presentation: Presentation, launchFile: VirtualFile) {
    presentation.isEnabledAndVisible = true
    // `false` keeps underscores in file names visible; IntelliJ would treat them as mnemonics.
    presentation.setText(Globals.Props.guiButtonRunFor(launchFile.name), false)
    presentation.description = presentation.text
    presentation.icon = Globals.GUI.GUI_ICON_RUN
  }

  /**
   * Shows the action disabled, with [reason] as its text. The toolbar shows the text as the
   * button's tooltip, as IntelliJ's Run button does.
   */
  private fun showDisabled(presentation: Presentation, reason: String) {
    presentation.isVisible = true
    presentation.isEnabled = false
    presentation.text = reason
    presentation.description = reason
    presentation.icon = Globals.GUI.GUI_ICON_RUN
  }

  /** Hides the action, for example in a context menu of a file that cannot be started. */
  private fun hide(presentation: Presentation) {
    presentation.isEnabledAndVisible = false
  }

  /**
   * Reports whether [place] is tied to a clicked file: the gutter icon (its click, popup, or
   * tooltip), the editor context menu, or the Project tree context menu. All other places follow
   * the run widget.
   */
  private fun isContextFilePlace(place: String): Boolean = place in CONTEXT_FILE_PLACES

  /**
   * Returns the file the toolbar button and Run menu entry would start, following the run widget:
   * with "Current File", [currentJavaMainFileOrNull]; with a Java Application run configuration, its
   * main class file. Any other configuration (JUnit, Gradle, …), or one whose main class cannot be
   * found, gives `null`: JavaWiz cannot start what that configuration would run.
   */
  private fun runWidgetFileOrNull(project: Project): VirtualFile? {
    // RunManager holds the project's run configurations; `selectedConfiguration` is the one in
    // the run widget, or null for "Current File".
    val configuration = RunManager.getInstance(project).selectedConfiguration?.configuration
      ?: return currentJavaMainFileOrNull(project)
    return applicationMainFileOrNull(configuration)
  }

  /**
   * Returns the source file of the main class that [configuration] runs, or `null` if it is not a
   * Java Application configuration or its class cannot be found.
   */
  private fun applicationMainFileOrNull(configuration: RunConfiguration): VirtualFile? =
    // ApplicationConfiguration is the "Application" type that runs a Java main class.
    (configuration as? ApplicationConfiguration)?.mainClass?.containingFile?.virtualFile

  /**
   * Returns the Java file shown in the active editor, which IntelliJ calls the "Current File", or
   * `null` if no Java file is shown there.
   *
   * It depends only on which editor tab is active, not on where the user clicked. Compare
   * [contextJavaFileOrNull]: with `A.java` active and `B.java` open in a second, unfocused split
   * editor, the current file is `A.java`, even when the user clicks the gutter icon in `B.java`.
   */
  private fun currentJavaFileOrNull(project: Project): VirtualFile? =
    FileEditorManager.getInstance(project).selectedFiles.firstOrNull()?.takeIf(::isJavaFile)

  /** Returns [currentJavaFileOrNull] if it has a main class JavaWiz can start, otherwise `null`. */
  private fun currentJavaMainFileOrNull(project: Project): VirtualFile? =
    currentJavaFileOrNull(project)?.takeIf { hasStartableMainClass(it, project) }

  /**
   * Returns the Java file of the component the action was invoked on, or `null` if that is not a
   * Java file.
   *
   * IntelliJ reads it from the clicked component: the editor whose gutter icon or context menu was
   * used, or the selected file or class in the Project tree. Compare [currentJavaFileOrNull], which
   * is the active editor tab no matter where the user clicked: in the example there, the context
   * file of the gutter click is `B.java`. In the toolbar, the context file is whatever has focus,
   * which is why the toolbar ignores it.
   */
  private fun contextJavaFileOrNull(e: AnActionEvent): VirtualFile? =
    e.getData(CommonDataKeys.VIRTUAL_FILE)?.takeIf(::isJavaFile)

  /** Returns [contextJavaFileOrNull] if it has a main class JavaWiz can start, otherwise `null`. */
  private fun contextJavaMainFileOrNull(e: AnActionEvent, project: Project): VirtualFile? =
    contextJavaFileOrNull(e)?.takeIf { hasStartableMainClass(it, project) }

  /** Reports whether [file] is a Java source file, judged by its file type. */
  private fun isJavaFile(file: VirtualFile): Boolean = file.fileType == JavaFileType.INSTANCE

  /**
   * Reports whether [file] has a top-level class with a main method that JavaWiz can start, using the
   * same rule as the gutter icon ([hasJavaWizMainClass]). Needs read access.
   */
  private fun hasStartableMainClass(file: VirtualFile, project: Project): Boolean {
    val javaFile = PsiManager.getInstance(project).findFile(file) as? PsiJavaFile ?: return false
    return hasJavaWizMainClass(javaFile)
  }

  /** Writes [message] to the JavaWiz action log of [project]. */
  private fun log(project: Project, message: String) {
    project.service<LoggerProjectService>().log(LogSource.ACTION, message)
  }

  private companion object {
    /**
     * Place under which IntelliJ builds the gutter icon's tooltip. `ActionPlaces` has no constant
     * for it; see `RunLineMarkerContributor.getText` in the IntelliJ Platform.
     */
    const val GUTTER_TOOLTIP_PLACE = "RunLineMarkerContributor.Tooltip"

    /** Places tied to a clicked file; see [isContextFilePlace]. A click on the gutter icon reports `EDITOR_GUTTER_POPUP`. */
    val CONTEXT_FILE_PLACES = setOf(
      ActionPlaces.EDITOR_GUTTER,
      ActionPlaces.EDITOR_GUTTER_POPUP,
      GUTTER_TOOLTIP_PLACE,
      ActionPlaces.EDITOR_POPUP,
      ActionPlaces.PROJECT_VIEW_POPUP,
    )
  }
}
