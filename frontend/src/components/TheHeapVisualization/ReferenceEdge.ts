import { edgeIdentifier, type GraphvizNodeAndPort } from '@/identifiers/trace-identifiers'

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
 * Renders the DOT edge from the variable or array cell at `from` to the header of heap item `to`.
 * `fromIdentifier` is the cell's record identifier, used for the edge's id.
 * The edge always states its color and width, so the hover recoloring can restore them from the DOT.
 *
 * With `dotEdgeConstraintAttribute` false, Graphviz still draws the edge but ignores it when choosing the column and the vertical
 * order of the heap item. It is written as a second attribute list, so the first list keeps the exact form that
 * the hover recoloring reads.
 *
 * Example: `renderReferenceEdge({ node: 'obj_1', port: 'next' }, 'obj_1-next', 'obj_2', NORMAL_EDGE_STYLE)` gives
 * `obj_1:next:e -> obj_2:heap_object_header:w [id="edge-obj_1-next--obj_2" color="black" penwidth="1.2"];`
 */
export function renderReferenceEdge (
  from: GraphvizNodeAndPort,
  fromIdentifier: string,
  to: string,
  style: EdgeStyle,
  dotEdgeConstraintAttribute = true
): string {
  const layoutAttributes = dotEdgeConstraintAttribute ? '' : ' [constraint="false"]'
  const id = edgeIdentifier(fromIdentifier, to)
  return `${from.node}:${from.port}:e -> ${to}:heap_object_header:w [id="${id}" color="${style.color}" penwidth="${style.penwidth}"]${layoutAttributes};`
}
