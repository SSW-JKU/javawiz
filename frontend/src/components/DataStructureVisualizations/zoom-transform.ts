import { zoomIdentity, type ZoomTransform } from 'd3-zoom'

/** Returns a usable transform while D3 zoom state is not initialized yet. */
export function resolveZoomTransform (transform: ZoomTransform | null): ZoomTransform {
  return transform ?? zoomIdentity
}
