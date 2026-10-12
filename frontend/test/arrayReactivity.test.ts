import assert from 'node:assert/strict'
import test from 'node:test'
import { select } from 'd3-selection'
import { isReactive, ref, shallowRef } from 'vue'
import { createServer } from 'vite'

test('imperative D3 handles remain raw inside shallow refs', () => {
  const selection = select(null)
  const handle = shallowRef(selection)

  assert.equal(handle.value, selection)
  assert.equal(isReactive(handle.value), false)
})

test('array access detection observes later changes through its live ref', async () => {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true }
  })
  try {
    const { detectArrayAccesses } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/preprocessing.ts')
    const { processIndex } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/index-processing.ts')
    const processedIndexes = ref([])
    const indexes = []
    const array = {
      element: { id: 7 },
      kind: 'OneDimArrayNode',
      name: 'arr'
    }
    const traceState = {
      stackAfterExecution: [{
        arrayAccessValues: [{
          arrayObjectId: 7,
          indexValues: [0],
          arrayAccess: {
            indexExpressions: [{ expression: 'i', isVariable: true }]
          }
        }]
      }]
    }

    const component = { traceState, indexes, processedIndexes }
    detectArrayAccesses([array], [], component)
    assert.equal(indexes.length, 1)

    processedIndexes.value = [processIndex({ displayString: 'arr[i]', isDetected: false })]
    detectArrayAccesses([array], [], component)

    assert.equal(indexes.length, 1)
  } finally {
    await vite.close()
  }
})
