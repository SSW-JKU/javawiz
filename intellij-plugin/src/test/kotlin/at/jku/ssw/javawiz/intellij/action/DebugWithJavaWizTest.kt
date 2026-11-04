package at.jku.ssw.javawiz.intellij.action

import at.jku.ssw.javawiz.intellij.general.Globals
import com.intellij.execution.RunManager
import com.intellij.execution.application.ApplicationConfiguration
import com.intellij.execution.application.ApplicationConfigurationType
import com.intellij.execution.configurations.ConfigurationFactory
import com.intellij.execution.configurations.RunConfiguration
import com.intellij.execution.remote.RemoteConfigurationType
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUiKind
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.actionSystem.impl.SimpleDataContext
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.ex.FileEditorManagerEx
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiMethod
import com.intellij.psi.PsiJavaFile
import com.intellij.psi.PsiManager
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase5
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

/**
 * Checks how the Debug with JavaWiz action is registered and when it is offered, using the real
 * action registered from `plugin.xml` in a light Java project.
 *
 * Only `update` is called. The fixture's `testAction` helper would also run `actionPerformed`
 * whenever the action is enabled, which would start a real JavaWiz session.
 */
internal class DebugWithJavaWizTest :
  LightJavaCodeInsightFixtureTestCase5(LightJavaCodeInsightFixtureTestCase.JAVA_25) {

  /** These tests use inline snippets and therefore have no external test-data root. */
  override fun getTestDataPath(): String = ""

  private val action get() = ActionManager.getInstance().getAction(Globals.Props.ACTION_ID_RUN)

  /** The light project is shared between tests, so run configurations must not leak into the next test. */
  @AfterEach
  fun removeRunConfigurations() {
    ApplicationManager.getApplication().invokeAndWait {
      val runManager = RunManager.getInstance(fixture.project)
      runManager.allSettings.forEach(runManager::removeConfiguration)
      runManager.selectedConfiguration = null
    }
  }

  @Test
  fun testLaunchFileFromToolbarUsesSelectedApplicationConfiguration() {
    val other = addOtherMainClass()
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Other")

    assertEquals(other, launchFileOrNull(ActionPlaces.MAIN_TOOLBAR, main))
  }

  @Test
  fun testLaunchFileFromRunMenuUsesSelectedApplicationConfiguration() {
    val other = addOtherMainClass()
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Other")

    assertEquals(other, launchFileOrNull(ActionPlaces.MAIN_MENU, main))
  }

  @Test
  fun testLaunchFileFromEditorIgnoresRunConfiguration() {
    addOtherMainClass()
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Other")

    assertEquals(main, launchFileOrNull(ActionPlaces.EDITOR_POPUP, main))
    assertEquals(main, launchFileOrNull(ActionPlaces.EDITOR_GUTTER_POPUP, main))
  }

  @Test
  fun testLaunchFileFromToolbarWithoutApplicationConfigurationUsesEditorFile() {
    val other = addOtherMainClass()
    val main = configureMainClass()

    // No run configuration selected ("Current File"): like IntelliJ's Run button, the toolbar uses
    // the file in the editor, even if another file is selected in the focused Project tree.
    assertEquals(main, launchFileOrNull(ActionPlaces.MAIN_TOOLBAR, other))
  }

  @Test
  fun testDisablesToolbarActionForUnresolvableApplicationConfiguration() {
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Missing")

    assertNull(launchFileOrNull(ActionPlaces.MAIN_TOOLBAR, main))
    assertDisabledWithRunConfigurationHint(updatedPresentation(dataContextFor(main), ActionPlaces.MAIN_TOOLBAR))
  }

  @Test
  fun testDisablesToolbarActionForNonApplicationConfiguration() {
    val main = configureMainClass()
    // Remote JVM Debug stands in for any run configuration that does not start a Java main class.
    selectConfiguration(RemoteConfigurationType.getInstance().configurationFactories.single())

    assertNull(launchFileOrNull(ActionPlaces.MAIN_MENU, main))
    assertDisabledWithRunConfigurationHint(updatedPresentation(dataContextFor(main), ActionPlaces.MAIN_MENU))
    // Context menus and the gutter ignore the run configuration.
    assertEquals(main, launchFileOrNull(ActionPlaces.EDITOR_POPUP, main))
  }

  @Test
  fun testDisablesToolbarActionWithoutEditor() {
    val other = addOtherMainClass()
    ApplicationManager.getApplication().invokeAndWait {
      FileEditorManagerEx.getInstanceEx(fixture.project).closeAllFiles()
    }

    // The Project tree selects a Java file, but "Current File" means the file in the editor. Like
    // IntelliJ's Run button, the toolbar button then stays in place but cannot be clicked, and its
    // text (shown as the toolbar tooltip) says why.
    assertDisabledWithReason(
      updatedPresentation(dataContextFor(other), ActionPlaces.MAIN_TOOLBAR),
      "Cannot debug with JavaWiz: the editor is not in focus",
    )
  }

  @Test
  fun testDisablesToolbarActionWithoutJavaApplicationInEditor() {
    val other = addOtherMainClass()

    fixture.configureByText("notes.txt", "text")
    assertDisabledWithReason(
      updatedPresentation(dataContextFor(other), ActionPlaces.MAIN_TOOLBAR),
      "Cannot debug with JavaWiz: no Java application selected in editor",
    )

  }

  @Test
  fun testDisablesToolbarActionForJavaFileWithoutMainInEditor() {
    // A Java file without a main method cannot be started. Starting it would make the backend run
    // the first main class it finds instead.
    val helper = fixture.configureByText("Helper.java", "class Helper {}").virtualFile

    assertNull(launchFileOrNull(ActionPlaces.MAIN_TOOLBAR, helper))
    assertDisabledWithReason(
      updatedPresentation(dataContextFor(helper), ActionPlaces.MAIN_TOOLBAR),
      "Cannot debug with JavaWiz: Java file without main selected",
    )
  }

  @Test
  fun testGutterTooltipNamesTheMarkerFile() {
    val other = addOtherMainClass()
    configureMainClass()
    val mainMethod = ReadAction.computeBlocking<PsiMethod, RuntimeException> {
      (PsiManager.getInstance(fixture.project).findFile(other) as PsiJavaFile).classes.single()
        .findMethodsByName("main", false).single()
    }
    // IntelliJ builds the gutter icon's tooltip with this place and only the project and the
    // marker's PSI element, without a file (RunLineMarkerContributor.getText). Main.java is in the
    // editor, so the tooltip must take the file from the element.
    val tooltipContext = SimpleDataContext.builder()
      .add(CommonDataKeys.PROJECT, fixture.project)
      .add(CommonDataKeys.PSI_ELEMENT, mainMethod)
      .build()

    val presentation = updatedPresentation(tooltipContext, "RunLineMarkerContributor.Tooltip")

    assertEquals("Debug Other.java with JavaWiz", presentation.text)
  }

  @Test
  fun testLaunchFileFromOtherPlacesFollowsRunWidget() {
    val other = addOtherMainClass()
    val main = configureMainClass()

    // A keyboard shortcut or Find Action, invoked while the Project tree selects Other.java, acts
    // like the toolbar: "Current File" is the file in the editor.
    assertEquals(main, launchFileOrNull(ActionPlaces.KEYBOARD_SHORTCUT, other))
    assertEquals(main, launchFileOrNull(ActionPlaces.ACTION_SEARCH, other))

    selectApplicationConfiguration("pkg.Other")
    assertEquals(other, launchFileOrNull(ActionPlaces.KEYBOARD_SHORTCUT, main))
  }

  @Test
  fun testLaunchFileFromProjectViewPopupUsesClickedFile() {
    val other = addOtherMainClass()
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Other")

    assertEquals(main, launchFileOrNull(ActionPlaces.PROJECT_VIEW_POPUP, main))
    assertEquals(other, launchFileOrNull(ActionPlaces.PROJECT_VIEW_POPUP, other))
  }

  @Test
  fun testProjectViewPopupOffersActionOnlyForFilesWithMainMethod() {
    val other = addOtherMainClass()
    val compact = fixture.addFileToProject("Compact.java", "void main() {}").virtualFile
    val helper = fixture.addFileToProject("pkg/Helper.java", "package pkg; class Helper {}").virtualFile

    val otherPresentation = updatedPresentation(dataContextFor(other), ActionPlaces.PROJECT_VIEW_POPUP)
    assertTrue(otherPresentation.isVisible)
    assertEquals("Debug Other.java with JavaWiz", otherPresentation.text)

    assertTrue(updatedPresentation(dataContextFor(compact), ActionPlaces.PROJECT_VIEW_POPUP).isVisible)
    assertFalse(updatedPresentation(dataContextFor(helper), ActionPlaces.PROJECT_VIEW_POPUP).isVisible)
  }

  @Test
  fun testActionIsRegisteredUnderConfiguredId() {
    assertIs<DebugWithJavaWiz>(action)
    assertEquals(Globals.Props.GUI_BUTTON_RUN, action.templatePresentation.text)
  }

  @Test
  fun testShowsStartActionForJavaFile() {
    val file = fixture.configureByText("Main.java", "class Main { public static void main(String[] args) {} }")

    val presentation = updatedPresentation(dataContextFor(file.virtualFile), ActionPlaces.EDITOR_POPUP)

    assertTrue(presentation.isVisible)
    assertTrue(presentation.isEnabled)
    assertEquals("Debug Main.java with JavaWiz", presentation.text)
    assertSame(Globals.GUI.GUI_ICON_RUN, presentation.icon)
  }

  @Test
  fun testToolbarLabelNamesSelectedRunConfigurationFile() {
    addOtherMainClass()
    val main = configureMainClass()
    selectApplicationConfiguration("pkg.Other")

    val presentation = updatedPresentation(dataContextFor(main), ActionPlaces.MAIN_TOOLBAR)

    assertEquals("Debug Other.java with JavaWiz", presentation.text)
  }

  @Test
  fun testLabelKeepsUnderscoresInFileName() {
    // In menu texts, IntelliJ normally turns `_` into a keyboard-shortcut marker and hides it.
    val file = fixture.configureByText("My_Main.java", "class My_Main { public static void main(String[] args) {} }")

    val presentation = updatedPresentation(dataContextFor(file.virtualFile), ActionPlaces.EDITOR_POPUP)

    assertEquals("Debug My_Main.java with JavaWiz", presentation.text)
  }

  @Test
  fun testHidesActionForNonJavaFile() {
    val file = fixture.configureByText("notes.txt", "text")

    val presentation = updatedPresentation(dataContextFor(file.virtualFile), ActionPlaces.EDITOR_POPUP)

    assertFalse(presentation.isVisible)
    assertFalse(presentation.isEnabled)
  }

  @Test
  fun testEditorPopupHidesActionForJavaFileWithoutMain() {
    // Starting a file without a main method would make the backend run the first main class it finds.
    val helper = fixture.configureByText("Helper.java", "class Helper {}")

    val presentation = updatedPresentation(dataContextFor(helper.virtualFile), ActionPlaces.EDITOR_POPUP)

    assertFalse(presentation.isVisible)
    assertFalse(presentation.isEnabled)
  }

  @Test
  fun testHidesActionWithoutProject() {
    val presentation = updatedPresentation(DataContext.EMPTY_CONTEXT)

    assertFalse(presentation.isVisible)
    assertFalse(presentation.isEnabled)
  }

  /**
   * Describes the editor state an action sees: the open project and the file it acts on.
   * `SimpleDataContext` builds this lookup table directly instead of deriving it from a UI component.
   */
  private fun dataContextFor(file: com.intellij.openapi.vfs.VirtualFile): DataContext =
    SimpleDataContext.builder()
      .add(CommonDataKeys.PROJECT, fixture.project)
      .add(CommonDataKeys.VIRTUAL_FILE, file)
      .build()

  private fun addOtherMainClass(): VirtualFile =
    fixture.addFileToProject(
      "pkg/Other.java",
      "package pkg; public class Other { public static void main(String[] args) {} }",
    ).virtualFile

  private fun configureMainClass(): VirtualFile =
    fixture.configureByText("Main.java", "public class Main { public static void main(String[] args) {} }").virtualFile

  /** Creates and selects a Java Application run configuration, as the run widget does. */
  private fun selectApplicationConfiguration(mainClassName: String) {
    selectConfiguration(ApplicationConfigurationType.getInstance().configurationFactories.single()) {
      val configuration = it as ApplicationConfiguration
      configuration.setModule(fixture.module)
      configuration.mainClassName = mainClassName
    }
  }

  /** Creates a run configuration with [factory], lets [configure] adjust it, and selects it. */
  private fun selectConfiguration(factory: ConfigurationFactory, configure: (RunConfiguration) -> Unit = {}) {
    ApplicationManager.getApplication().invokeAndWait {
      val runManager = RunManager.getInstance(fixture.project)
      val settings = runManager.createConfiguration("Selected", factory)
      configure(settings.configuration)
      runManager.addConfiguration(settings)
      runManager.selectedConfiguration = settings
    }
  }

  private fun assertDisabledWithRunConfigurationHint(presentation: Presentation) =
    assertDisabledWithReason(presentation, "Cannot debug with JavaWiz: no Java application selected as run configuration")

  /** Checks that the action stays visible but disabled, and that its text gives [reason]. */
  private fun assertDisabledWithReason(presentation: Presentation, reason: String) {
    assertTrue(presentation.isVisible)
    assertFalse(presentation.isEnabled)
    assertEquals(reason, presentation.text)
  }

  /**
   * Returns the file the action would launch when invoked at [place] with [contextFile] as the file
   * from the action context. Runs on the UI thread, where IntelliJ calls `actionPerformed`.
   */
  private fun launchFileOrNull(place: String, contextFile: VirtualFile): VirtualFile? {
    val event = AnActionEvent.createEvent(
      action, dataContextFor(contextFile), action.templatePresentation.clone(), place, ActionUiKind.NONE, null,
    )
    var result: VirtualFile? = null
    ApplicationManager.getApplication().invokeAndWait {
      result = (action as DebugWithJavaWiz).launchFileOrNull(event, fixture.project)
    }
    return result
  }

  /** Runs the action's `update` for [dataContext] at [place] and returns the resulting presentation. */
  private fun updatedPresentation(dataContext: DataContext, place: String = ActionPlaces.UNKNOWN): Presentation {
    // createEvent builds the event IntelliJ would pass to an action, with its own presentation copy.
    val event = AnActionEvent.createEvent(
      action, dataContext, action.templatePresentation.clone(), place, ActionUiKind.NONE, null,
    )
    // The action updates on a background thread, where IntelliJ holds a read action during update.
    ReadAction.computeBlocking<Unit, RuntimeException> { action.update(event) }
    return event.presentation
  }
}
