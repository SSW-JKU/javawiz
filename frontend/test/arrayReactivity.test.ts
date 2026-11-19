import assert from 'node:assert/strict'
import test from 'node:test'
import { select } from 'd3-selection'
import { isReactive, ref, shallowRef } from 'vue'
import { createTestServer } from './viteTestServer.ts'

test('imperative D3 handles remain raw inside shallow refs', () => {
  const selection = select(null)
  const handle = shallowRef(selection)

  assert.equal(handle.value, selection)
  assert.equal(isReactive(handle.value), false)
})

test('array access detection observes later changes through its live ref', async () => {
  const vite = await createTestServer()
  try {
    const { detectArrayAccesses } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/preprocessing.ts')
    const { parseIndexLabelSetting } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/index-processing.ts')
    const parsedIndexLabelSettings = ref([])
    const indexLabelSettings = []
    const array = {
      traceElement: { id: 7 },
      kind: 'OneDimArrayBox',
      label: 'arr'
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

    const component = { traceState, indexLabelSettings, parsedIndexLabelSettings }
    detectArrayAccesses([array], [], component)
    assert.equal(indexLabelSettings.length, 1)

    parsedIndexLabelSettings.value = [parseIndexLabelSetting({ expression: 'arr[i]', isDetected: false })]
    detectArrayAccesses([array], [], component)

    assert.equal(indexLabelSettings.length, 1)
  } finally {
    await vite.close()
  }
})
