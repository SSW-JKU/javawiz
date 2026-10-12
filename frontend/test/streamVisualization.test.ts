import test from 'node:test'
import assert from 'node:assert/strict'
import {latestTopLevelStream} from '../src/debugger/streamVisualization.ts'
import type {MarbleDiagramData} from '../src/dto/TraceState.d.ts'

function stream (id: number, parentStreamId: number | null): MarbleDiagramData {
  return {
    kind: 'MarbleDiagramData',
    id,
    parentStreamId,
    marbles: [],
    links: [],
    operationLanes: {},
    layoutCursorX: 50,
    previousOperationId: Number.MAX_SAFE_INTEGER
  }
}

test('selects the newest top-level stream and ignores children', () => {
  const selected = latestTopLevelStream([
    stream(1, null),
    stream(2, 1),
    stream(3, null),
    stream(4, 3)
  ])

  assert.equal(selected?.id, 3)
})

test('returns no stream when only nested streams exist', () => {
  assert.equal(latestTopLevelStream([stream(1, 0)]), undefined)
})
