import { Arrow, Box, Elements, LifeLine } from '@/components/TheSequenceDiagram/types'
import { ZoomBehavior, ZoomedElementBaseType } from 'd3-zoom'
import * as d3 from 'd3'
import { SVG, TRANSFORMATION, ZOOM } from '@/components/TheSequenceDiagram/constants'
import { getBoxEnd, getOrderIndex, isHidden } from '@/components/TheSequenceDiagram/data-utils'

/**
 * Get the coordinates used for the zoom
 * @param arrow changed arrow that should be zoomed
 * @param activeTimeIndices all currently active time indices
 */
export function getArrowCoordinates (arrow: Arrow, activeTimeIndices: number[]): [number, number] {
  return [
    arrow.to!!.index * 80 + 30,
    activeTimeIndices.indexOf(arrow.time!!) * 15
  ]
}

/**
 * Get the coordinates used for the zoom
 * @param box changed box that should be zoomed
 * @param activeTimeIndices all currently active time indices
 * @param lifeLines all existing lifelines
 */
export function getBoxCoordinates (box: Box, activeTimeIndices: number[], lifeLines: LifeLine[]): [number, number] {
  return [
    getOrderIndex(box.lifeLine, lifeLines) * 80 + 30,
    activeTimeIndices.indexOf(box.start) * 15
  ]
}

/**
 * Get the coordinates used for the zoom
 * @param lifeLine changed lifeline that should be zoomed
 * @param activeTimeIndices all currently active time indices
 * @param lifeLines all existing lifelines
 */
export function getLifeLineCoordinates (lifeLine: LifeLine, activeTimeIndices: number[], lifeLines: LifeLine[]): [number, number] {
  return [
    getOrderIndex(lifeLine, lifeLines) * 80 + 30,
    activeTimeIndices.indexOf(lifeLine.start) * 15
  ]
}

/**
 * Get the coordinates of the last change of an arrow
 * @param elems all elements
 * @param timeIdx current time index
 * @param activeTimeIndices all currently active time indices
 * @param hiddenLifeLines all currently hidden lifelines
 */
export function getCoordinatesOfChange ({ arrows, lifeLines, boxes }: Elements, timeIdx: number, activeTimeIndices: number[]) {
  let changedArrow: Arrow | undefined
  const lastArrow = arrows.at(-1)!!
  const firstArrow = arrows[0]
  if (lastArrow.time === timeIdx && !lastArrow.isHidden && lastArrow.changed) {
    changedArrow = lastArrow
    lastArrow.changed = false
  } else if (arrows.length === 1 && !firstArrow.isHidden && firstArrow.changed) {
    changedArrow = firstArrow
    firstArrow.changed = false
  }
  if (changedArrow && changedArrow.kind !== 'Constructor') {
    return getArrowCoordinates(changedArrow, activeTimeIndices)
  }
  let changedLifeLine: LifeLine | undefined
  const lastLifeLine = lifeLines.at(-1)!!
  if (lastLifeLine.start === timeIdx && !isHidden(lastLifeLine) && lastLifeLine.changed) {
    for (let i = 0; i < arrows.length; i++) {
      if (arrows[i].kind === 'Constructor' && arrows[i].to === lastLifeLine && !arrows[i].isHidden) {
        changedLifeLine = lastLifeLine
        arrows[i].changed = false
        lastLifeLine.changed = false
      }
    }
  }
  if (changedLifeLine) {
    return getLifeLineCoordinates(changedLifeLine, activeTimeIndices, lifeLines)
  }

  let changedBox: Box | undefined
  const lastBox = boxes.at(-1)!!
  const firstBox = boxes[0]
  if (getBoxEnd(lastBox, timeIdx) === timeIdx && !isHidden(lastBox) && lastBox.changed) {
    changedBox = lastBox
    lastBox.changed = false
  } else if (boxes.length === 1 && firstBox.changed && !isHidden(firstBox)) {
    changedBox = firstBox
    firstBox.changed = false
  }
  if (changedBox) {
    return getBoxCoordinates(changedBox, activeTimeIndices, lifeLines)
  }
  return undefined
}

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
  const lifeLineHeight = SVG.lifeLineHeight
  const lifeLineWidth = SVG.lifeLineWidth

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
  // calculate scaled lifeline size
  const scaledLifeLineWidth = lifeLineWidth * transform.k
  const scaledLifeLineHeight = (lifeLineHeight || (lifeLineWidth / 2)) * transform.k
  // calculate offset that is added when translating
  let offsetX = scaledLifeLineWidth / 2 * ZOOM.offsetMultiplier
  let offsetY = scaledLifeLineHeight * ZOOM.offsetMultiplier
  offsetX = offsetX > viewWidth / 2 ? viewWidth * (ZOOM.offsetMultiplier - 1) : offsetX
  offsetY = offsetY > viewHeight / 2 ? viewHeight * (ZOOM.offsetMultiplier - 1) : offsetY
  // calculate threshold, so coordinates that are close to the corners don't count as in view
  let thresholdX = scaledLifeLineWidth / 2 * ZOOM.thresholdMultiplier
  let thresholdY = scaledLifeLineHeight * ZOOM.thresholdMultiplier
  thresholdX = thresholdX > viewWidth / 2 ? viewWidth * (ZOOM.thresholdMultiplier - 1) : thresholdX
  thresholdY = thresholdY > viewHeight / 2 ? viewHeight * (ZOOM.thresholdMultiplier - 1) : thresholdY
  // check translation in x-axis
  if (x < upperLeft[0] + thresholdX) {
    // coordinate is left of the view
    dX = x - upperLeft[0] - offsetX
  } else if (x > lowerRight[0] - thresholdX ||
    (lifeLineWidth < viewWidth && x + lifeLineWidth > lowerRight[0] - thresholdX)) {
    // coordinate is right of the view or node is not fully visible
    if (lifeLineWidth + offsetX < viewWidth) {
      dX += lifeLineWidth
    } // add rectWidth, so the whole node is visible
    dX += x - lowerRight[0] + offsetX
  }
  // check translation in y-axis
  if (y < upperLeft[1] + thresholdY) {
    // coordinate is above the view
    dY = y - upperLeft[1] - offsetY
  } else if (y > lowerRight[1] - thresholdY ||
    (lifeLineHeight && lifeLineHeight < viewHeight && y + lifeLineHeight > lowerRight[1] - thresholdY)) {
    // coordinate is below the view or the node is not fully visible
    if (lifeLineHeight && lifeLineHeight + offsetY < viewHeight) {
      dY += lifeLineHeight // add rectHeight, so whole lifeLine is visible
    }
    dY += y - lowerRight[1] + offsetY
  }
  // translate
  zoom.translateBy(svg.transition().duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease) as any, -dX, -dY)
}
