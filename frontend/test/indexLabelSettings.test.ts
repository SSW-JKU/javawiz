import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestServer } from './viteTestServer.ts'

test('saved index label settings keep their expression, also from the old displayString field', async () => {
  const vite = await createTestServer()
  try {
    const { parseSavedIndexLabelSettings } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/index-processing.ts')

    // nothing saved yet, or an empty entry
    assert.deepEqual(parseSavedIndexLabelSettings(null), [])
    assert.deepEqual(parseSavedIndexLabelSettings(''), [])
    assert.deepEqual(
      parseSavedIndexLabelSettings(JSON.stringify([
        // saved by an older version
        { displayString: 'arr[i]', isDetected: false },
        // saved by the current version
        { expression: '[j]', isDetected: false, isHidden: true }
      ])),
      [
        { expression: 'arr[i]', isDetected: false },
        { expression: '[j]', isDetected: false, isHidden: true }
      ]
    )
  } finally {
    await vite.close()
  }
})
