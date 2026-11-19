import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestServer } from './viteTestServer.ts'

async function runSupport (assertions: string): Promise<void> {
  const vite = await createTestServer()
  try {
    const module = await vite.ssrLoadModule('/test/traceActionChanges.testSupport.ts')
    await module[assertions](assert)
  } finally {
    await vite.close()
  }
}

test('a multi-state action highlights every change since the shown state', async () => {
  await runSupport('runMultiStateActionAssertions')
})

test('a single step highlights only its own change', async () => {
  await runSupport('runSingleStepAssertions')
})

test('a value changed and changed back is not highlighted', async () => {
  await runSupport('runChangedBackAssertions')
})

test('entering a method highlights its parameters', async () => {
  await runSupport('runEnterMethodAssertions')
})

test('the comparison across several states leaves the per-step flags unchanged', async () => {
  await runSupport('runPerStepFlagsKeptAssertions')
})

test('a step that creates an object marks it as new', async () => {
  await runSupport('runNewHeapItemAssertions')
})
