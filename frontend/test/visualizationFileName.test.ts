import assert from 'node:assert/strict'
import test from 'node:test'
import { createVisualizationExportFileName } from '../src/helpers/visualizationFileName.ts'

test('formats a zero-padded local timestamp before the visualization slug', () => {
  const date = new Date(2026, 8, 3, 4, 5)

  assert.equal(
    createVisualizationExportFileName('Flow Chart', date),
    '2026-09-03-04-05-javawiz-flow-chart'
  )
})

test('retains the existing lower-case slug behavior', () => {
  const date = new Date(2026, 10, 13, 14, 15)

  assert.equal(
    createVisualizationExportFileName('  Memory / View  ', date),
    '2026-11-13-14-15-javawiz-memory-view'
  )
})
