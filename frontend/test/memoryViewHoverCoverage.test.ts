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

for (const showMemory of [false, true]) {
  test(`Memory View hover colors and edges can be found by SVG id${showMemory ? ' with byte sizes' : ''}`, async () => {
    const vite = await createServer({
      plugins: [memoryViewStoreMocks()],
      server: { middlewareMode: true, hmr: false },
      appType: 'custom'
    })
    try {
      const module = await vite.ssrLoadModule('/test/memoryViewHoverCoverage.testSupport.ts')
      module.runHoverCoverageAssertions(assert, showMemory)
    } finally {
      await vite.close()
    }
  })
}
