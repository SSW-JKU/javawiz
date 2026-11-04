import test from 'node:test'
import assert from 'node:assert/strict'
import {collectionDirection, latestTopLevelStream, placeTracks} from '../src/debugger/streamVisualization.ts'
import type {MarbleDiagramData, MarbleDiagramItem, MarbleDiagramMarble} from '../src/dto/TraceState.d.ts'

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

test('places tracks in key order, each as large as its size, with a constant gap', () => {
  // Lanes keyed by their backend y: the middle lane holds a tall marble.
  const starts = placeTracks(new Map([[300, 60], [100, 60], [200, 140]]), 0, 30)

  assert.deepEqual([...starts], [[100, 0], [200, 90], [300, 260]])
})

test('keeps the start of the first track', () => {
  const starts = placeTracks(new Map([[50, 150], [250, 40]]), -25, 30)

  assert.deepEqual([...starts], [[50, -25], [250, 155]])
})

test('places no tracks when there are none', () => {
  assert.equal(placeTracks(new Map(), 0, 30).size, 0)
})

function marble (eventKind: MarbleDiagramMarble['eventKind'], items: MarbleDiagramItem[] | null): MarbleDiagramMarble {
  return {
    kind: 'MarbleDiagramMarble',
    playbackStep: 1,
    marbleKey: '1.1',
    x: 50,
    y: 0,
    type: 'java.util.ArrayList',
    label: '[1, 2]',
    operationId: 1,
    operation: 'map',
    color: '#e41a1c',
    eventKind,
    items,
    entries: null
  }
}

const items: MarbleDiagramItem[] = [
  { kind: 'MarbleDiagramItem', marbleKey: null, type: 'int', value: '1' },
  { kind: 'MarbleDiagramItem', marbleKey: null, type: 'int', value: '2' }
]

test('draws terminal lists and arrays vertically', () => {
  assert.equal(collectionDirection(marble('END', items)), 'vertical')
})

test('draws intermediate lists and arrays horizontally', () => {
  assert.equal(collectionDirection(marble('START', items)), 'horizontal')
  assert.equal(collectionDirection(marble('OUT', items)), 'horizontal')
})

test('gives marbles without items no collection direction', () => {
  assert.equal(collectionDirection(marble('OUT', null)), null)
})
