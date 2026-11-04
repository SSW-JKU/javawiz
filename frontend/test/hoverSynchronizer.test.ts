import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(async () => await vite.close())

const { HoverSynchronizer } = await vite.ssrLoadModule('/src/hover/HoverSynchronizer.ts')

test('HoverSynchronizer calls handlers immediately and once per hover change', () => {
  const calls: unknown[][] = []
  const handler = (infos: unknown[]) => calls.push(infos)
  HoverSynchronizer.onHover(handler)
  try {
    HoverSynchronizer.hover([{ kind: 'HeapObject', objId: 1 }])
    assert.equal(calls.length, 1, 'the first hover reaches the handler without delay')

    HoverSynchronizer.hover([{ kind: 'HeapObject', objId: 1 }])
    assert.equal(calls.length, 1, 'an identical hover list does not call the handler again')

    HoverSynchronizer.hover([{ kind: 'HeapObject', objId: 2 }])
    assert.equal(calls.length, 2, 'a different hover list calls the handler immediately')
    assert.deepEqual(calls[1], [{ kind: 'HeapObject', objId: 2 }])

    HoverSynchronizer.clear()
    assert.equal(calls.length, 3, 'clearing the hover calls the handler')
    HoverSynchronizer.clear()
    assert.equal(calls.length, 3, 'clearing twice calls the handler once')
  } finally {
    HoverSynchronizer.removeOnHover(handler)
  }
})
