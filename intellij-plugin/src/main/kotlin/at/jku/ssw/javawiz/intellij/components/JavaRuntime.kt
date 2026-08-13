package at.jku.ssw.javawiz.intellij.components

internal const val MINIMUM_SUPPORTED_JAVA_VERSION = 25

internal data class JavaVersionCommandResult(
  val exitCode: Int,
  val output: String,
)

internal sealed interface JavaRuntimeValidation {
  data class Success(val javaMajorVersion: Int, val javacMajorVersion: Int) : JavaRuntimeValidation
  data class Failure(val message: String) : JavaRuntimeValidation
}

internal object JavaRuntime {
  private val versionPattern = Regex("""(?:version\s+"|\b(?:openjdk|java|javac)\s+)(\d+(?:\.\d+)*)""", RegexOption.IGNORE_CASE)

  fun parseMajorVersion(output: String): Int? {
    // java commonly writes its version to stderr and javac to stdout; callers combine both
    // streams before parsing the stable version marker emitted by either command.
    val version = versionPattern.find(output)?.groupValues?.get(1) ?: return null
    val parts = version.split('.').mapNotNull(String::toIntOrNull)
    return if (parts.firstOrNull() == 1) parts.getOrNull(1) else parts.firstOrNull()
  }

  fun validate(
    javaResult: JavaVersionCommandResult,
    javacResult: JavaVersionCommandResult,
  ): JavaRuntimeValidation {
    validateCommand("java", javaResult)?.let { return it }
    validateCommand("javac", javacResult)?.let { return it }

    val javaMajorVersion = parseMajorVersion(javaResult.output)!!
    val javacMajorVersion = parseMajorVersion(javacResult.output)!!
    if (javaMajorVersion != javacMajorVersion) {
      return failure(
        "The java and javac commands resolve to different major versions ($javaMajorVersion and $javacMajorVersion)."
      )
    }

    return JavaRuntimeValidation.Success(javaMajorVersion, javacMajorVersion)
  }

  fun check(runVersionCommand: (String) -> JavaVersionCommandResult = ::executeVersionCommand): JavaRuntimeValidation {
    val javaResult = try {
      runVersionCommand("java")
    } catch (exception: Exception) {
      return failure("The java command could not be executed (${exception.message ?: exception.javaClass.simpleName}).")
    }

    val javacResult = try {
      runVersionCommand("javac")
    } catch (exception: Exception) {
      return failure("The javac command could not be executed (${exception.message ?: exception.javaClass.simpleName}).")
    }

    return validate(javaResult, javacResult)
  }

  private fun validateCommand(command: String, result: JavaVersionCommandResult): JavaRuntimeValidation.Failure? {
    if (result.exitCode != 0) {
      return failure("The $command -version command exited with code ${result.exitCode}.")
    }

    val majorVersion = parseMajorVersion(result.output)
      ?: return failure("The version reported by $command could not be determined.")
    if (majorVersion < MINIMUM_SUPPORTED_JAVA_VERSION) {
      return failure(
        "$command reports Java $majorVersion, but JavaWiz requires JDK $MINIMUM_SUPPORTED_JAVA_VERSION or newer."
      )
    }

    return null
  }

  private fun failure(reason: String) = JavaRuntimeValidation.Failure(
    "$reason Configure JAVA_HOME and PATH so java and javac both resolve to the same JDK " +
      "$MINIMUM_SUPPORTED_JAVA_VERSION or newer."
  )

  private fun executeVersionCommand(command: String): JavaVersionCommandResult {
    val process = ProcessBuilder(command, "-version")
      .redirectErrorStream(true)
      .start()
    val output = process.inputStream.bufferedReader().use { it.readText() }.trim()
    return JavaVersionCommandResult(process.waitFor(), output)
  }
}
