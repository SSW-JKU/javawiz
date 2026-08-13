package at.jku.ssw.javawiz.intellij.components

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class JavaRuntimeTest {
  @Test
  fun `parses modern and legacy version output`() {
    assertEquals(25, JavaRuntime.parseMajorVersion("openjdk version \"25.0.1\" 2025-10-21"))
    assertEquals(26, JavaRuntime.parseMajorVersion("javac 26-ea"))
    assertEquals(8, JavaRuntime.parseMajorVersion("java version \"1.8.0_402\""))
  }

  @Test
  fun `accepts matching supported commands`() {
    val result = JavaRuntime.validate(
      JavaVersionCommandResult(0, "openjdk version \"25.0.1\""),
      JavaVersionCommandResult(0, "javac 25.0.1"),
    )

    assertEquals(JavaRuntimeValidation.Success(25, 25), result)
  }

  @Test
  fun `rejects unsupported and mismatched commands`() {
    val unsupported = assertIs<JavaRuntimeValidation.Failure>(
      JavaRuntime.validate(
        JavaVersionCommandResult(0, "openjdk version \"21.0.8\""),
        JavaVersionCommandResult(0, "javac 21.0.8"),
      )
    )
    assertTrue(unsupported.message.contains("requires JDK $MINIMUM_SUPPORTED_JAVA_VERSION"))

    val mismatched = assertIs<JavaRuntimeValidation.Failure>(
      JavaRuntime.validate(
        JavaVersionCommandResult(0, "openjdk version \"25.0.1\""),
        JavaVersionCommandResult(0, "javac 26"),
      )
    )
    assertTrue(mismatched.message.contains("different major versions (25 and 26)"))
  }

  @Test
  fun `reports missing and malformed commands`() {
    val missing = assertIs<JavaRuntimeValidation.Failure>(
      JavaRuntime.check { throw java.io.IOException("not found") }
    )
    assertTrue(missing.message.contains("java command could not be executed"))

    val malformed = assertIs<JavaRuntimeValidation.Failure>(
      JavaRuntime.validate(
        JavaVersionCommandResult(0, "unexpected output"),
        JavaVersionCommandResult(0, "javac 25"),
      )
    )
    assertTrue(malformed.message.contains("could not be determined"))

    val failed = assertIs<JavaRuntimeValidation.Failure>(
      JavaRuntime.validate(
        JavaVersionCommandResult(1, "launcher failure"),
        JavaVersionCommandResult(0, "javac 25"),
      )
    )
    assertTrue(failed.message.contains("exited with code 1"))
  }
}
