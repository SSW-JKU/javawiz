import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer, h, nextTick, ref, watch } from 'vue'
import { CONSOLE_TEXT_WATCH_OPTIONS } from '../src/components/consoleWatcherOptions.ts'

test('console scrolling runs after Vue renders changed output', async () => {
  const consoleText = ref('old')
  const events: string[] = []
  const renderer = createRenderer({
    patchProp () {},
    insert () {},
    remove () {},
    createElement () { return {} },
    createText () { return {} },
    createComment () { return {} },
    setText () {},
    setElementText (_element, text) { events.push(`render:${text}`) },
    parentNode () { return null },
    nextSibling () { return null }
  })

  renderer.createApp({
    setup () {
      watch(consoleText, () => events.push('scroll'), CONSOLE_TEXT_WATCH_OPTIONS)
      return () => h('div', consoleText.value)
    }
  }).mount({})

  events.length = 0
  consoleText.value = 'new'
  await nextTick()

  assert.deepEqual(events, ['render:new', 'scroll'])
})
