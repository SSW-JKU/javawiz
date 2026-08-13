import { execFile } from 'child_process'

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

export function validateJavaRuntime(
  javaResult: JavaVersionCommandResult,
  javacResult: JavaVersionCommandResult
): JavaRuntimeValidation {
  const javaValidation = validateCommandResult('java', javaResult)
  if (!javaValidation.ok) {
    return javaValidation
  }

  const javacValidation = validateCommandResult('javac', javacResult)
  if (!javacValidation.ok) {
    return javacValidation
  }

  const javaMajorVersion = javaValidation.majorVersion
  const javacMajorVersion = javacValidation.majorVersion
  if (javaMajorVersion !== javacMajorVersion) {
    return failure(
      `The java and javac commands resolve to different major versions (${javaMajorVersion} and ${javacMajorVersion}).`
    )
  }

  return { ok: true, javaMajorVersion, javacMajorVersion }
}

export async function checkJavaRuntime(
  runVersionCommand: VersionCommandRunner = executeVersionCommand
): Promise<JavaRuntimeValidation> {
  let javaResult: JavaVersionCommandResult
  try {
    javaResult = await runVersionCommand('java')
  } catch (error) {
    return failure(`The java command could not be executed (${errorMessage(error)}).`)
  }

  let javacResult: JavaVersionCommandResult
  try {
    javacResult = await runVersionCommand('javac')
  } catch (error) {
    return failure(`The javac command could not be executed (${errorMessage(error)}).`)
  }

  return validateJavaRuntime(javaResult, javacResult)
}

function validateCommandResult(
  command: JavaVersionCommand,
  result: JavaVersionCommandResult
): Extract<JavaRuntimeValidation, { ok: false }> | { ok: true, majorVersion: number } {
  if (result.exitCode !== 0) {
    return failure(`The ${command} -version command exited with code ${result.exitCode}.`)
  }

  const majorVersion = parseJavaMajorVersion(result.output)
  if (majorVersion === undefined) {
    return failure(`The version reported by ${command} could not be determined.`)
  }
  if (majorVersion < MINIMUM_SUPPORTED_JAVA_VERSION) {
    return failure(
      `${command} reports Java ${majorVersion}, but JavaWiz requires JDK ${MINIMUM_SUPPORTED_JAVA_VERSION} or newer.`
    )
  }

  return { ok: true, majorVersion }
}

function failure(reason: string): Extract<JavaRuntimeValidation, { ok: false }> {
  return {
    ok: false,
    message: `${reason} Configure JAVA_HOME and PATH so java and javac both resolve to the same JDK ${MINIMUM_SUPPORTED_JAVA_VERSION} or newer.`
  }
}

function executeVersionCommand(command: JavaVersionCommand): Promise<JavaVersionCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, ['-version'], { windowsHide: true }, (error, stdout, stderr) => {
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
