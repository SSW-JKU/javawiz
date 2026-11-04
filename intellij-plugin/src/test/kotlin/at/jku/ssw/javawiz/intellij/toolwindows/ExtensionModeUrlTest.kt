package at.jku.ssw.javawiz.intellij.toolwindows

import kotlin.test.Test
import kotlin.test.assertEquals

class ExtensionModeUrlTest {
  @Test
  fun `names the plugin and backend ports in the extension-mode URL`() {
    assertEquals(
      "http://localhost:43210/extensionMode?pluginPort=43211&backendPort=43212",
      buildExtensionModeUrl("http://localhost", 43210, "/", 43211, 43212),
    )
  }
}
