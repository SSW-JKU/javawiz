import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type Plugin } from 'vite'

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
  ['detailed String fields keep their backing arrays reachable', 'runMemoryViewReachabilityAssertions'],
  ['entry parameter defaults preserve identity and user choices', 'runEntryParameterStateAssertions'],
  ['entry parameter collapse controls heap reachability and DOT edges', 'runEntryParameterReachabilityAssertions']
]) {
  test(name, async () => {
    const vite = await createServer({
      plugins: [memoryViewStoreMocks()],
      server: { middlewareMode: true, hmr: false },
      appType: 'custom'
    })
    try {
      const module = await vite.ssrLoadModule('/test/memoryViewReachability.testSupport.ts')
      await module[assertion](assert)
    } finally {
      await vite.close()
    }
  })
}
