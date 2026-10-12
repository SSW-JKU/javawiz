package at.jku.ssw.javawiz.intellij.service.project

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HiddenPathTest {
  @Test
  fun `recognizes dot-prefixed files and directories`() {
    assertTrue(isHiddenFileOrDirectory(".metadata"))
    assertTrue(isHiddenFileOrDirectory(".java"))
  }

  @Test
  fun `retains ordinary file and directory names`() {
    assertFalse(isHiddenFileOrDirectory("src"))
    assertFalse(isHiddenFileOrDirectory("Main.java"))
  }
}
