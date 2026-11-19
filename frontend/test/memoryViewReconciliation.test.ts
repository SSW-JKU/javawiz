import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestServer } from './viteTestServer.ts'

test('the modular Memory View preserves the reconciled renderer contracts', async () => {
  const vite = await createTestServer()
  try {
    const module = await vite.ssrLoadModule('/test/memoryViewReconciliation.testSupport.ts')
    await module.runMemoryViewReconciliationAssertions(assert)
  } finally {
    await vite.close()
  }
})
