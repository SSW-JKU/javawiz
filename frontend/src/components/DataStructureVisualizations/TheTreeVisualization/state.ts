/** Y coordinate of each depth of each tree row, kept in sync by TheTreeVisualization. */
export let yCoordinatesByTreeRowAndDepth: number[][] = []
export function setYCoordinatesByTreeRowAndDepth (coords: number[][]) { yCoordinatesByTreeRowAndDepth = coords }

/** Width of each tree row (each stacked tree), kept in sync by TheTreeVisualization. */
export let treeRowWidths: number[] = []
export function setTreeRowWidths (widths: number[]) { treeRowWidths = widths }
