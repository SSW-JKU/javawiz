/**
 * Zooming and panning for every zoomable view (Flowchart View, Array View, List View, Tree View, Sequence Diagram View, Stream View,
 * and the Memory View's zoom buttons), so all views share one behavior and one set of settings.
 *
 * d3-zoom keeps the current zoom state on the SVG element itself and updates it before every `zoom` event.
 * This module therefore never stores its own copy: `zoomTransform(svg)` always returns the current state,
 * and the identity transform before the first zoom.
 */
import { select } from 'd3-selection'
// Adds selection.transition(), which the zoom animations below use.
import 'd3-transition'
import { zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import { NAVIGATION_CONTENT_INSET, TRANSFORMATION } from './constants.ts'

/** Zoom settings shared by all views. */
export const ZOOM = {
  /** Factor of one click on the zoom-in or zoom-out button. */
  step: 1.3,
  /** Smallest and largest scale the user can zoom to. */
  scaleExtent: [0.1, 10] as [number, number],
  /** Extra space, relative to the node size, left around a change after moving the view to it. */
  followOffset: 1.1,
  /** How close to the view's edge, relative to the node size, a change may be and still count as visible. */
  followThreshold: 1.05
}

/** Size of a drawn node, in SVG units at scale 1. */
export interface NodeSize {
  width: number
  height: number
}

/** The animation used by every zoom button and every automatic movement of the view. */
export function zoomTransition (svg: SVGSVGElement) {
  return select(svg).transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
}

/**
 * Zooms by `factor` around the center of `svg`, with the shared animation.
 * Factors above 1 zoom in, factors below 1 zoom out; `behavior`'s scale limits still apply.
 */
export function zoomBy (behavior: ZoomBehavior<SVGSVGElement, unknown>, svg: SVGSVGElement, factor: number) {
  behavior.scaleBy(zoomTransition(svg), factor)
}

/**
 * Returns how far the view must move, as [dX, dY] in SVG units, so that a node at (x, y) is fully visible.
 * Returns [0, 0] when the node is already visible and not too close to an edge.
 *
 * @param x left edge of the node in SVG units
 * @param y top edge of the node in SVG units
 * @param transform the view's current zoom state
 * @param viewWidth width of the visible area in SVG units at scale 1
 * @param viewHeight height of the visible area in SVG units at scale 1
 * @param node size of the node that should become visible
 *
 * @example
 * // A 600×400 view at scale 1; the node lies far below and to the right of it.
 * getTranslationToChange(900, 700, zoomIdentity, 600, 400, { width: 64.8, height: 36 }) // → [400.44, 375.6]
 */
export function getTranslationToChange (
  x: number,
  y: number,
  transform: ZoomTransform,
  viewWidth: number,
  viewHeight: number,
  node: NodeSize
): [number, number] {
  // corners of the visible area in content coordinates
  const upperLeft = transform.invert([0, 0])
  const lowerRight = transform.invert([viewWidth, viewHeight])
  const visibleWidth = lowerRight[0] - upperLeft[0]
  const visibleHeight = lowerRight[1] - upperLeft[1]
  const scaledNodeWidth = node.width * transform.k
  const scaledNodeHeight = (node.height || (node.width / 2)) * transform.k
  // space left around the node after moving; at most a small share of a view that is smaller than the node
  let offsetX = scaledNodeWidth / 2 * ZOOM.followOffset
  let offsetY = scaledNodeHeight * ZOOM.followOffset
  offsetX = offsetX > visibleWidth / 2 ? visibleWidth * (ZOOM.followOffset - 1) : offsetX
  offsetY = offsetY > visibleHeight / 2 ? visibleHeight * (ZOOM.followOffset - 1) : offsetY
  // nodes this close to an edge do not count as visible
  let thresholdX = scaledNodeWidth / 2 * ZOOM.followThreshold
  let thresholdY = scaledNodeHeight * ZOOM.followThreshold
  thresholdX = thresholdX > visibleWidth / 2 ? visibleWidth * (ZOOM.followThreshold - 1) : thresholdX
  thresholdY = thresholdY > visibleHeight / 2 ? visibleHeight * (ZOOM.followThreshold - 1) : thresholdY

  let dX = 0
  let dY = 0
  if (x < upperLeft[0] + thresholdX) {
    // node is left of the view
    dX = x - upperLeft[0] - offsetX
  } else if (x > lowerRight[0] - thresholdX ||
    (node.width < visibleWidth && x + node.width > lowerRight[0] - thresholdX)) {
    // node is right of the view or only partly visible; include its width if it fits
    if (node.width + offsetX < visibleWidth) {
      dX += node.width
    }
    dX += x - lowerRight[0] + offsetX
  }
  if (y < upperLeft[1] + thresholdY) {
    // node is above the view
    dY = y - upperLeft[1] - offsetY
  } else if (y > lowerRight[1] - thresholdY ||
    (node.height && node.height < visibleHeight && y + node.height > lowerRight[1] - thresholdY)) {
    // node is below the view or only partly visible; include its height if it fits
    if (node.height && node.height + offsetY < visibleHeight) {
      dY += node.height
    }
    dY += y - lowerRight[1] + offsetY
  }
  return [dX, dY]
}

/**
 * Moves the camera right just enough to clear the navigation icons.
 * Pass the visible content's left edge in screen pixels, for example a chart's
 * getBoundingClientRect().left. Scale and vertical position stay unchanged;
 * empty or unmeasurable content leaves the current transform unchanged.
 */
export function getNavigationClearTransform (svg: SVGSVGElement, current: ZoomTransform, contentLeft: number) {
  // The SVG viewBox scales drawing units independently of CSS pixels. The root
  // screen matrix converts the requested pixel clearance to zoom coordinates.
  const scale = svg.getScreenCTM()?.a ?? 0
  if (!svg.isConnected || !svg.clientWidth || scale <= 0 || !Number.isFinite(contentLeft)) return current
  const pixels = Math.max(0, svg.getBoundingClientRect().left + NAVIGATION_CONTENT_INSET - contentLeft)
  if (!pixels) return current
  return zoomIdentity.translate(current.x + pixels / scale, current.y).scale(current.k)
}

/**
 * Returns the transform that shows `bounds` centered in a view of the given size, filling 80 % of it.
 * Returns null for empty bounds, because there is nothing to fit.
 *
 * @example
 * getFitTransform(800, 600, { x: 0, y: 0, width: 400, height: 100 }) // → scale 1.6, translate (80, 220)
 */
export function getFitTransform (
  viewWidth: number,
  viewHeight: number,
  bounds: { x: number, y: number, width: number, height: number }
): ZoomTransform | null {
  if (!bounds.width || !bounds.height) return null
  const scale = Math.min(viewWidth / bounds.width, viewHeight / bounds.height) * 0.8
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return zoomIdentity.translate(viewWidth / 2 - scale * centerX, viewHeight / 2 - scale * centerY).scale(scale)
}

/**
 * Returns the transform at scale 1 that puts the content x coordinate `centerX` in the middle of a view
 * that is `viewWidth` wide, with the content's top at the top of the view.
 *
 * @example
 * getHorizontalCenterTransform(800, 25000) // → translate(-24600, 0)
 */
export function getHorizontalCenterTransform (viewWidth: number, centerX: number) {
  return zoomIdentity.translate(viewWidth / 2 - centerX, 0)
}

/**
 * Zoom state and operations of one view. Each view creates one instance and wires its zoom buttons to
 * `zoomIn`, `zoomOut`, and `reset`.
 *
 * @example
 * const viewZoom = new ViewZoom('#list-content')     // the <g> that holds the drawing
 * onMounted(() => {
 *   viewZoom.attach(svgElement)
 *   viewZoom.observeViewport(containerElement, () => svgWidth)
 * })
 * onUnmounted(() => viewZoom.detach())
 * // after each redraw:
 * viewZoom.followChange(x, y, { width: 64.8, height: 36 })
 */
export class ViewZoom {
  /** The d3 zoom behavior; it handles the mouse wheel and dragging. */
  readonly behavior: ZoomBehavior<SVGSVGElement, unknown>
  /**
   * True until the user zooms or pans, so automatic positioning never overrides the user's view.
   * Reset sets it again.
   */
  initialPositionPending = true
  /** The view's home position, used by reset and double-click. Return null while it cannot be measured yet. */
  home: () => ZoomTransform | null = () => zoomIdentity
  /**
   * Measures the left edge of the drawn content in screen pixels, or Infinity when nothing is drawn yet.
   * Set it to make the view start clear of the navigation icons in the top-left corner.
   */
  contentLeft: (() => number) | undefined

  private svg: SVGSVGElement | null = null
  private container: Element | null = null
  private svgWidth: (() => number) | undefined
  private resizeObserver: ResizeObserver | undefined

  /** @param contentSelector selects the element that the zoom moves and scales, usually a <g> inside the SVG */
  constructor (contentSelector: string) {
    this.behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent(ZOOM.scaleExtent)
      .on('zoom', (event) => {
        // Only mouse and touch gestures have a source event; button and automatic movements do not.
        if (event.sourceEvent) this.initialPositionPending = false
        select(contentSelector).attr('transform', event.transform.toString())
      })
  }

  /** The current zoom state; the identity transform before `attach`. */
  get transform (): ZoomTransform {
    return this.svg ? zoomTransform(this.svg) : zoomIdentity
  }

  /** Lets the user zoom and pan `svg`. Double-click returns to the home position. */
  attach (svg: SVGSVGElement) {
    this.svg = svg
    // d3 zooms in on double-click by default; replace that with reset.
    select(svg).call(this.behavior)
      .on('dblclick.zoom', () => { this.reset() })
  }

  /**
   * Watches the size of `container`, the element that holds the SVG.
   * With `svgWidth`, the SVG's viewBox keeps that width and the container's aspect ratio, so the drawing scales
   * with the container, and `followChange` knows the visible area. `onResize` runs after each size change.
   */
  observeViewport (container: Element, svgWidth?: () => number, onResize?: () => void) {
    this.resizeObserver?.disconnect()
    this.container = container
    this.svgWidth = svgWidth
    this.resizeObserver = new ResizeObserver(() => {
      if (svgWidth) {
        const width = svgWidth()
        const height = container.clientHeight / container.clientWidth * width
        if (!height) return
        this.svg?.setAttribute('viewBox', `0 0 ${width} ${height}`)
      }
      onResize?.()
    })
    this.resizeObserver.observe(container)
  }

  /** Stops watching the container and cancels running zoom animations. Call it when the view unmounts. */
  detach () {
    this.resizeObserver?.disconnect()
    if (this.svg) select(this.svg).interrupt()
  }

  /** Zooms in by one button step. */
  zoomIn () {
    this.zoomByButton(ZOOM.step)
  }

  /** Zooms out by one button step. */
  zoomOut () {
    this.zoomByButton(1 / ZOOM.step)
  }

  /**
   * Returns to the home position, animated or immediately. Afterwards the view moves clear of the
   * navigation icons when `contentLeft` is set. Does nothing while the home position cannot be measured.
   */
  reset (animate = true) {
    this.initialPositionPending = true
    const home = this.home()
    if (!this.svg || !home) return
    if (!animate) {
      this.behavior.transform(select(this.svg), home)
      this.positionClearOfNavigation()
      return
    }
    const transition = zoomTransition(this.svg)
    this.behavior.transform(transition, home)
    transition.on('end.navigation', () => this.positionClearOfNavigation())
  }

  /**
   * Moves the view, animated, just far enough that a node at (x, y) in SVG units is visible.
   * Needs `observeViewport` with an SVG width. Afterwards the view moves clear of the navigation icons
   * when `contentLeft` is set.
   */
  followChange (x: number, y: number, node: NodeSize) {
    if (!this.svg) return
    const width = this.svgWidth?.() ?? 0
    const height = this.container ? this.container.clientHeight / this.container.clientWidth * width : 0
    const [dX, dY] = getTranslationToChange(x, y, this.transform, width, height, node)
    const transition = zoomTransition(this.svg)
    this.behavior.translateBy(transition, -dX, -dY)
    transition.on('end.navigation', () => this.positionClearOfNavigation())
  }

  /**
   * Centers the view on `target` (content coordinates) if a point is outside the SVG on screen.
   * The point's screen position is `chartOrigin + relative × scale`, where `chartOrigin` is the screen position
   * of the drawing's origin and `relative` the point's unscaled offset from it.
   */
  centerIfOffScreen (target: [number, number], relative: [number, number], chartOrigin: [number, number]) {
    if (!this.svg) return
    const scale = this.transform.k
    const x = chartOrigin[0] + relative[0] * scale
    const y = chartOrigin[1] + relative[1] * scale
    const bounds = this.svg.getBoundingClientRect()
    if (bounds.left <= x && x <= bounds.right && bounds.top <= y && y <= bounds.bottom) return
    this.behavior.translateTo(zoomTransition(this.svg), target[0], target[1])
  }

  /**
   * Moves the view right, without animation, so the content starts clear of the navigation icons.
   * Runs only once until the next reset, and never after the user zoomed or panned. Does nothing while the
   * SVG or its content is not laid out yet, so callers can simply retry after the next redraw or resize.
   */
  positionClearOfNavigation () {
    const svg = this.svg
    if (!this.contentLeft || !this.initialPositionPending || !svg?.isConnected || !svg.clientWidth) return
    // Wait until observeViewport replaced the template's placeholder viewBox; otherwise its temporary
    // scale would turn the pixel inset into extra space.
    if (this.svgWidth && svg.viewBox.baseVal.width !== this.svgWidth()) return
    const left = this.contentLeft()
    if (!Number.isFinite(left)) return
    this.initialPositionPending = false
    this.behavior.transform(select(svg), getNavigationClearTransform(svg, this.transform, left))
  }

  private zoomByButton (factor: number) {
    this.initialPositionPending = false
    if (this.svg) zoomBy(this.behavior, this.svg, factor)
  }
}
