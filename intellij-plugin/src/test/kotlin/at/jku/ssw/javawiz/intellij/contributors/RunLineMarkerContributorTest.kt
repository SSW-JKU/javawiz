package at.jku.ssw.javawiz.intellij.contributors

import com.intellij.openapi.application.ReadAction
import com.intellij.psi.PsiIdentifier
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase
import com.intellij.testFramework.fixtures.LightJavaCodeInsightFixtureTestCase5
import org.junit.jupiter.api.Test
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Exercises the contributor in a headless, model-level IntelliJ light fixture with real PSI.
 *
 * Although this test is written in Kotlin, `configureByText` receives Java source and parses it
 * into Java PSI. `BasePlatformTestCase` is therefore insufficient because it does not initialize
 * the Java-specific project services. `LightJavaCodeInsightFixtureTestCase5` supplies that Java
 * fixture and connects its lifecycle to the project's JUnit 5 runner.
 *
 * A test supplying another language would load that language's plugin and use its code-insight
 * fixture or dedicated test framework. A language-independent test can use the generic platform
 * fixture instead.
 *
 * See https://plugins.jetbrains.com/docs/intellij/testing-plugins.html and
 * https://plugins.jetbrains.com/docs/intellij/light-and-heavy-tests.html#light-tests.
 */
internal class RunLineMarkerContributorTest :
  LightJavaCodeInsightFixtureTestCase5(LightJavaCodeInsightFixtureTestCase.JAVA_25) {

  /** These tests use inline Java snippets and therefore have no external test-data root. */
  override fun getTestDataPath(): String = ""

  @Test
  fun testRecognizesCompactSourceMainMethod() {
    assertTrue(isMainIdentifierAtCaret("void ma<caret>in() {}", "CompactSource.java"))
  }

  @Test
  fun testRecognizesInstanceAndTraditionalMainMethods() {
    assertTrue(isMainIdentifierAtCaret("class InstanceMain { void ma<caret>in(java.lang.String[] args) {} }"))
    assertTrue(isMainIdentifierAtCaret("class Traditional { public static void ma<caret>in(java.lang.String[] args) {} }"))
  }

  @Test
  fun testRejectsInvalidMainMethods() {
    assertFalse(isMainIdentifierAtCaret("class PrivateMain { private void ma<caret>in() {} }"))
    assertFalse(isMainIdentifierAtCaret("class WrongResult { int ma<caret>in() { return 0; } }"))
    assertFalse(isMainIdentifierAtCaret("class WrongParameter { void ma<caret>in(int[] args) {} }"))
  }

  /**
   * Configures an in-memory Java file and checks the identifier immediately before its caret marker.
   *
   * Inline source keeps these short cases local; larger file-based scenarios belong in `testdata` as
   * described at https://plugins.jetbrains.com/docs/intellij/test-project-and-testdata-directories.html.
   */
  private fun isMainIdentifierAtCaret(source: String, fileName: String = "Main.java"): Boolean {
    // Creates an in-memory Java PSI file and moves the fixture caret to the source's <caret> marker.
    val file = fixture.configureByText(fileName, source)
    // JUnit 5 executes the test on a worker thread, while IntelliJ requires PSI reads inside a read action.
    return ReadAction.computeBlocking<Boolean, RuntimeException> {
      val identifier = file.findElementAt(fixture.caretOffset - 1)
      isJavaWizMainIdentifier(assertIs<PsiIdentifier>(identifier))
    }
  }
}
