import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

/**
 * Runs `measure` with a stub `document`. The Arrays view measures cell text with hidden
 * DOM elements; Node has no DOM, so a stub without those elements makes the measurement
 * fall back to the minimum width. The stub is removed afterwards because modules that
 * are loaded later expect either a real DOM or none.
 */
function withoutTextMeasurement<T> (measure: () => T): T {
  ;(globalThis as any).document = { getElementById: () => null }
  try {
    return measure()
  } finally {
    delete (globalThis as any).document
  }
}

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

/** Builds an `int[]` heap array with one element per value. */
function intArray (id: number, values: number[]) {
  return {
    kind: 'HeapArray' as const,
    id,
    type: 'int[]',
    faked: false,
    elements: values.map((value, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: id,
      type: 'int',
      value: { kind: 'PrimitiveVal' as const, primitiveValue: String(value), vizValue: String(value), title: undefined },
      index,
      changed: false
    }))
  }
}

/** Builds the heap-tree node of an `int[]` together with its element nodes. */
function intArrayNode (id: number, values: number[], name: string) {
  const array = intArray(id, values)
  return {
    element: array,
    children: array.elements.map(element => ({ element, children: [], depth: 3, name: String(element.index) })),
    depth: 2,
    name
  }
}

test('array view draws static and local arrays', async () => {
  await withVite(async vite => {
    const { createArrayAndPointerStructure } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/TheArrayVisualization/preprocessing.ts')
    const staticRoot = {
      // A static field has a class but no method, and no stack frame.
      element: { kind: 'Var', name: 'data', type: 'int[]', value: { kind: 'ReferenceVal', reference: 1 }, class: 'StaticArray', changed: false },
      children: [intArrayNode(1, [3, 1, 2], 'data')],
      depth: 1,
      name: 'data',
      className: 'StaticArray'
    }
    const localRoot = {
      element: { kind: 'Var', name: 'arr', type: 'int[]', value: { kind: 'ReferenceVal', reference: 2 }, class: 'StaticArray', method: 'main(java.lang.String[])', changed: false },
      children: [intArrayNode(2, [0, 0, 0, 0, 0], 'arr')],
      depth: 1,
      name: 'arr',
      stackFrameDepth: 0
    }
    const root = { children: [staticRoot, localRoot], depth: 0, name: 'root' }

    const { arrays, arrayPointers } = withoutTextMeasurement(() => createArrayAndPointerStructure(root, { showArgs: true, minCellWidth: 10 }))

    assert.equal(arrays.length, 2)
    assert.deepEqual(
      // The same identifiers as in the memory view: static fields by class, locals by stack frame.
      arrayPointers.map((pointer: { name: string, sourceVariableIdentifier: string }) => [pointer.name, pointer.sourceVariableIdentifier]),
      [['data', 'roots:s_StaticArray_data'], ['arr', 'roots:l_0_arr']]
    )
  })
})

test('heap tree omits statics of traversal-stop classes', async () => {
  await withVite(async vite => {
    const { heapBFS } = await vite.ssrLoadModule('/src/components/DataStructureVisualizations/heapBFS.ts')
    const staticVar = (name: string, type: string, reference: number, className: string) =>
      ({ kind: 'Var', name, type, value: { kind: 'ReferenceVal', reference }, class: className, changed: false })
    const loadedClasses = [
      {
        kind: 'LoadedClass',
        class: 'java.util.HexFormat',
        staticFields: [staticVar('DIGITS', 'byte[]', 10, 'java.util.HexFormat')],
        isHeapTraversalStop: true,
        isJavaDataStructure: true,
        hasCollectedFields: true
      },
      {
        kind: 'LoadedClass',
        class: 'StaticArray',
        staticFields: [staticVar('data', 'int[]', 11, 'StaticArray')],
        isHeapTraversalStop: false,
        isJavaDataStructure: false,
        hasCollectedFields: true
      }
    ]
    const heap = [{ ...intArray(10, [48, 49]), type: 'byte[]' }, intArray(11, [3, 1, 2])]

    const { root } = heapBFS(loadedClasses, [], heap)

    assert.deepEqual(root.children.map((child: { name: string }) => child.name), ['data'])
  })
})
