import { edgeIdentifier } from './identifiers'

/** Color and line width of a reference arrow, as written into the DOT edge and later into its SVG shapes. */
export interface EdgeStyle {
  readonly color: string
  readonly penwidth: string
}

/** Matches the `penwidth` of the chart's default edge attributes. */
export const NORMAL_EDGE_STYLE: EdgeStyle = { color: 'black', penwidth: '1.2' }
const CHANGED_EDGE_STYLE: EdgeStyle = { color: 'red', penwidth: '2.0' }
const HIGHLIGHTED_EDGE_STYLE: EdgeStyle = { color: '#eda167', penwidth: '2.0' }

/**
 * Chooses the style of a reference arrow. A hovered arrow is orange even when its reference
 * changed in the last step, so the hover stays visible; otherwise a changed reference is red.
 */
export function referenceEdgeStyle (highlighted: boolean, changed: boolean): EdgeStyle {
  if (highlighted)
    return HIGHLIGHTED_EDGE_STYLE
  return changed ? CHANGED_EDGE_STYLE : NORMAL_EDGE_STYLE
}

/**
 * Renders the DOT edge from the variable or array cell `from` (its port) to the header of heap item `to`.
 * The edge always states its color and width, so the hover recoloring can restore them from the DOT.
 *
 * Example: `renderReferenceEdge('o_1:next', 'o_2', NORMAL_EDGE_STYLE)` gives
 * `o_1:next:e -> o_2:heap_object_header:w [id="edge:o_1:next->o_2" color="black" penwidth="1.2"];`
 */
export function renderReferenceEdge (from: string, to: string, style: EdgeStyle): string {
  return `${from}:e -> ${to}:heap_object_header:w [id="${edgeIdentifier(from, to)}" color="${style.color}" penwidth="${style.penwidth}"];`
}
