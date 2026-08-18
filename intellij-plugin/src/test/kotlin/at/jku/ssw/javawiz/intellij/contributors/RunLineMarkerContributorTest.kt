package at.jku.ssw.javawiz.intellij.contributors

import com.intellij.openapi.application.WriteAction
import com.intellij.openapi.roots.LanguageLevelProjectExtension
import com.intellij.pom.java.LanguageLevel
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiIdentifier
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Exercises the contributor in a headless, model-level IntelliJ light fixture with real PSI.
 *
 * See https://plugins.jetbrains.com/docs/intellij/testing-plugins.html and
 * https://plugins.jetbrains.com/docs/intellij/light-and-heavy-tests.html#light-tests.
 */
internal class RunLineMarkerContributorTest : BasePlatformTestCase() {
  override fun setUp() {
    super.setUp()
    WriteAction.runAndWait<RuntimeException> {
      LanguageLevelProjectExtension.getInstance(project).languageLevel = LanguageLevel.JDK_25
    }
  }

  fun testRecognizesCompactSourceMainMethod() {
    assertTrue(isJavaWizMainIdentifier(identifierAtCaret("void ma<caret>in() {}", "CompactSource.java")))
  }

  fun testRecognizesInstanceAndTraditionalMainMethods() {
    val instanceIdentifier = identifierAtCaret("class InstanceMain { void ma<caret>in(java.lang.String[] args) {} }")
    assertTrue(isJavaWizMainIdentifier(instanceIdentifier))
    assertTrue(isJavaWizMainIdentifier(identifierAtCaret("class Traditional { public static void ma<caret>in(java.lang.String[] args) {} }")))
  }

  fun testRejectsInvalidMainMethods() {
    assertFalse(isJavaWizMainIdentifier(identifierAtCaret("class PrivateMain { private void ma<caret>in() {} }")))
    assertFalse(isJavaWizMainIdentifier(identifierAtCaret("class WrongResult { int ma<caret>in() { return 0; } }")))
    assertFalse(isJavaWizMainIdentifier(identifierAtCaret("class WrongParameter { void ma<caret>in(int[] args) {} }")))
  }

  /**
   * Configures an in-memory Java file and returns the identifier immediately before its caret marker.
   *
   * Inline source keeps these short cases local; larger file-based scenarios belong in `testdata` as
   * described at https://plugins.jetbrains.com/docs/intellij/test-project-and-testdata-directories.html.
   */
  private fun identifierAtCaret(source: String, fileName: String = "Main.java"): PsiElement {
    val file = myFixture.configureByText(fileName, source)
    val identifier = file.findElementAt(myFixture.caretOffset - 1)
    assertInstanceOf(identifier, PsiIdentifier::class.java)
    return identifier!!
  }
}
