import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

// JW-681: the sequence diagram rebuilds its history from the batches that Trace records.
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(async () => await vite.close())

const support = await vite.ssrLoadModule('/test/sequenceDiagramHistoryReplay.testSupport.ts')

test('the reference program produces call and return arrows', () => {
  support.assertReferenceIsMeaningful(assert)
})

test('Trace records batch start indices and no sequence diagram data', () => {
  support.assertTraceRecordsBatchesOnly(assert)
})

test('a replayed history equals a history fed batch by batch', () => {
  support.assertReplayMatchesIncremental(assert)
})

test('ending all lifelines after a replay matches and is idempotent', () => {
  support.assertProgramEndMatches(assert)
})
