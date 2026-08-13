import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkJavaRuntime,
  MINIMUM_SUPPORTED_JAVA_VERSION,
  parseJavaMajorVersion,
  validateJavaRuntime
} from './JavaRuntime'

test('parses modern java and javac version output', () => {
  assert.equal(parseJavaMajorVersion('openjdk version "25.0.1" 2025-10-21'), 25)
  assert.equal(parseJavaMajorVersion('javac 26-ea'), 26)
  assert.equal(parseJavaMajorVersion('java version "1.8.0_402"'), 8)
})

test('accepts matching supported java and javac versions', () => {
  assert.deepEqual(
    validateJavaRuntime(
      { exitCode: 0, output: 'openjdk version "25.0.1"' },
      { exitCode: 0, output: 'javac 25.0.1' }
    ),
    { ok: true, javaMajorVersion: 25, javacMajorVersion: 25 }
  )
})

test('rejects an unsupported version', () => {
  const result = validateJavaRuntime(
    { exitCode: 0, output: 'openjdk version "21.0.8"' },
    { exitCode: 0, output: 'javac 21.0.8' }
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.message, new RegExp(`requires JDK ${MINIMUM_SUPPORTED_JAVA_VERSION}`))
})

test('rejects mismatched java and javac versions', () => {
  const result = validateJavaRuntime(
    { exitCode: 0, output: 'openjdk version "25.0.1"' },
    { exitCode: 0, output: 'javac 26' }
  )

  assert.equal(result.ok, false)
  assert.match(result.ok ? '' : result.message, /different major versions \(25 and 26\)/)
})

test('reports missing and malformed commands', async () => {
  const missing = await checkJavaRuntime(async command => {
    if (command === 'java') {
      throw new Error('not found')
    }
    return { exitCode: 0, output: 'javac 25' }
  })
  assert.equal(missing.ok, false)
  assert.match(missing.ok ? '' : missing.message, /java command could not be executed/)

  const malformed = validateJavaRuntime(
    { exitCode: 0, output: 'unexpected output' },
    { exitCode: 0, output: 'javac 25' }
  )
  assert.equal(malformed.ok, false)
  assert.match(malformed.ok ? '' : malformed.message, /could not be determined/)

  const failed = validateJavaRuntime(
    { exitCode: 1, output: 'launcher failure' },
    { exitCode: 0, output: 'javac 25' }
  )
  assert.equal(failed.ok, false)
  assert.match(failed.ok ? '' : failed.message, /exited with code 1/)
})
