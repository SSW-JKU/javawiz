/**
 * Browser assertions for JW-255. Import through Vite, after opening a populated
 * visualization; Node has no layout engine and cannot establish icon overlap.
 */
export function inspectNavigationText (pane: Element) {
  const navigation = pane.querySelector('.absolute-flex-container')
  if (!navigation) throw new Error('The selected pane has no navigation controls')

  const paneBounds = pane.getBoundingClientRect()
  const controls = Array.from(navigation.querySelectorAll('[role="button"][aria-label]'))
    .map(element => ({ name: element.getAttribute('aria-label')!, bounds: element.getBoundingClientRect() }))
  if (!controls.length) throw new Error('The selected pane has no labeled navigation controls')

  const text: string[] = []
  const overlaps: { text: string, control: string, left: number, top: number }[] = []
  const walker = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const value = node.textContent?.trim()
    const parent = node.parentElement
    if (!value || !parent || navigation.contains(node) || parent.closest('defs, .text-tester')) continue

    let visible = true
    for (let element: Element | null = parent; element; element = element.parentElement) {
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
        visible = false
        break
      }
      if (element === pane) break
    }
    if (!visible) continue

    // Text ranges measure the actual glyph runs, including wrapped lines and
    // right-aligned SVG labels, without counting empty foreignObject padding.
    const range = document.createRange()
    range.selectNodeContents(node)
    const bounds = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0)
    if (!bounds.length) continue
    text.push(value)
    for (const rect of bounds) {
      for (const control of controls) {
        const left = Math.max(rect.left, control.bounds.left, paneBounds.left)
        const right = Math.min(rect.right, control.bounds.right, paneBounds.right)
        const top = Math.max(rect.top, control.bounds.top, paneBounds.top)
        const bottom = Math.min(rect.bottom, control.bounds.bottom, paneBounds.bottom)
        // Ignore subpixel contact at a shared edge, not a visible intersection.
        if (right - left > 0.5 && bottom - top > 0.5) {
          overlaps.push({ text: value, control: control.name, left: rect.left - paneBounds.left, top: rect.top - paneBounds.top })
        }
      }
    }
  }

  return { width: paneBounds.width, height: paneBounds.height, controls: controls.map(control => control.name), text, overlaps }
}

function containsExpectedText (text: string[], expected: RegExp) {
  // Inline spans can split one sentence into several text nodes.
  return text.some(value => expected.test(value)) || expected.test(text.join(' '))
}

export function assertNavigationTextClear (pane: Element, expectedText: RegExp) {
  const result = inspectNavigationText(pane)
  if (!containsExpectedText(result.text, expectedText)) {
    throw new Error(`Expected rendered content was not found: ${expectedText}`)
  }
  if (result.overlaps.length) {
    throw new Error(`Navigation overlaps visible text: ${JSON.stringify(result.overlaps)}`)
  }
  return result
}

/** The tall table header is visible content even when its text sits below the icons. */
export function assertTabularClearance (pane: Element) {
  const table = pane.querySelector('#fixed-column-table')
  if (!table) throw new Error('The populated Tabular table was not found')
  const bounds = table.getBoundingClientRect()
  const controls = pane.querySelectorAll('.absolute-flex-container [role="button"][aria-label]')
  if (!controls.length) throw new Error('The Tabular navigation controls were not found')
  for (const control of controls) {
    const icon = control.getBoundingClientRect()
    if (bounds.left < icon.right && bounds.right > icon.left && bounds.top < icon.bottom && bounds.bottom > icon.top) {
      throw new Error(`The Tabular table overlaps ${control.getAttribute('aria-label')}`)
    }
  }
}

/** Wait for real content and D3 transitions, rather than assuming a fixed delay. */
export async function waitForNavigationContent (pane: Element, expectedText: RegExp) {
  await document.fonts.ready
  const deadline = performance.now() + 10000
  let previous = ''
  let stableFrames = 0
  while (performance.now() < deadline) {
    if (!pane.isConnected) throw new Error('The pane was removed while waiting for content')
    const result = inspectNavigationText(pane)
    const signature = JSON.stringify(result)
    const transitioning = [pane, ...pane.querySelectorAll('*')]
      .some(element => '__transition' in element)
    stableFrames = !transitioning && signature === previous ? stableFrames + 1 : 0
    if (stableFrames >= 3 && result.width > 0 && result.height > 0 && containsExpectedText(result.text, expectedText)) return
    previous = signature
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
  throw new Error(`Visualization did not settle with expected content: ${expectedText}`)
}
