import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(async () => await vite.close())

const support = await vite.ssrLoadModule('/test/memoryViewAllocation.testSupport.ts')

for (const allocationCase of support.createAllocationCases()) {
  test(`Memory View calculates exact allocation for ${allocationCase.name}`, () => {
    assert.equal(allocationCase.actual, allocationCase.expected)
  })
}
