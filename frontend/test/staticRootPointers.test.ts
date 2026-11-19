import assert from 'node:assert/strict'
import test from 'node:test'
import { type ViteDevServer } from 'vite'
import { createTestServer } from './viteTestServer.ts'

/** Loads frontend modules through Vite so their `@/` aliases and D3 imports resolve. */
async function withVite<T> (run: (vite: ViteDevServer) => Promise<T>): Promise<T> {
  const vite = await createTestServer()
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

/** Builds a root variable as `buildDataStructureGraph` does; static fields have no method and no stack frame. */
function root (name: string, value: { kind: 'ReferenceVal', reference: number } | { kind: 'NullVal' }, local?: { method: string, depth: number }) {
  const element = local
    ? { kind: 'Var', name, type: 'Node', value, class: 'StaticList', method: local.method, changed: false }
    : { kind: 'Var', name, type: 'Node', value, class: 'StaticList', changed: false }
  return { traceElement: element, childDataStructureGraphNodes: [], bfsDepth: 1, label: name, stackFrameNumber: local?.depth }
}

test('list pointers use the official identifiers', async () => {
  await withVite(async vite => {
    const { createVariablePointers } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheListVisualization/preprocessing.ts')
    const nodeDataStructureGraphNode = { traceElement: node, childDataStructureGraphNodes: [], bfsDepth: 2, label: 'head' }
    const listNodeBox = {
      dataStructureGraphNode: nodeDataStructureGraphNode,
      column: 0,
      containingListDataStructureGraphNodes: [],
      row: 0,
      height: 1,
      valueFieldPosition: -1,
      nextFieldPosition: -1
    }
    const list = {
      traceElement: {
        kind: 'HeapObject',
        id: 1,
        type: 'MyList',
        faked: false,
        fields: [{ kind: 'Var', name: 'first', type: 'Node', value: { kind: 'ReferenceVal', reference: 2 }, class: 'MyList', changed: false, heapObjectId: 1 }]
      },
      childDataStructureGraphNodes: [],
      bfsDepth: 2,
      label: 'list'
    }
    // Null pointers look up their previous position in the drawn SVG; record the selectors.
    const selectors: string[] = []
    const svg = { select: (selector: string) => { selectors.push(selector); return { empty: () => true } } }

    const variableToListNodePointers = createVariablePointers(
      svg,
      [listNodeBox],
      [
        root('head', { kind: 'ReferenceVal', reference: 2 }),
        root('cur', { kind: 'ReferenceVal', reference: 2 }, { method: 'main(java.lang.String[])', depth: 0 }),
        root('tail', { kind: 'NullVal' })
      ],
      [list],
      { prevName: 'prev', nodeClassNames: new Set(['Node']) }
    )

    assert.deepEqual(
      variableToListNodePointers.map((pointer: { name: string, sourceVariableIdentifier: string }) => [pointer.name, pointer.sourceVariableIdentifier]).sort(),
      [['cur', 'local_0_cur'], ['first', 'obj_1-first'], ['head', 'static_StaticList_head'], ['tail', 'static_StaticList_tail']]
    )
    assert.deepEqual(selectors, ['#list-p-static_StaticList_tail'])
  })
})
