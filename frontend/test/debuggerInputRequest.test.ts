import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createTestServer } from './viteTestServer.ts'

// The debugger imports the general store, which imports the Monaco editor. Monaco only runs in a
// browser, so this test replaces it with an empty module, as the About overlay test does.
const vite = await createTestServer({
  // Let Vite resolve Monaco imports through the plugin below instead of loading the package in Node.
  ssr: { noExternal: ['monaco-editor'] },
  plugins: [{
    name: 'empty-monaco-editor',
    enforce: 'pre',
    resolveId: (id: string) => id === 'monaco-editor' || id.startsWith('monaco-editor/') ? '\0empty-monaco-editor' : undefined,
    load: (id: string) => id === '\0empty-monaco-editor' ? 'export default {}' : undefined
  }]
})
after(async () => await vite.close())

const support = await vite.ssrLoadModule('/test/debuggerInputRequest.testSupport.ts')

test('input is expected only right after the program asked for it at the live step', () => {
  support.assertInputExpectedOnlyRightAfterRequest(assert)
})
