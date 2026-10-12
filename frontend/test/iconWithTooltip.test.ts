import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

const vite = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true }
})
after(async () => await vite.close())

const { default: IconWithTooltip } = await vite.ssrLoadModule('/src/components/TheToolbar/IconWithTooltip.vue')

test('menu state belongs to the interactive tooltip control', async () => {
  const app = createSSRApp({
    render: () => h(IconWithTooltip, {
      tooltip: { text: 'Export visualization' },
      ariaHaspopup: 'menu',
      ariaExpanded: true
    }, {
      icon: () => h('span', '💾')
    })
  })

  const html = await renderToString(app)
  assert.match(html, /<a[^>]*aria-haspopup="menu"[^>]*aria-expanded="true"/)
  assert.doesNotMatch(html, /<div[^>]*aria-haspopup=/)
})
