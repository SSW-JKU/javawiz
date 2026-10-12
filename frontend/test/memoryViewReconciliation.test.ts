import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('the modular Memory View preserves the reconciled renderer contracts', async () => {
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  try {
    const module = await vite.ssrLoadModule('/test/memoryViewReconciliation.testSupport.ts')
    await module.runMemoryViewReconciliationAssertions(assert)
  } finally {
    await vite.close()
  }
})
