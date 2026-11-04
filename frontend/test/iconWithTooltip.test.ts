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

for (const content of ['image', 'slot']) {
  test(`background color sits behind ${content} content, separate from filters and tooltip`, async () => {
    const app = createSSRApp({
      render: () => h(IconWithTooltip, {
        backgroundColor: 'rgba(211, 211, 211, 0.5)',
        hoverBackground: 'rgba(180, 180, 180, 0.5)',
        icon: content === 'image' ? '/help.svg' : undefined,
        semitransparent: true,
        tooltip: { text: 'Help' }
      }, content === 'slot' ? { icon: () => h('span', '⚙') } : undefined)
    })

    const html = await renderToString(app)
    assert.match(html, /<a[^>]*style="--icon-background:rgba\(211, 211, 211, 0\.5\);--icon-hover-background:rgba\(180, 180, 180, 0\.5\);"/)
    assert.doesNotMatch(html, /<(?:img|span|div)[^>]*style="[^"]*background-color:/)
    assert.match(html, /class="tt tt-below-middlearrow"/)
    if (content === 'image') {
      assert.match(html, /<img[^>]*style="filter:opacity\(\.5\);"/)
    } else {
      assert.match(html, /<span>⚙<\/span>/)
    }
  })
}

test('omitting the background color leaves the icon background unset', async () => {
  const app = createSSRApp({
    render: () => h(IconWithTooltip, { icon: '/help.svg', enabled: false })
  })

  const html = await renderToString(app)
  assert.doesNotMatch(html, /--icon-(?:hover-)?background:/)
  assert.match(html, /aria-disabled="true"/)
  assert.match(html, /filter:invert\(\.5\)/)
})

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
