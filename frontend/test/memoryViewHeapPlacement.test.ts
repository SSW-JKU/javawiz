import assert from 'node:assert/strict'
import test from 'node:test'
import { type Plugin } from 'vite'
import { createTestServer } from './viteTestServer.ts'

const virtualGeneralStore = '\0memory-view-general-store'
const virtualVisualizationStore = '\0memory-view-visualization-store'

/** Replaces browser-heavy stores that the chart does not use during deterministic DOT rendering. */
function memoryViewStoreMocks (): Plugin {
  return {
    name: 'memory-view-store-mocks',
    enforce: 'pre',
    resolveId (source) {
      if (source === '@/store/GeneralStore' || source.endsWith('/store/GeneralStore'))
        return virtualGeneralStore
      if (source === '@/store/VisualizationStore' || source.endsWith('/store/VisualizationStore'))
        return virtualVisualizationStore
    },
    load (id) {
      if (id === virtualGeneralStore)
        return 'export function useGeneralStore () { return { currentTraceData: undefined } }'
      if (id === virtualVisualizationStore)
        return 'export function useVisualizationStore () { return { MEMORY: { id: 3 } } }'
    }
  }
}

for (const [name, assertion] of [
  ['Heap box stays beside the Stack header when the last local references it', 'runReferenceFromLastLocalAssertions'],
  ['Heap box stays beside the Stack header with an object chain and a static reference', 'runChainAndStaticReferenceAssertions'],
  ['Heap box stays right of the table when no reference enters it', 'runUnreferencedObjectAssertions'],
  ['An object returned without a reference appears below the referenced objects', 'runReturnedObjectBelowReferencedAssertions'],
  ['Empty heap draws no Heap box', 'runEmptyHeapAssertions']
]) {
  test(name, async () => {
    const vite = await createTestServer({
      plugins: [memoryViewStoreMocks()],
    })
    try {
      const module = await vite.ssrLoadModule('/test/memoryViewHeapPlacement.testSupport.ts')
      await module[assertion](assert)
    } finally {
      await vite.close()
    }
  })
}
