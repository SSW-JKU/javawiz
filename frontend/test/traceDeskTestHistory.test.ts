import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('Desk Test retains rows across incremental trace updates', async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const module = await vite.ssrLoadModule('/test/traceDeskTestHistory.testSupport.ts')
    await module.runTraceDeskTestHistoryAssertions(assert)
  } finally {
    await vite.close()
  }
})
