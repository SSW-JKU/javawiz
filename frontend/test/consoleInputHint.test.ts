import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createTestServer } from './viteTestServer.ts'

// The console reads the general store, which imports the Monaco editor through the debugger. Monaco
// only runs in a browser, so this test replaces it with an empty module, as the About overlay test does.
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

const { default: TheConsole } = await vite.ssrLoadModule('/src/components/TheConsole.vue')
const { useGeneralStore } = await vite.ssrLoadModule('/src/store/GeneralStore.ts')
const { waitForInputAtLiveStep } = await vite.ssrLoadModule('/test/debuggerInputRequest.testSupport.ts')

/** Renders the console; when asked, the program first waits for input at the live step. */
async function renderConsole (programWaitsForInput: boolean): Promise<string> {
  const pinia = createPinia()
  // The debugger in the general store looks up the store itself, so Pinia must be active first.
  setActivePinia(pinia)
  if (programWaitsForInput) {
    waitForInputAtLiveStep(useGeneralStore(pinia).debugger)
  }
  const app = createSSRApp({ render: () => h(TheConsole) })
  app.use(pinia)
  return await renderToString(app)
}

test('the input field shows a hint while the program waits for input', async () => {
  const html = await renderConsole(true)
  assert.match(html, /<input id="console-input-field"[^>]*placeholder="Type your input and press Enter"/)
})

test('the output ends with the hint while the program waits for input', async () => {
  const html = await renderConsole(true)
  assert.match(html, /Enter a number: (?:<!--[^>]*-->)*<span class="console-input-hint"[^>]*>Type your input and press Enter<\/span>/)
})

test('neither the input field nor the output shows a hint when no input is expected', async () => {
  const html = await renderConsole(false)
  assert.match(html, /<input id="console-input-field"/)
  assert.doesNotMatch(html, /Type your input/)
})
