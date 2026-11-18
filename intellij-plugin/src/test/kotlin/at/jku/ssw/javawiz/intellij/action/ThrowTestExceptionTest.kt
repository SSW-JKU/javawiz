package at.jku.ssw.javawiz.intellij.action

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionPlaces
import com.intellij.openapi.actionSystem.ActionUiKind
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.application.ReadAction
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase5
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import kotlin.test.assertContains
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Checks the temporary action that throws an exception on purpose, so maintainers can check that
 * error reports reach JetBrains Marketplace. It must stay hidden and do nothing unless the IDE
 * property `javawiz.errorReportTest=true` is set. The tests use the real action from `plugin.xml`.
 */
internal class ThrowTestExceptionTest :
  LightJavaCodeInsightFixtureTestCase5(LightJavaCodeInsightFixtureTestCase.JAVA_25) {

  /** These tests use no test-data files. */
  override fun getTestDataPath(): String = ""

  private val action: AnAction
    get() = assertNotNull(ActionManager.getInstance().getAction("at.jku.ssw.javawiz.intellij.action.ThrowTestException"))

  /** The property is global to the test JVM, so it must not leak into other tests. */
  @AfterEach
  fun clearProperty() {
    System.clearProperty(PROPERTY)
  }

  @Test
  fun testHiddenAndInactiveWithoutProperty() {
    val event = event()
    ReadAction.computeBlocking<Unit, RuntimeException> { action.update(event) }

    assertFalse(event.presentation.isVisible)
    assertFalse(event.presentation.isEnabled)
    // Does nothing, in case the action is run without an update, for example from a keyboard shortcut.
    action.actionPerformed(event)
  }

  @Test
  fun testShownAndThrowsWithProperty() {
    System.setProperty(PROPERTY, "true")
    val event = event()
    ReadAction.computeBlocking<Unit, RuntimeException> { action.update(event) }

    assertTrue(event.presentation.isVisible)
    assertTrue(event.presentation.isEnabled)
    val exception = assertFailsWith<IllegalStateException> { action.actionPerformed(event) }
    assertContains(exception.message.orEmpty(), "thrown on purpose")
  }

  /** Builds the event IntelliJ would pass to the action when it is run from Find Action. */
  private fun event(): AnActionEvent = AnActionEvent.createEvent(
    action, DataContext.EMPTY_CONTEXT, action.templatePresentation.clone(), ActionPlaces.ACTION_SEARCH,
    ActionUiKind.NONE, null,
  )

  private companion object {
    const val PROPERTY = "javawiz.errorReportTest"
  }
}
