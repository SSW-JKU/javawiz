import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findMissingFieldsByClass,
  formatMissingFields,
  getNodesOfTypes,
  getVariablePointers
} from '../src/components/DataStructureVisualizations/preprocessing-utils.ts'

/** Builds the minimal heap-object tree node needed by the preprocessing utility tests. */
function heapObjectNode (id: number, type: string, fieldNames: string[] = []) {
  return {
    children: [],
    depth: 1,
    name: type,
    element: {
      kind: 'HeapObject' as const,
      id,
      type,
      faked: false,
      fields: fieldNames.map(name => ({
        kind: 'Var' as const,
        name,
        type: 'java.lang.Object',
        value: { kind: 'NullVal' as const },
        changed: false,
        class: type
      }))
    }
  }
}

/** Builds a root variable with an optional referenced heap-object child. */
function variableNode (name: string, type: string, value: { kind: 'NullVal' } | { kind: 'ReferenceVal', reference: number }, child?: ReturnType<typeof heapObjectNode>) {
  return {
    children: child ? [child] : [],
    depth: 1,
    name,
    element: {
      kind: 'Var' as const,
      name,
      type,
      value,
      changed: false,
      class: 'Example',
      method: 'main'
    }
  }
}

test('filters multiple heap types and retains deterministic object ordering', () => {
  const nodes = [heapObjectNode(8, 'NodeB'), heapObjectNode(2, 'Other'), heapObjectNode(5, 'NodeA')]

  assert.deepEqual(
    getNodesOfTypes(nodes, new Set(['NodeA', 'NodeB'])).map(node => node.element && 'id' in node.element ? node.element.id : -1),
    [5, 8]
  )
  assert.deepEqual(getNodesOfTypes(nodes, new Set()), [])
})

test('classifies non-null pointers by runtime type and null pointers by declared type', () => {
  const selectedTarget = heapObjectNode(1, 'NodeB')
  const unselectedTarget = heapObjectNode(2, 'Other')
  const root = {
    children: [
      variableNode('selectedReference', 'BaseNode', { kind: 'ReferenceVal', reference: 1 }, selectedTarget),
      variableNode('unselectedReference', 'NodeA', { kind: 'ReferenceVal', reference: 2 }, unselectedTarget),
      variableNode('selectedNull', 'NodeA', { kind: 'NullVal' }),
      variableNode('unselectedNull', 'Other', { kind: 'NullVal' })
    ],
    depth: 0,
    name: 'root'
  }

  assert.deepEqual(
    getVariablePointers(root, new Set(['NodeA', 'NodeB'])).map(pointer => pointer.name),
    ['selectedReference', 'selectedNull']
  )
})

test('reports missing fields for every participating runtime class', () => {
  const missingFields = findMissingFieldsByClass([
    heapObjectNode(1, 'NodeA', ['next', 'val']),
    heapObjectNode(2, 'NodeB', ['next']),
    heapObjectNode(3, 'NodeC', [])
  ], ['next', 'val'])

  assert.deepEqual(missingFields, [
    { className: 'NodeB', fieldNames: ['val'] },
    { className: 'NodeC', fieldNames: ['next', 'val'] }
  ])
  assert.equal(
    formatMissingFields(missingFields),
    'Cannot visualize classes with missing fields (NodeB: val; NodeC: next, val). Check the configured field names.'
  )
  assert.equal(formatMissingFields([]), '')
})
