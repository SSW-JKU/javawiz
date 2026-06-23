import { ZoomBehavior, ZoomedElementBaseType } from 'd3-zoom'
import * as d3 from 'd3'
import { SVG, ZOOM } from './constants'
import { TRANSFORMATION } from '@/helpers/constants'

/**
 * Zooms to change if needed
 * @param x x-coordinate of change
 * @param y y-coordinate of change
 * @param transform current transformation
 * @param zoom zoom-object of svg
 * @param divId id of div the svg is in
 * @param svgWidth width of the svg
 * @param svg svg in which something changed
 */
export function zoomToChange (
  x: number,
  y: number,
  transform: any,
  zoom: ZoomBehavior<ZoomedElementBaseType, unknown>,
  divId: string,
  svgWidth: number,
  svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>
) {
  const nodeHeight = 2 * SVG.cellHeight
  const nodeWidth = SVG.cellWidth

  // calculate corner-coordinates
  const upperLeft = transform.invert([0, 0])
  const divDOM = document.getElementById(divId)
  const height = divDOM ? divDOM.clientHeight / divDOM.clientWidth * svgWidth : 0
  const lowerRight = transform.invert([svgWidth, height])
  // calculate how much to translate the view
  let dX = 0
  let dY = 0
  // calculate view width and height
  const viewWidth = lowerRight[0] - upperLeft[0]
  const viewHeight = lowerRight[1] - upperLeft[1]
  // calculate scaled node size
  const scaledNodeWidth = nodeWidth * transform.k
  const scaledNodeHeight = (nodeHeight || (nodeWidth / 2)) * transform.k
  // calculate offset that is added when translating
  let offsetX = scaledNodeWidth / 2 * ZOOM.offsetMultiplier
  let offsetY = scaledNodeHeight * ZOOM.offsetMultiplier
  offsetX = offsetX > viewWidth / 2 ? viewWidth * (ZOOM.offsetMultiplier - 1) : offsetX
  offsetY = offsetY > viewHeight / 2 ? viewHeight * (ZOOM.offsetMultiplier - 1) : offsetY
  // calculate threshold, so coordinates that are close to the corners don't count as in view
  let thresholdX = scaledNodeWidth / 2 * ZOOM.thresholdMultiplier
  let thresholdY = scaledNodeHeight * ZOOM.thresholdMultiplier
  thresholdX = thresholdX > viewWidth / 2 ? viewWidth * (ZOOM.thresholdMultiplier - 1) : thresholdX
  thresholdY = thresholdY > viewHeight / 2 ? viewHeight * (ZOOM.thresholdMultiplier - 1) : thresholdY
  // check translation in x-axis
  if (x < upperLeft[0] + thresholdX) {
    // coordinate is left of the view
    dX = x - upperLeft[0] - offsetX
  } else if (x > lowerRight[0] - thresholdX ||
    (nodeWidth < viewWidth && x + nodeWidth > lowerRight[0] - thresholdX)) {
    // coordinate is right of the view or node is not fully visible
    if (nodeWidth + offsetX < viewWidth) {
      dX += nodeWidth
    } // add rectWidth, so the whole node is visible
    dX += x - lowerRight[0] + offsetX
  }
  // check translation in y-axis
  if (y < upperLeft[1] + thresholdY) {
    // coordinate is above the view
    dY = y - upperLeft[1] - offsetY
  } else if (y > lowerRight[1] - thresholdY ||
    (nodeHeight && nodeHeight < viewHeight && y + nodeHeight > lowerRight[1] - thresholdY)) {
    // coordinate is below the view or the node is not fully visible
    if (nodeHeight && nodeHeight + offsetY < viewHeight) {
      dY += nodeHeight // add rectHeight, so whole node is visible
    }
    dY += y - lowerRight[1] + offsetY
  }
  // translate
  zoom.translateBy(svg.transition().duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease) as any, -dX, -dY)
}
