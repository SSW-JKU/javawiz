import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

/** Loads frontend modules through Vite so their `@/` aliases resolve. */
async function withVite<T> (run: (vite: ViteDevServer) => Promise<T>): Promise<T> {
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true }
  })
  try {
    return await run(vite)
  } finally {
    await vite.close()
  }
}

const reference = (id: number) => ({ kind: 'ReferenceVal' as const, reference: id })
const nullValue = { kind: 'NullVal' as const }
const int = (value: number) => ({ kind: 'PrimitiveVal' as const, primitiveValue: String(value), vizValue: String(value) })

function field (name: string, type: string, value: object) {
  return { kind: 'Var' as const, name, type, value, changed: false }
}

function element (arrayId: number, index: number, type: string, value: object) {
  return { kind: 'HeapArrayElementVar' as const, arrayId, index, type, value, changed: false }
}

function object (id: number, type: string, fields: object[]) {
  return { kind: 'HeapObject' as const, id, type, faked: false, fields }
}

function array (id: number, type: string, elements: object[]) {
  return { kind: 'HeapArray' as const, id, type, faked: false, elements }
}

/**
 * Builds the data-structure graph of `heap` with the real `buildDataStructureGraph`, for a single local variable in
 * `main` that references heap item `id`. Returns the node of that heap item and the module under test.
 */
async function graph (heap: object[], type: string, id: number) {
  return await withVite(async vite => {
    const { buildDataStructureGraph } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/dataStructureGraph.ts')
    const module = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/data-structure-graph-node-utils.ts')
    const frame = { method: 'main', line: 1, localVariables: [{ ...field('v', type, reference(id)), class: 'Main', method: 'main' }] }
    const { rootDataStructureGraphNode } = buildDataStructureGraph([], [frame], heap)
    return {
      node: rootDataStructureGraphNode.childDataStructureGraphNodes[0].childDataStructureGraphNodes[0],
      getNodeString: module.getNodeString,
      DEFAULT_MAX_DEPTH: module.DEFAULT_MAX_DEPTH
    }
  })
}

/** Binds the rows of a value box, list node or tree node the way the views do: `{ ...child, parent }`. */
function rows (box: any) {
  return box.childDataStructureGraphNodes.map((child: any) => ({ ...child, parent: box }))
}

// class Item { int x; Point p; Item self; }  class Point { int x; int y; Color color; }  class Color { int r; int g; int b; }
// item.x = 4; item.p = (3, 4) with color (0, 0, 255); item.self = item;
const itemHeap = [
  object(1, 'Item', [field('x', 'int', int(4)), field('p', 'Point', reference(2)), field('self', 'Item', reference(1))]),
  object(2, 'Point', [field('x', 'int', int(3)), field('y', 'int', int(4)), field('color', 'Color', reference(3))]),
  object(3, 'Color', [field('r', 'int', int(0)), field('g', 'int', int(0)), field('b', 'int', int(255))])
]

test('a whole object names its fields and cuts objects below the second level', async () => {
  const { node, getNodeString } = await graph(itemHeap, 'Item', 1)
  assert.equal(getNodeString(node), '{ x: 4, p: { x: 3, y: 4, color: { ... } }, self: { ... } }')
})

test('the rows of a value box count the box as the first level', async () => {
  const { node, getNodeString } = await graph(itemHeap, 'Item', 1)
  assert.deepEqual(rows(node).map((row: any) => getNodeString(row)), ['4', '{ x: 3, y: 4, color: { ... } }', '{ ... }'])
})

test('the maximum depth moves the cut', async () => {
  const { node, getNodeString } = await graph(itemHeap, 'Item', 1)
  const pointRow = rows(node)[1]
  assert.equal(getNodeString(pointRow, 3), '{ x: 3, y: 4, color: { r: 0, g: 0, b: 255 } }')
  assert.equal(getNodeString(pointRow, 1), '{ ... }')
})

test('an object that refers to itself ends with a placeholder, also for a copy of its node', async () => {
  // Item a = new Item(1); a.self = a;
  const { node, getNodeString } = await graph([object(1, 'Item', [field('x', 'int', int(1)), field('self', 'Item', reference(1))])], 'Item', 1)
  assert.equal(getNodeString(node), '{ x: 1, self: { ... } }')
  assert.equal(getNodeString({ ...node }), '{ x: 1, self: { ... } }')
})

test('an array that contains itself ends with a placeholder, also for a copy of its node', async () => {
  // Object[] arr = new Object[2]; arr[0] = arr;
  const arr = array(1, 'java.lang.Object[]', [element(1, 0, 'java.lang.Object', reference(1)), element(1, 1, 'java.lang.Object', nullValue)])
  const { node, getNodeString } = await graph([arr], 'java.lang.Object[]', 1)
  assert.equal(getNodeString(node), '[ [ ... ], null ]')
  assert.equal(getNodeString({ ...node }), '[ [ ... ], null ]')
})

test('a cycle through an array ends at the object that starts it', async () => {
  // Item a = new Item(); a.items = new Item[1]; a.items[0] = a;
  const { node, getNodeString } = await graph([
    object(1, 'Item', [field('items', 'Item[]', reference(2))]),
    array(2, 'Item[]', [element(2, 0, 'Item', reference(1))])
  ], 'Item', 1)
  assert.equal(getNodeString(node), '{ items: [ { ... } ] }')
})

test('a shared array is written out only once', async () => {
  // int[] row = {1, 2}; int[][] m = {row, row};
  const { node, getNodeString } = await graph([
    array(1, 'int[][]', [element(1, 0, 'int[]', reference(2)), element(1, 1, 'int[]', reference(2))]),
    array(2, 'int[]', [element(2, 0, 'int', int(1)), element(2, 1, 'int', int(2))])
  ], 'int[][]', 1)
  assert.equal(getNodeString(node), '[ [ 1, 2 ], [ ... ] ]')
})

test('a shared object is written out only once', async () => {
  // Point p = new Point(1, 2); Line l = new Line(p, p);
  const { node, getNodeString } = await graph([
    object(1, 'Line', [field('start', 'Point', reference(2)), field('end', 'Point', reference(2))]),
    object(2, 'Point', [field('x', 'int', int(1)), field('y', 'int', int(2))])
  ], 'Line', 1)
  assert.equal(getNodeString(node), '{ start: { x: 1, y: 2 }, end: { ... } }')
})

test('null and String fields are written as values after the field name', async () => {
  const { node, getNodeString } = await graph([
    object(1, 'Person', [field('name', 'java.lang.String', reference(2)), field('partner', 'Person', nullValue)]),
    { kind: 'HeapString', id: 2, type: 'java.lang.String', faked: false, string: 'Bob', vizString: 'Bob', charArr: field('value', 'char[]', nullValue) }
  ], 'Person', 1)
  assert.equal(getNodeString(node), '{ name: "Bob", partner: null }')
})

test('special names apply to the cell of a node element, not to nested data', async () => {
  // Node n = new Node(1); n.next = new Node(2);  The cell for n.next shows just "next".
  const { node, getNodeString, DEFAULT_MAX_DEPTH } = await graph([
    object(1, 'Node', [field('value', 'int', int(1)), field('next', 'Node', reference(2))]),
    object(2, 'Node', [field('value', 'int', int(2)), field('next', 'Node', nullValue)])
  ], 'Node', 1)
  assert.equal(getNodeString(rows(node)[1], DEFAULT_MAX_DEPTH, 'value', 'next'), 'next')
  assert.equal(getNodeString(node, DEFAULT_MAX_DEPTH, 'value', 'next'), '{ value: 1, next: { value: 2, next: null } }')
})
