import type { ZoomTransform } from 'd3-zoom'

/** Current d3 zoom transform; updated on every zoom/pan event. */
export let transform: ZoomTransform | null = null
export function setTransform (t: ZoomTransform | null) { transform = t }

/** Y offsets per tree level, kept in sync by TheTreeVisualization. */
export let levelCoordinates: number[][] = []
export function setLevelCoordinates (coords: number[][]) { levelCoordinates = coords }

/** Width of each tree level, kept in sync by TheTreeVisualization. */
export let levelWidths: number[] = []
export function setLevelWidths (widths: number[]) { levelWidths = widths }
