import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

/** Loads frontend modules through Vite so their `@/` aliases and D3 imports resolve. */
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

const node = {
  kind: 'HeapObject' as const,
  id: 2,
  type: 'Node',
  faked: false,
  fields: []
}

/** Builds a root variable as `heapBFS` does; static fields have no method and no stack frame. */
function root (name: string, value: { kind: 'ReferenceVal', reference: number } | { kind: 'NullVal' }, local?: { method: string, depth: number }) {
  const element = local
    ? { kind: 'Var', name, type: 'Node', value, class: 'StaticList', method: local.method, changed: false }
    : { kind: 'Var', name, type: 'Node', value, class: 'StaticList', changed: false }
  return { element, children: [], depth: 1, name, stackFrameDepth: local?.depth }
}

test('list pointers use the official identifiers', async () => {
  await withVite(async vite => {
    const { createPointerStructure } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheListVisualization/preprocessing.ts')
    const nodeHeapTreeNode = { element: node, children: [], depth: 2, name: 'head' }
    const listNode = { node: nodeHeapTreeNode, index: 0, lists: [], level: 0, height: 1, valFieldIndex: -1, nextFieldIndex: -1 }
    const list = {
      element: {
        kind: 'HeapObject',
        id: 1,
        type: 'MyList',
        faked: false,
        fields: [{ kind: 'Var', name: 'first', type: 'Node', value: { kind: 'ReferenceVal', reference: 2 }, class: 'MyList', changed: false, heapObjectId: 1 }]
      },
      children: [],
      depth: 2,
      name: 'list'
    }
    // Null pointers look up their previous position in the drawn SVG; record the selectors.
    const selectors: string[] = []
    const svg = { select: (selector: string) => { selectors.push(selector); return { empty: () => true } } }

    const pointers = createPointerStructure(
      svg,
      [listNode],
      [
        root('head', { kind: 'ReferenceVal', reference: 2 }),
        root('cur', { kind: 'ReferenceVal', reference: 2 }, { method: 'main(java.lang.String[])', depth: 0 }),
        root('tail', { kind: 'NullVal' })
      ],
      [list],
      { prevName: 'prev', nodeClassNames: new Set(['Node']) }
    )

    assert.deepEqual(
      pointers.map((pointer: { name: string, sourceVariableIdentifier: string }) => [pointer.name, pointer.sourceVariableIdentifier]).sort(),
      [['cur', 'roots:l_0_cur'], ['first', 'o_1:first'], ['head', 'roots:s_StaticList_head'], ['tail', 'roots:s_StaticList_tail']]
    )
    assert.deepEqual(selectors, ['[id="list-p-roots:s_StaticList_tail"]'])
  })
})

test('id attribute selector matches ids with colons', async () => {
  await withVite(async vite => {
    const { idAttributeSelector } = await vite.ssrLoadModule('/src/identifiers/trace-identifiers.ts')

    assert.equal(idAttributeSelector('list-p-roots:l_0_head'), '[id="list-p-roots:l_0_head"]')
    assert.equal(idAttributeSelector('a"b\\c'), '[id="a\\"b\\\\c"]')
  })
})
