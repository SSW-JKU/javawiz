import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHeapAliasIndex } from '../src/components/TheHistoryView/HeapAliasIndex.ts'

type StackFrames = Parameters<typeof buildHeapAliasIndex>[0]
type Heap = Parameters<typeof buildHeapAliasIndex>[1]

const reference = (heapObjectId: number) => ({
  kind: 'ReferenceVal' as const,
  reference: heapObjectId
})

const primitive = (value: string) => ({
  kind: 'PrimitiveVal' as const,
  vizValue: value,
  title: value
})

const local = (name: string, heapObjectId: number) => ({
  kind: 'LocalVar' as const,
  name,
  type: 'Object',
  value: reference(heapObjectId),
  changed: false
})

const field = (name: string, heapObjectId: number) => ({
  kind: 'FieldVar' as const,
  name,
  type: 'Object',
  value: reference(heapObjectId),
  changed: false,
  heapObjectId: 0
})

const object = (id: number, fields: ReturnType<typeof field>[] = []) => ({
  kind: 'HeapObject' as const,
  id,
  type: `example.Type${id}`,
  faked: false,
  fields
})

const array = (id: number, referencedHeapObjectIds: number[]) => ({
  kind: 'HeapArray' as const,
  id,
  type: 'Object[]',
  faked: false,
  elements: referencedHeapObjectIds.map((heapObjectId, index) => ({
    kind: 'HeapArrayElementVar' as const,
    arrayId: id,
    index,
    type: 'Object',
    value: reference(heapObjectId),
    changed: false
  }))
})

function frame (
  locals: ReturnType<typeof local>[],
  thisHeapObjectId?: number
) {
  return {
    kind: 'StackFrame' as const,
    line: 1,
    class: 'example.Test',
    method: 'run',
    signature: '()V',
    displaySignature: 'run()',
    localVariables: locals,
    conditionValues: [],
    arrayAccessValues: [],
    this: thisHeapObjectId === undefined ? undefined : reference(thisHeapObjectId),
    internal: false,
    displayText: 'run()'
  }
}

function legacyAliases (
  heapObjectId: number,
  stackFrames: StackFrames,
  heap: Heap,
  visited = new Set<number>(),
  depth = 0
): string[] {
  if (depth > 10 || visited.has(heapObjectId)) return []
  visited.add(heapObjectId)

  const aliases = stackFrames.flatMap(stackFrame => stackFrame.localVariables
    .filter(variable => variable.name !== 'this'
      && variable.value.kind === 'ReferenceVal'
      && variable.value.reference === heapObjectId)
    .map(variable => variable.name))

  for (const item of heap) {
    const references = item.kind === 'HeapObject'
      ? item.fields.map(itemField => ({ suffix: `.${itemField.name}`, value: itemField.value }))
      : item.kind === 'HeapArray'
        ? item.elements.map(element => ({ suffix: `[${element.index}]`, value: element.value }))
        : []

    for (const referenceInfo of references) {
      if (referenceInfo.value.kind !== 'ReferenceVal' || referenceInfo.value.reference !== heapObjectId) continue

      const parentAliases = legacyAliases(item.id, stackFrames, heap, new Set(visited), depth + 1)
      aliases.push(...parentAliases.map(parentAlias => `${parentAlias}${referenceInfo.suffix}`))
    }
  }

  const thisReference = stackFrames[0]?.this
  if (thisReference?.kind === 'ReferenceVal' && thisReference.reference === heapObjectId) {
    aliases.push('this')
  }

  return aliases
}

test('indexes direct, nested object, and array aliases', () => {
  const index = buildHeapAliasIndex(
    [frame([local('root', 1)])],
    [
      object(1, [field('child', 2), field('items', 3)]),
      object(2),
      array(3, [4]),
      object(4)
    ]
  )

  assert.deepEqual(index.get(1), ['root'])
  assert.deepEqual(index.get(2), ['root.child'])
  assert.deepEqual(index.get(3), ['root.items'])
  assert.deepEqual(index.get(4), ['root.items[0]'])
})

test('preserves all aliases for shared references', () => {
  const index = buildHeapAliasIndex(
    [frame([local('first', 1), local('second', 1)])],
    [object(1)]
  )

  assert.deepEqual(index.get(1), ['first', 'second'])
})

test('adds this only for the current receiver', () => {
  const index = buildHeapAliasIndex(
    [frame([local('other', 2)], 1)],
    [object(1), object(2)]
  )

  assert.deepEqual(index.get(1), ['this'])
  assert.deepEqual(index.get(2), ['other'])
})

test('indexes fully qualified and simple static-field aliases', () => {
  const index = buildHeapAliasIndex([], [object(1)], {
    loadedClasses: [{
      kind: 'LoadedClass',
      class: 'example.Holder',
      staticFields: [{
        kind: 'Var',
        name: 'item',
        type: 'Object',
        value: reference(1),
        changed: false,
        class: 'example.Holder'
      }]
    }]
  })

  assert.deepEqual(index.get(1), ['example.Holder.item', 'Holder.item'])
})

test('stops cycles without generating repeated paths', () => {
  const first = object(1, [field('next', 2)])
  const second = object(2, [field('previous', 1)])
  const index = buildHeapAliasIndex([frame([local('root', 1)])], [first, second])

  assert.deepEqual(index.get(1), ['root'])
  assert.deepEqual(index.get(2), ['root.next'])
})

test('does not index unreachable heap objects', () => {
  const index = buildHeapAliasIndex(
    [frame([local('reachable', 1)])],
    [object(1), object(2)]
  )

  assert.deepEqual(index.get(1), ['reachable'])
  assert.equal(index.has(2), false)
})

test('honors the maximum reference depth', () => {
  const index = buildHeapAliasIndex(
    [frame([local('root', 1)])],
    [
      object(1, [field('child', 2)]),
      object(2, [field('grandchild', 3)]),
      object(3)
    ],
    1
  )

  assert.deepEqual(index.get(2), ['root.child'])
  assert.equal(index.has(3), false)
})

test('ignores primitive fields', () => {
  const root = object(1)
  root.fields.push({
    ...field('count', 0),
    type: 'int',
    value: primitive('1')
  })

  const index = buildHeapAliasIndex([frame([local('root', 1)])], [root])
  assert.deepEqual(index.get(1), ['root'])
})

test('matches the previous alias semantics for a representative heap graph', () => {
  const stackFrames = [frame([local('root', 1), local('shared', 4)], 1)]
  const heap = [
    object(1, [field('child', 2), field('items', 3)]),
    object(2, [field('shared', 4)]),
    array(3, [4, 5]),
    object(4),
    object(5)
  ]
  const index = buildHeapAliasIndex(stackFrames, heap)

  for (const item of heap) {
    assert.deepEqual(
      [...(index.get(item.id) ?? [])].sort(),
      legacyAliases(item.id, stackFrames, heap).sort(),
      `aliases for heap item ${item.id}`
    )
  }
})
