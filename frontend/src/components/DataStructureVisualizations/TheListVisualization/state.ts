import { zoomIdentity, type ZoomTransform } from 'd3-zoom'

/** Current d3 zoom transform; updated on every zoom/pan event. */
export let transform: ZoomTransform = zoomIdentity
export function setTransform (t: ZoomTransform) { transform = t }

/** Y offsets of list levels, kept in sync by TheListVisualization. */
export let levelCoordinates: number[] = []
export function setLevelCoordinates (coords: number[]) { levelCoordinates = coords }
