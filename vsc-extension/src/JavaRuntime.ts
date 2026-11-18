import { execFile } from 'child_process'
import path from 'path'

export const MINIMUM_SUPPORTED_JAVA_VERSION = 25

export type JavaVersionCommand = 'java' | 'javac'

export type JavaVersionCommandResult = {
  exitCode: number,
  output: string
}

export type JavaRuntimeValidation =
  | { ok: true, javaMajorVersion: number, javacMajorVersion: number }
  | { ok: false, message: string }

export class JavaRuntimeCompatibilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JavaRuntimeCompatibilityError'
  }
}

type VersionCommandRunner = (command: JavaVersionCommand) => Promise<JavaVersionCommandResult>

/**
 * Returns the program to run for `java` or `javac`.
 *
 * Without a JDK folder, the bare command is returned, so the operating system finds it on `PATH`.
 * With a JDK folder, the program in its `bin` folder is returned:
 *
 *     javaExecutable('java')                 // 'java'
 *     javaExecutable('javac', '/opt/jdk-25') // '/opt/jdk-25/bin/javac' ('...\\bin\\javac.exe' on Windows)
 *
 * @param command the JDK program to run
 * @param javaHome the JDK folder, or `undefined` to use `PATH`
 */
export function javaExecutable(command: JavaVersionCommand, javaHome?: string): string {
  if (javaHome === undefined) {
    return command
  }
  return path.join(javaHome, 'bin', process.platform === 'win32' ? `${command}.exe` : command)
}

export function parseJavaMajorVersion(output: string): number | undefined {
  // java writes its version to stderr on common JDKs, while javac uses stdout. Both outputs
  // reach this parser, which accepts the stable version markers emitted by either command.
  const match = output.match(/(?:version\s+"|\b(?:openjdk|java|javac)\s+)(\d+(?:\.\d+)*)/i)
  if (!match) {
    return undefined
  }

  const parts = match[1].split('.').map(Number)
  return parts[0] === 1 ? parts[1] : parts[0]
}

/**
 * Checks the `-version` output of `java` and `javac`.
 *
 * @param javaHome the configured JDK folder, if any; it only changes the hint in the error message
 */
export function validateJavaRuntime(
  javaResult: JavaVersionCommandResult,
  javacResult: JavaVersionCommandResult,
  javaHome?: string
): JavaRuntimeValidation {
  const javaValidation = validateCommandResult('java', javaResult, javaHome)
  if (!javaValidation.ok) {
    return javaValidation
  }

  const javacValidation = validateCommandResult('javac', javacResult, javaHome)
  if (!javacValidation.ok) {
    return javacValidation
  }

  const javaMajorVersion = javaValidation.majorVersion
  const javacMajorVersion = javacValidation.majorVersion
  if (javaMajorVersion !== javacMajorVersion) {
    return failure(
      `The java and javac commands resolve to different major versions (${javaMajorVersion} and ${javacMajorVersion}).`,
      javaHome
    )
  }

  return { ok: true, javaMajorVersion, javacMajorVersion }
}

/**
 * Runs `java -version` and `javac -version` and checks that both report the same supported JDK.
 *
 * @param javaHome the JDK folder whose `bin` programs are checked, or `undefined` to check the `PATH` commands
 * @param runVersionCommand runs one version command; tests replace it to avoid starting real processes
 */
export async function checkJavaRuntime(
  javaHome?: string,
  runVersionCommand: VersionCommandRunner = command => executeVersionCommand(javaExecutable(command, javaHome))
): Promise<JavaRuntimeValidation> {
  let javaResult: JavaVersionCommandResult
  try {
    javaResult = await runVersionCommand('java')
  } catch (error) {
    return failure(`The java command could not be executed (${errorMessage(error)}).`, javaHome)
  }

  let javacResult: JavaVersionCommandResult
  try {
    javacResult = await runVersionCommand('javac')
  } catch (error) {
    return failure(`The javac command could not be executed (${errorMessage(error)}).`, javaHome)
  }

  return validateJavaRuntime(javaResult, javacResult, javaHome)
}

function validateCommandResult(
  command: JavaVersionCommand,
  result: JavaVersionCommandResult,
  javaHome: string | undefined
): Extract<JavaRuntimeValidation, { ok: false }> | { ok: true, majorVersion: number } {
  if (result.exitCode !== 0) {
    return failure(`The ${command} -version command exited with code ${result.exitCode}.`, javaHome)
  }

  const majorVersion = parseJavaMajorVersion(result.output)
  if (majorVersion === undefined) {
    return failure(`The version reported by ${command} could not be determined.`, javaHome)
  }
  if (majorVersion < MINIMUM_SUPPORTED_JAVA_VERSION) {
    return failure(
      `${command} reports Java ${majorVersion}, but JavaWiz requires JDK ${MINIMUM_SUPPORTED_JAVA_VERSION} or newer.`,
      javaHome
    )
  }

  return { ok: true, majorVersion }
}

function failure(reason: string, javaHome: string | undefined): Extract<JavaRuntimeValidation, { ok: false }> {
  const hint = javaHome === undefined
    ? `Configure JAVA_HOME and PATH so java and javac both resolve to the same JDK ${MINIMUM_SUPPORTED_JAVA_VERSION} or newer.`
    : `The VS Code setting java.jdt.ls.java.home points to "${javaHome}". Set it to a JDK ${MINIMUM_SUPPORTED_JAVA_VERSION} or newer, or remove it to use the java and javac commands from PATH.`
  return { ok: false, message: `${reason} ${hint}` }
}

function executeVersionCommand(executable: string): Promise<JavaVersionCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(executable, ['-version'], { windowsHide: true }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {
        reject(error)
        return
      }
      resolve({
        exitCode: typeof error?.code === 'number' ? error.code : 0,
        output: `${stdout}\n${stderr}`.trim()
      })
    })
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
