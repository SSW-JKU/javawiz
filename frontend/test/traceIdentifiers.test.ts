import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(async () => await vite.close())

// Loaded as a namespace, so a missing function fails its own test instead of the whole file.
const ids = await vite.ssrLoadModule('/src/identifiers/trace-identifiers.ts')

/** A valid CSS identifier that `#id` can select without escaping (ASCII names only). */
const CSS_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]*$/

test('trace identifiers use the readable prefixes and no Graphviz node for roots', () => {
  assert.equal(ids.stackLocalIdentifier(0, { name: 'arr' }), 'local_0_arr')
  assert.equal(ids.staticFieldIdentifier({ class: 'Main' }, { name: 'count' }), 'static_Main_count')
  assert.equal(ids.heapItemIdentifier({ id: 1 }), 'obj_1')
  assert.equal(ids.heapObjectFieldIdentifier({ id: 1 }, { name: 'next' }), 'obj_1-next')
  assert.equal(ids.heapArrayElementIdentifier({ arrayId: 1, index: 3 }), 'obj_1-3')
  assert.equal(ids.stackFrameIdentifier?.(2), 'stackframe_2')
})

test('each kind builds its Graphviz node and port, and the identifier comes from them', () => {
  for (const name of ['stackLocalNodeAndPort', 'staticFieldNodeAndPort', 'heapObjectFieldNodeAndPort', 'heapArrayElementNodeAndPort', 'variableIdentifier']) {
    assert.equal(typeof ids[name], 'function', `${name} exists`)
  }
  const local = [0, { name: 'arr' }]
  const field = [{ class: 'Main' }, { name: 'count' }]
  const objectField = [{ id: 1 }, { name: 'next' }]
  const element = { arrayId: 1, index: 3 }
  const cases = [
    {
      nodeAndPort: ids.stackLocalNodeAndPort(...local),
      expected: { node: 'roots', port: 'local_0_arr' },
      identifier: ids.stackLocalIdentifier(...local)
    },
    {
      nodeAndPort: ids.staticFieldNodeAndPort(...field),
      expected: { node: 'roots', port: 'static_Main_count' },
      identifier: ids.staticFieldIdentifier(...field)
    },
    {
      nodeAndPort: ids.heapObjectFieldNodeAndPort(...objectField),
      expected: { node: 'obj_1', port: 'next' },
      identifier: ids.heapObjectFieldIdentifier(...objectField)
    },
    {
      nodeAndPort: ids.heapArrayElementNodeAndPort(element),
      expected: { node: 'obj_1', port: '3' },
      identifier: ids.heapArrayElementIdentifier(element)
    }
  ]
  for (const { nodeAndPort, expected, identifier } of cases) {
    assert.deepEqual(nodeAndPort, expected)
    assert.equal(ids.variableIdentifier(nodeAndPort), identifier)
  }
})

test('every identifier, cell id, edge id and method header is a CSS identifier', () => {
  const field = ids.heapObjectFieldIdentifier({ id: 7 }, { name: 'this$0' })
  const records = [
    ids.stackLocalIdentifier(1, { name: 'n' }),
    ids.staticFieldIdentifier({ class: 'a.b.Outer$Inner' }, { name: 'count' }),
    field,
    ids.heapArrayElementIdentifier({ arrayId: 7, index: 0 }),
    ids.heapItemIdentifier({ id: 7 })
  ]
  const generated = [
    ...records,
    ...Object.values(ids.SVG_CELL_SUFFIXES).map(suffix => ids.svgCellIdentifier(field, suffix)),
    ids.edgeIdentifier(field, ids.heapItemIdentifier({ id: 8 })),
    ids.methodHeaderIdentifier(0)
  ]
  for (const id of generated) {
    assert.match(id, CSS_IDENTIFIER)
  }
})

test('a field named like a cell suffix keeps its own id', () => {
  const object = ids.heapItemIdentifier({ id: 1 })
  const headerField = ids.heapObjectFieldIdentifier({ id: 1 }, { name: 'header' })
  assert.notEqual(headerField, ids.svgCellIdentifier(object, ids.SVG_CELL_SUFFIXES.header))

  const valueField = ids.heapObjectFieldIdentifier({ id: 1 }, { name: 'value' })
  assert.equal(ids.identifierFromSvgCellIdentifier(valueField), valueField, 'the field itself is not a cell id')
  assert.equal(ids.identifierFromSvgCellIdentifier(ids.svgCellIdentifier(valueField, ids.SVG_CELL_SUFFIXES.value)), valueField)
})

test('the method header id is built from the stack frame identifier', () => {
  assert.equal(ids.methodHeaderIdentifier(2), ids.svgCellIdentifier(ids.stackFrameIdentifier?.(2), ids.SVG_CELL_SUFFIXES.method))
})

test('attribute-selector helpers are gone, because plain #id selectors work', () => {
  assert.equal(ids.idAttributeSelector, undefined)
  assert.equal(ids.escapeIdForAttributeSelector, undefined)
})
