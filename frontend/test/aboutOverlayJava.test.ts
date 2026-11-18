import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createPinia } from 'pinia'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

// The About overlay reads the general store, which imports the Monaco editor through the debugger. Monaco only
// runs in a browser, so this test replaces it with an empty module; the overlay does not use it.
const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
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

const { default: TheAboutOverlay } = await vite.ssrLoadModule('/src/components/Overlays/TheAboutOverlay.vue')
const { useGeneralStore } = await vite.ssrLoadModule('/src/store/GeneralStore.ts')

/** Renders the About overlay with the given Java executable in the general store. */
async function renderAboutOverlay (javaExecutable: string | undefined): Promise<string> {
  const pinia = createPinia()
  const app = createSSRApp({ render: () => h(TheAboutOverlay) })
  app.use(pinia)
  useGeneralStore(pinia).javaExecutable = javaExecutable
  return await renderToString(app)
}

test('adds the Java executable reported by the backend to the version', async () => {
  const html = await renderAboutOverlay('/opt/jdk-25/bin/java')
  assert.match(html, /released on [^<]*(?:<!--\[-->)?\s*currently running on <code class="java-executable"[^>]*>\/opt\/jdk-25\/bin\/java<\/code>/)
})

test('shows only the version before the backend reported an executable', async () => {
  const html = await renderAboutOverlay(undefined)
  assert.match(html, /released on /)
  assert.doesNotMatch(html, /currently running on/)
  assert.doesNotMatch(html, /java-executable/)
})
