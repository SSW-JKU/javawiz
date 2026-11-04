package at.jku.ssw.javawiz.intellij.service.project

import at.jku.ssw.javawiz.intellij.general.Globals
import com.intellij.notification.Notification
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.testFramework.PlatformTestUtil
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase5
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * Checks the project service's user-visible error paths that work without a running JavaWiz session.
 */
internal class JavaWizProjectServiceTest :
  LightJavaCodeInsightFixtureTestCase5(LightJavaCodeInsightFixtureTestCase.JAVA_25) {

  /** These tests use no source files and therefore have no external test-data root. */
  override fun getTestDataPath(): String = ""

  private val service get() = fixture.project.service<JavaWizProjectService>()

  @Test
  fun testShowsNotificationsWithMappedType() {
    val notifications = mutableListOf<Notification>()
    // Notifications.TOPIC is the application-wide channel on which IntelliJ announces each notification.
    ApplicationManager.getApplication().messageBus.connect(fixture.testRootDisposable)
      .subscribe(Notifications.TOPIC, object : Notifications {
        override fun notify(notification: Notification) {
          notifications += notification
        }
      })
    val expectedTypes = listOf(
      "information" to NotificationType.INFORMATION,
      "warning" to NotificationType.WARNING,
      "error" to NotificationType.ERROR,
      "unexpected" to NotificationType.INFORMATION,
    )

    try {
      for ((type, _) in expectedTypes) {
        service.showInformationMessage(type, "message-$type", focusFrontend = false)
      }
      // Off the UI thread, IntelliJ delivers notifications with invokeLater; run that queued work.
      ApplicationManager.getApplication().invokeAndWait {
        PlatformTestUtil.dispatchAllInvocationEventsInIdeEventQueue()
      }

      assertEquals(
        expectedTypes.map { (type, notificationType) -> "message-$type" to notificationType },
        notifications.map { it.content to it.type },
      )
      for (notification in notifications) {
        assertEquals(Globals.Props.NOTIFICATION_GROUPID, notification.groupId)
        assertEquals(Globals.Props.NOTIFICATION_TITLE, notification.title)
      }
    } finally {
      notifications.forEach(Notification::expire)
    }
  }

  @Test
  fun testEndDebugWithoutSessionDoesNothing() {
    var callbackInvoked = false

    service.endDebug { callbackInvoked = true }

    assertFalse(callbackInvoked)
    assertFalse(service.isJavaWizRunning)
    assertFalse(service.connectionInitialized)
    assertEquals(listOf(-1, -1, -1), listOf(service.frontendPort, service.communicationPort, service.debuggerPort))
  }
}
