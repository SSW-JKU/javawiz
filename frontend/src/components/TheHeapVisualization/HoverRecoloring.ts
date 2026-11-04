import type { EdgeStyle } from './ReferenceEdge'

/**
 * The hover-dependent styles of one memory view rendering, keyed by SVG id: the background color of
 * every table cell with an id, and the color and width of every reference edge.
 */
export interface HoverStyles {
  readonly cells: ReadonlyMap<string, string>
  readonly edges: ReadonlyMap<string, EdgeStyle>
}

const TABLE_CELL = /<td\b[^>]*>/g
// Cell ids are injected as title="id=&quot;<id>&quot; ..." (see injectedTitleAttributes).
const INJECTED_CELL_ID = /\btitle="id=&quot;(.*?)&quot;/
const CELL_BACKGROUND = /\bbgcolor="([^"]*)"/
// Matches the attributes written by renderReferenceEdge.
const REFERENCE_EDGE = /\[id="([^"]+)" color="([^"]+)" penwidth="([^"]+)"\]/g

/** Reverses the escaping that injectedTitleAttributes applies to attribute values. */
function decodeInjectedValue (value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

/**
 * Reads the hover-dependent styles from a DOT string built by the memory view. Using the DOT keeps a single
 * rule for every color: the element classes decide colors while rendering, and recoloring copies them.
 *
 * Example: a cell `<td title="id=&quot;o_1:header&quot;" bgcolor="#b0d1ae">` gives `cells.get('o_1:header') === '#b0d1ae'`.
 */
export function hoverStylesFromDot (dot: string): HoverStyles {
  const cells = new Map<string, string>()
  for (const [cell] of dot.matchAll(TABLE_CELL)) {
    const id = INJECTED_CELL_ID.exec(cell)?.[1]
    const color = CELL_BACKGROUND.exec(cell)?.[1]
    if (id !== undefined && color !== undefined)
      cells.set(decodeInjectedValue(id), color)
  }
  const edges = new Map<string, EdgeStyle>()
  for (const [, id, color, penwidth] of dot.matchAll(REFERENCE_EDGE))
    edges.set(id, { color, penwidth })
  return { cells, edges }
}

/**
 * Changes the SVG produced from the `drawn` styles so that it shows the `next` styles, without a new Graphviz
 * layout. Only entries that differ are touched; elements missing from `elementsById` are skipped.
 *
 * Graphviz draws a cell background as a filled polygon and its border with `fill="none"`. An edge consists of
 * its path, an open dot at the tail (`fill="none"`), and a filled arrowhead.
 */
export function applyHoverStyles (elementsById: ReadonlyMap<string, Element>, drawn: HoverStyles, next: HoverStyles): void {
  for (const [id, color] of next.cells) {
    if (drawn.cells.get(id) === color)
      continue
    elementsById.get(id)?.querySelectorAll('polygon')
      .forEach(polygon => {
        if (polygon.getAttribute('fill') !== 'none')
          polygon.setAttribute('fill', color)
      })
  }
  for (const [id, style] of next.edges) {
    const drawnStyle = drawn.edges.get(id)
    if (drawnStyle?.color === style.color && drawnStyle.penwidth === style.penwidth)
      continue
    elementsById.get(id)?.querySelectorAll('path, ellipse, polygon')
      .forEach(shape => {
        shape.setAttribute('stroke', style.color)
        shape.setAttribute('stroke-width', style.penwidth)
        if (shape.getAttribute('fill') !== 'none')
          shape.setAttribute('fill', style.color)
      })
  }
}
