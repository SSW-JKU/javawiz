import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

async function runSupport (assertions: string): Promise<void> {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const module = await vite.ssrLoadModule('/test/traceDeskTestHistory.testSupport.ts')
    await module[assertions](assert)
  } finally {
    await vite.close()
  }
}

test('Desk Test retains rows across incremental trace updates', async () => {
  await runSupport('runTraceDeskTestHistoryAssertions')
})

test('Desk Test shows a static reference after it is assigned a different object', async () => {
  await runSupport('runDeskTestStaticReferenceAssertions')
})

test('Desk Test shows a changed static when another class has a static with the same name', async () => {
  await runSupport('runDeskTestStaticSameNameAssertions')
})
