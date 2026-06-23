/**
 * HeapLookup.ts
 *
 * Two responsibilities:
 *  1. `processInjectedTitles` – post-processes the SVG emitted by d3-graphviz.
 *     DOT HTML-like labels cannot set arbitrary SVG attributes on inner cells, so
 *     we encode them as a title attribute string of the form  id="foo" class="bar".
 *     For node-level titles Graphviz writes a `<title>` child element; for cell-level
 *     titles it forwards the value as a `xlink:title` attribute on the `<a>` wrapper.
 *     This function handles both cases, applies the attributes, and removes the title.
 *
 *  2. Bounding-box lookup – given an element ID (set by step 1), return its
 *     corners and centre in *viewport* coordinates (getBoundingClientRect).
 */

import type { HeapVizHeapArrayElementVar, HeapVizHeapItem, HeapVizVar } from './types'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface BoundingBoxCorners {
  readonly topLeft: Point
  readonly topRight: Point
  readonly bottomLeft: Point
  readonly bottomRight: Point
  readonly center: Point
}

export type HeapLookupRecord = HeapVizVar | HeapVizHeapArrayElementVar | HeapVizHeapItem
export type HeapLookupTarget = string | HeapLookupRecord

/** Matches one  key="value"  token inside a title string. */
const ATTR_TOKEN = /(\w[\w-]*)="([^"]*)"/g
const HTML_ENTITY_TEXTAREA = typeof document === 'undefined' ? null : document.createElement('textarea')

/**
 * Returns true when the entire (trimmed) title content consists of one or more
 * `key="value"` attribute tokens – i.e. it was written by our injection mechanism,
 * not by a real tooltip (float values, method names, etc.).
 */
function isInjectedTitle (content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length === 0) return false
  // Re-run to check full coverage
  ATTR_TOKEN.lastIndex = 0
  let last = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_TOKEN.exec(trimmed)) !== null) {
    // Allow only whitespace between tokens
    if (match.index !== last && trimmed.slice(last, match.index).trim() !== '') return false
    last = match.index + match[0].length
  }
  return last === trimmed.length && last > 0
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'

export function heapLookupIdentifier (target: HeapLookupTarget): string {
  return typeof target === 'string' ? target : target.identifier
}

function decodeHtmlEntities (value: string): string {
  if (!HTML_ENTITY_TEXTAREA) return value
  HTML_ENTITY_TEXTAREA.innerHTML = value
  return HTML_ENTITY_TEXTAREA.value
}

function escapeIdForAttributeSelector (id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function boundingBoxCornersForRect (rect: DOMRect): BoundingBoxCorners {
  return {
    topLeft:     { x: rect.left,                   y: rect.top                    },
    topRight:    { x: rect.right,                  y: rect.top                    },
    bottomLeft:  { x: rect.left,                   y: rect.bottom                 },
    bottomRight: { x: rect.right,                  y: rect.bottom                 },
    center:      { x: rect.left + rect.width / 2,  y: rect.top + rect.height / 2  },
  }
}

function unionBoundingRect (elements: Element[]): DOMRect | null {
  const rects = elements
    .map(el => el.getBoundingClientRect())
    .filter(rect => rect.width !== 0 || rect.height !== 0)

  if (rects.length === 0) return null

  const left = Math.min(...rects.map(rect => rect.left))
  const top = Math.min(...rects.map(rect => rect.top))
  const right = Math.max(...rects.map(rect => rect.right))
  const bottom = Math.max(...rects.map(rect => rect.bottom))

  return new DOMRect(left, top, right - left, bottom - top)
}

/**
 * Post-processes the SVG inside `root` after d3-graphviz finishes rendering.
 *
 * Graphviz produces two distinct representations for our injected titles:
 *
 *  - **Node/graph-level** `<title>` children – for top-level `<g>` nodes.
 *    We write `title="id=&quot;foo&quot;"` on the DOT node; Graphviz emits a
 *    `<title>id="foo"</title>` child.  We read `textContent`, apply the
 *    attributes to `parentElement`, and remove the `<title>`.
 *
 *  - **Cell-level** `xlink:title` attributes – for HTML-like `<td>` cells.
 *    Graphviz wraps every cell in an `<a>` element and forwards the `title=`
 *    value as `xlink:title="id=&quot;foo&quot; class=&quot;bar&quot;"` on that `<a>`.
 *    We parse **all** encoded attributes and hoist every one of them directly
 *    onto the parent `<g>`, then **unwrap** the `<a>` by moving its children
 *    up in its place.  The final SVG contains no `<a>` elements from our
 *    injected cells and every injected attribute (not just `id`) is present on
 *    the enclosing group.
 *
 * After both passes, all remaining Graphviz auto-generated `<title>` elements
 * (node/edge/cluster identifiers) are removed to prevent browser hover tooltips.
 *
 * Call this *first* inside the `renderDot()` completion callback, before
 * installing any click/hover listeners, so that IDs are present when needed.
 */
export function processInjectedTitles (root: Element): void {
  console.group('[HeapLookup] processInjectedTitles')

  // Case 1: <title> child elements (node/graph-level).
  // We write title="id=&quot;foo&quot;" on the DOT node; Graphviz emits a
  // <title>id="foo"</title> child.  Apply all encoded attributes to the parent
  // element and remove the <title>.
  let case1Count = 0
  root.querySelectorAll('title').forEach((titleEl) => {
    const content = titleEl.textContent ?? ''
    if (!isInjectedTitle(content)) return

    const parent = titleEl.parentElement
    if (!parent) return

    const attrs: Record<string, string> = {}
    ATTR_TOKEN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = ATTR_TOKEN.exec(content)) !== null) {
      attrs[match[1]] = decodeHtmlEntities(match[2])
      parent.setAttribute(match[1], attrs[match[1]])
    }
    titleEl.remove()
    console.log(`  [Case 1] <title> → applied to <${parent.tagName}${parent.id ? ` id="${parent.id}"` : ''}>:`, attrs)
    case1Count++
  })
  console.log(`  [Case 1] ${case1Count} injected <title> element(s) processed`)

  // Case 2: xlink:title attributes on <a> elements (cell-level).
  // Graphviz wraps every cell in an <a> and sets xlink:title="id=&quot;foo&quot;".
  // We parse all encoded attributes, hoist ALL of them to the parent <g>, then
  // unwrap the <a> by moving its children up in its place.
  let case2Count = 0
  root.querySelectorAll('a').forEach((aEl) => {
    const content = aEl.getAttributeNS(XLINK_NS, 'title') ?? ''
    if (!isInjectedTitle(content)) return

    const attrs: Record<string, string> = {}
    ATTR_TOKEN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = ATTR_TOKEN.exec(content)) !== null) {
      attrs[match[1]] = decodeHtmlEntities(match[2])
    }
    aEl.removeAttributeNS(XLINK_NS, 'title')

    // Hoist ALL injected attributes to the parent <g>, then unwrap <a>
    const parent = aEl.parentElement
    if (parent) {
      for (const [name, value] of Object.entries(attrs)) {
        parent.setAttribute(name, value)
      }
      while (aEl.firstChild) {
        parent.insertBefore(aEl.firstChild, aEl)
      }
      aEl.remove()
      console.log(
        '  [Case 2] <a> unwrapped into parent',
        parent,
        ' — hoisted attrs:',
        attrs
      )
      case2Count++
    }
  })
  console.log(`  [Case 2] ${case2Count} <a> element(s) unwrapped`)

  // Final pass: remove all remaining Graphviz auto-generated <title> elements
  // (node, edge, cluster names) so browsers don't show unwanted hover tooltips.
  let strippedCount = 0
  root.querySelectorAll('title').forEach((titleEl) => {
    console.log('  [Strip]  removing auto-generated <title>',
      titleEl.textContent,
      'within element',
      titleEl.parentElement
    )
    titleEl.remove()
    strippedCount++
  })
  console.log(`  [Strip]  ${strippedCount} auto-generated <title> element(s) removed`)

  console.groupEnd()
}

/**
 * Finds the first element inside `root` (defaults to the entire document) whose
 * `id` attribute equals `id`.  Uses an attribute selector so that IDs containing
 * special characters (`:`, `_`, `.`) are handled correctly.
 */
export function findHeapElementById (id: string, root: Element | Document = document): Element | null {
  const escaped = escapeIdForAttributeSelector(id)
  return root.querySelector(`[id="${escaped}"]`)
}

/**
 * Finds all SVG elements belonging to a heap visualization record.
 *
 * Variables and heap items render into one or more cells whose IDs are built as
 * `${identifier}:${suffix}`.  Heap object lookup therefore returns the header
 * plus child cells such as fields/elements whose IDs continue with the same
 * identifier prefix.
 */
export function findHeapElements (target: HeapLookupTarget, root: Element | Document = document): Element[] {
  if (typeof target === 'string') {
    const element = findHeapElementById(target, root)
    return element ? [element] : []
  }

  const escaped = escapeIdForAttributeSelector(heapLookupIdentifier(target))
  return Array.from(root.querySelectorAll(`[id="${escaped}"], [id^="${escaped}:"]`))
}

export function findHeapElement (target: HeapLookupTarget, root: Element | Document = document): Element | null {
  return findHeapElements(target, root)[0] ?? null
}

export function getBoundingBoxesCorners (target: HeapLookupTarget, root: Element | Document = document): BoundingBoxCorners[] {
  return findHeapElements(target, root)
    .map(el => el.getBoundingClientRect())
    .filter(rect => rect.width !== 0 || rect.height !== 0)
    .map(boundingBoxCornersForRect)
}

/**
 * Returns the four corners and centre of the bounding box of the first element
 * with the given `id` inside `root`, in **viewport coordinates** (i.e. after all
 * CSS / SVG transforms have been applied).  When called with a heap
 * visualization record instead of a string ID, returns the union bounding box
 * of all matching UI elements for that record.
 *
 * Returns `null` when no element with that ID exists or when the element has
 * zero size (e.g. it is hidden or not yet painted).
 */
export function getBoundingBoxCorners (target: HeapLookupTarget, root: Element | Document = document): BoundingBoxCorners | null {
  if (typeof target === 'string') {
    const el = findHeapElementById(target, root)
    if (!el) return null

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null

    return boundingBoxCornersForRect(rect)
  }

  const rect = unionBoundingRect(findHeapElements(target, root))
  return rect ? boundingBoxCornersForRect(rect) : null
}
