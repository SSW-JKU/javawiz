import { ref } from 'vue'
import type { ZoomTransform } from 'd3-zoom'

/** Current d3 zoom transform; updated on every zoom/pan event. */
export let transform: ZoomTransform | null = null
export function setTransform (t: ZoomTransform | null) { transform = t }

/** Y offsets of array levels, kept in sync by TheArrayVisualization. */
export const levelCoordinates = ref<number[]>([])
