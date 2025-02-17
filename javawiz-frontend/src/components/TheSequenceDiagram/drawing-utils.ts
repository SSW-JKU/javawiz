import { Box, LifeLine, Arrow, Elements } from '@/components/TheSequenceDiagram/types'
import { DATA, DURATION, HTML, LAYOUT, SVG } from '@/components/TheSequenceDiagram/constants'
import {
  getBoxByIndex,
  getBoxEnd,
  getBoxesForLifeLine,
  getOrderIndex,
  getVisibleBoxesForLifeLine,
  isChangedWithNoTransition,
  isChangedWithTransition,
  isCollapsedAndDrawn,
  isHidden,
  isMainBox,
  isMainLifeLine,
  isVisible,
  wasVisible
} from '@/components/TheSequenceDiagram/data-utils'
import { Selection, BaseType } from 'd3-selection'
import { easeCubic } from 'd3-ease'

// checks whether a cross of a lifeline is visible or not and returns the according opacity
export function getCrossOpacity (l: LifeLine, timeIdx: number) {
  if (!l.end) {
    return '0'
  }
  if (!l.programEnd) {
    return l.end <= timeIdx ? '1' : '0'
  }
  return l.end <= timeIdx + 1 ? '1' : '0'
}

// checks whether a dot of a box is visible or not and returns the according opacity
export function getDotOpacity (box: Box) {
  return isCollapsedAndDrawn(box) ? '1' : '0'
}

// checks whether an arrow is visible or not and returns the according opacity
export function getArrowOpacity (arrow: Arrow) {
  return arrow.isHidden ? '0' : '1'
}

// checks whether a lifeline is visible or not and returns the according opacity
export function getLifeLineOpacity (lifeLine: LifeLine) {
  return isVisible(lifeLine) ? '1' : '0'
}

export function getCoordinatesForArrow (arrow: Arrow): [number, number] {
  return [arrow.from!!.index * LAYOUT.xMultiplier + LAYOUT.xOffset, arrow.time!! * LAYOUT.yMultiplier + LAYOUT.yOffset]
}

export function getCoordinatesForLifeLine (lifeLine: LifeLine, activeTimeIndices: number[]): [number, number] {
  const x = lifeLine.index * LAYOUT.xMultiplier + LAYOUT.xOffset
  if (isHidden(lifeLine) || !activeTimeIndices.includes(lifeLine.start)) {
    return [x, lifeLine.start * LAYOUT.yMultiplier + LAYOUT.lineOffset]
  }
  return [x, activeTimeIndices.indexOf(lifeLine.start) * LAYOUT.yMultiplier + LAYOUT.lineOffset]
}

export function getCoordinatesForBox (box: Box, activeTimeIndices: number[]) {
  let x = box.lifeLine.index * LAYOUT.xMultiplier + LAYOUT.xOffset
  if (box.callArrow) { // not a constructor
    x -= LAYOUT.xMultiplier
  }
  if (activeTimeIndices.includes(box.start)) {
    return [x, activeTimeIndices.indexOf(box.start) * LAYOUT.yMultiplier + LAYOUT.yOffset]
  }
  return [x, box.start * LAYOUT.yMultiplier + LAYOUT.yOffset]
}

// calculates the second y-coordinate for a lifeline
export function getYCoordinateForLine (l: LifeLine, timeIdx: number, activeTimeIndices: number[], boxes: Box[]): number {
  const end = getNewLifeLineEnd(l, timeIdx, activeTimeIndices)
  const start = activeTimeIndices.indexOf(l.start)
  if (end !== -1) {
    return LAYOUT.yMultiplier * (end - start) + LAYOUT.lineOffset - 8
  }
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const lifeLineEnd = l.end
    if (box.end && lifeLineEnd && box.currState === 'collapsed' && lifeLineEnd < box.end && lifeLineEnd > box.start) {
      return LAYOUT.yMultiplier * (activeTimeIndices.indexOf(box.end) - 1 - start) + LAYOUT.lineOffset - 8
    }
  }
  return LAYOUT.yMultiplier * (activeTimeIndices.indexOf(timeIdx) - start) + LAYOUT.lineOffset - 8
}

// calculates the first y-coordinate for the vertical line of a lifeline
export function getYForVerticalLine (l: LifeLine, activeTimeIndices: number[]) {
  if (activeTimeIndices.indexOf(l.start) === l.start || activeTimeIndices.includes(l.start) || activeTimeIndices.every(activeIndex => activeIndex <= l.start)) {
    return LAYOUT.line.yOffset
  }
  return LAYOUT.line.yOffset - LAYOUT.yMultiplier
}

// returns the ending time index of a lifeline
export function getNewLifeLineEnd (l: LifeLine, timeIdx: number, activeTimeIndices: number[]) {
  if (l.end && !l.programEnd) {
    if (l.currState === 'expanded' && activeTimeIndices.indexOf(l.end) === -1) {
      const max = Math.max(0, ...activeTimeIndices.filter(i => i < l.end!!))
      return activeTimeIndices.indexOf(max)
    }
    const end = activeTimeIndices.indexOf(l.end!!)
    return Math.min(activeTimeIndices.indexOf(timeIdx), (l.currState === 'collapsed' || (l.end && end !== -1)) ? end : activeTimeIndices.indexOf(l.end!! - 1))
  }

  if (l.programEnd && l.end) {
    if (activeTimeIndices.indexOf(l.end) >= 0) return activeTimeIndices.indexOf(l.end)
    if (activeTimeIndices.indexOf(l.end - 1) >= 0) return activeTimeIndices.indexOf(l.end - 1)
  }
  return activeTimeIndices.indexOf(timeIdx)
}

// calculates the second y-coordinate for a cross indicating the end of a lifeline
export function getYCoordsForCross (l: LifeLine, id: string, timeIdx: number, activeTimeIndices: number[], boxes: Box[]): {y1: number, y2: number} {
  let y1: number
  let y2: number
  let result = getSecondYForVerticalLine(l, activeTimeIndices, boxes, timeIdx)
  if (isMainLifeLine(l) && getFirstBox(boxes, l)!!.currState === 'collapsed') {
    result = LAYOUT.line.mainY2
  }
  if (id === HTML.ids.firstCrossLine) {
    y1 = result - LAYOUT.shift
    y2 = result + LAYOUT.shift
  } else {
    y1 = result + LAYOUT.shift
    y2 = result - LAYOUT.shift
  }
  return { y1, y2 }
}

// calculates the first x-coordinate for an arrow
export function getFirstXForArrow (a: Arrow): number {
  let result: number = 0
  if (a.direction === 'Right') {
    result = LAYOUT.width / 2 + LAYOUT.shift
  } else if (a.direction === 'Left') {
    result = LAYOUT.width / 2 - LAYOUT.shift
  }
  result += LAYOUT.shift * a.fromDepth
  return result
}

// calculates the second x-coordinate for an arrow
export function getSecondXBaseForArrow (a: Arrow): number {
  let result: number = -1
  if (a.direction === 'Left') {
    result = -(LAYOUT.xMultiplier - LAYOUT.width / 2 - LAYOUT.shift)
  } else if (a.direction === 'Right') {
    result = LAYOUT.xMultiplier + LAYOUT.width / 2 - LAYOUT.shift
  }
  result += LAYOUT.shift * a.toDepth
  const indexDelta = a.to!!.index - a.from!!.index
  if (a.direction === 'Left') {
    result += (LAYOUT.xMultiplier - LAYOUT.width / 2 + 20) * (indexDelta + 1)
  } else if (a.direction === 'Right') {
    result += (LAYOUT.xMultiplier + LAYOUT.width / 2 - 20) * (indexDelta - 1)
  }
  return result
}

// calculates the x-coordinate for the text of an arrow
export function getXBaseForArrowText (a: Arrow): number {
  let result: number = -1
  if (a.direction === 'Left') {
    result = -(LAYOUT.width / 2 + LAYOUT.xOffset)
  } else if (a.direction === 'Right') {
    result = LAYOUT.width / 2 + 9
  }
  const deltaLifeLineIdx = a.from!!.index - a.to!!.index
  if (a.direction === 'Right' && (deltaLifeLineIdx === 1 || a.fromDepth > 0)) {
    result += LAYOUT.shift * a.fromDepth
  } else if (a.direction === 'Left' && deltaLifeLineIdx === 1) {
    result += LAYOUT.shift * a.toDepth
  }
  return result
}

// calculates the second x-coordinate for a self-call arrow text
export function getTextCoordinate (a: Arrow): number {
  return LAYOUT.shift * a.fromDepth + LAYOUT.width + 2
}

// calculates the height of a box
export function getHeight (box: Box, timeIdx: number, activeTimeIndices: number[], hiddenLifeLines: LifeLine[], arrows: Arrow[]) {
  if (box.currState === 'collapsed') {
    return getCollapsedBoxHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows)
  }
  let height = getNewBoxHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows)
  if (box.callArrow && box.callArrow.kind === 'CallMain') {
    height += LAYOUT.box.mainHeightOffset
  }
  return height
}

// returns the y-coordinate for an arrow
export function getYForArrow (y: number, activeTimeIndices: number[], arrow: Arrow, hiddenLifeLines: LifeLine[], arrows: Arrow[], boxes: Box[]) {
  if (arrow.kind === 'Return') {
    for (let i = 0; i < hiddenLifeLines.length; i++) {
      const hiddenLifeLine = hiddenLifeLines[i]
      for (let j = 0; j < arrows.length; j++) {
        const fromBox = getBoxByIndex(arrows[j].fromBoxIndex!!, boxes)!!
        if (arrows[j].kind === 'Constructor' && arrows[j].to === hiddenLifeLine && fromBox.returnArrow === arrow) {
          let time = arrow.time!!
          if (hiddenLifeLine.end && arrow.time === hiddenLifeLine.end - 1) {
            time = hiddenLifeLine.end
          }
          return y - (LAYOUT.yMultiplier * (arrow.time!! - activeTimeIndices.indexOf(time)))
        }
      }
    }
  }
  if (activeTimeIndices.includes(arrow.time!!)) {
    return y - (LAYOUT.yMultiplier * (arrow.time!! - activeTimeIndices.indexOf(arrow.time!!)))
  }
  for (let i = 1; i < activeTimeIndices.length; i++) {
    if (activeTimeIndices[i] > arrow.time!!) {
      return y - (LAYOUT.yMultiplier * (arrow.time!! - activeTimeIndices.indexOf(activeTimeIndices[i])))
    }
  }
  return y
}

// returns the first starting box of a lifeline
export function getFirstBox (boxes: Box[], lifeLine: LifeLine) {
  if (lifeLine === null) {
    return undefined
  }
  return boxes.find(box => box.start === lifeLine.start + 1 && box.lifeLine === lifeLine)
}

// calculates the height of a method box depending on the active time indices
export function getNewBoxHeight (
  box: Box,
  timeIdx: number,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[],
  arrows: Arrow[]
): number {
  let boxDelta = getNewBoxEnd(box, timeIdx, activeTimeIndices, hiddenLifeLines) - activeTimeIndices.indexOf(box.start)
  for (let i = 0; i < hiddenLifeLines.length; i++) {
    const hiddenLifeLine = hiddenLifeLines[i]
    if (hiddenLifeLine.end && box.end && box.end >= hiddenLifeLine.start && activeTimeIndices.includes(hiddenLifeLine.end) && activeTimeIndices.at(-2)!! < box.end) {
      for (let j = 0; j < arrows.length; j++) {
        const arrow = arrows[j]
        if (arrow.kind === 'Constructor' && arrow.to === hiddenLifeLine && arrow.fromBoxIndex === box.index) {
          boxDelta = activeTimeIndices.indexOf(hiddenLifeLine.end) - activeTimeIndices.indexOf(box.start)
        }
      }
    }
  }
  if (!isMainBox(box)) {
    return (LAYOUT.yMultiplier * boxDelta) + LAYOUT.box.heightOffset
  }
  if (activeTimeIndices.length === DATA.programStart && timeIdx !== activeTimeIndices.at(-1)) {
    return 0 // at beginning of program
  }
  if (box.lifeLine.programEnd && box.currState === 'collapsed') {
    return LAYOUT.yMultiplier
  }
  return LAYOUT.yMultiplier * boxDelta
}

// returns the ending active time index of a box
export function getNewBoxEnd (box: Box, timeIdx: number, activeTimeIndices: number[], hiddenLifeLines: LifeLine[]) {
  if (!box.end) {
    const lifeLine = box.lifeLine
    if (isMainLifeLine(lifeLine) && lifeLine.programEnd && hiddenLifeLines.length > 0) {
      return activeTimeIndices.indexOf(lifeLine.end!!)
    }
    return activeTimeIndices.indexOf(timeIdx)
  }
  const boxEnd = getBoxEnd(box, timeIdx)
  if (box.currState === 'expanded' && !activeTimeIndices.includes(boxEnd)) {
    const max = Math.max(0, ...activeTimeIndices.filter(i => i < boxEnd))
    if (max === boxEnd - 1 || !activeTimeIndices.includes(timeIdx)) {
      return activeTimeIndices.indexOf(max)
    }
    return activeTimeIndices.indexOf(timeIdx)
  } else if (box.currState === 'collapsed' && box.isDrawn) {
    return activeTimeIndices.indexOf(box.start) + 1
  }
  return activeTimeIndices.indexOf(boxEnd)
}

// calculates the x-coordinate for a box
export function getXBaseForBox (box: Box): number {
  return 80 + LAYOUT.width / 2 - LAYOUT.shift + LAYOUT.shift * box.depth
}

export function getXForConstructorBox (box: Box): number {
  return LAYOUT.width / 2 - LAYOUT.shift + LAYOUT.shift * box.depth
}

// calculates the x-coordinates of the lines needed to draw a self call arrow
export function getCoordsForSelfCallArrow (arrow: Arrow) {
  const shift = LAYOUT.shift * arrow.fromDepth
  return {
    line1: {
      x1: (LAYOUT.width / 2) + shift,
      y1: -LAYOUT.shift,
      x2: LAYOUT.width + shift,
      y2: -LAYOUT.shift
    },
    line2: {
      x1: LAYOUT.width + shift,
      y1: -LAYOUT.shift,
      x2: LAYOUT.width + shift,
      y2: 0
    },
    line3: {
      x1: LAYOUT.width + shift,
      y1: 0,
      x2: LAYOUT.width / 2 + LAYOUT.shift + shift,
      y2: 0
    }
  }
}

function offsetX (lifeLine: LifeLine, lifeLines: LifeLine[]): number {
  if (!isVisible(lifeLine)) {
    return 0
  }
  return lifeLine.index * LAYOUT.xMultiplier + LAYOUT.xOffset - (getOrderIndex(lifeLine, lifeLines) * LAYOUT.xMultiplier + LAYOUT.xOffset)
}

// calculates the x-coordinate of a vertical line depending on possibly hidden lifelines
export function getXForVerticalLine (lifeLine: LifeLine, lifeLines: LifeLine[]) {
  return LAYOUT.width / 2 - offsetX(lifeLine, lifeLines)
}

// calculates the x-coordinate of the lifeline label
export function getXForLabel (lifeLine: LifeLine, lifeLines: LifeLine[]) {
  return 8 - offsetX(lifeLine, lifeLines)
}

// calculates the x-coordinate of a horizontal line depending on possibly hidden lifelines
export function getXForHorizontal (lifeLine: LifeLine, lifeLines: LifeLine[]): [x1: number, x2: number] {
  const offset = offsetX(lifeLine, lifeLines)
  const x1 = LAYOUT.line.xOffset - offset
  const horizontalLineLength = LAYOUT.width + LAYOUT.horizontalLine.xOffset
  const x2 = horizontalLineLength - offset
  return [x1, x2]
}

// calculates the x-coordinate of a cross depending on possibly hidden lifelines
export function getXForCross (lifeLine: LifeLine, lifeLines: LifeLine[]): [x1: number, x2: number] {
  const offset = offsetX(lifeLine, lifeLines)
  const x1 = SVG.getFirstXCoordinateForCross() - offset
  const x2 = SVG.getSecondXCoordinateForCross() - offset
  return [x1, x2]
}

// calculates the x-coordinate of a box depending on possibly hidden lifelines
export function getXForBox (box: Box, lifeLines: LifeLine[]) {
  let x
  if (box.callArrow) {
    x = getXBaseForBox(box)
  } else {
    x = getXForConstructorBox(box)
  }
  const lifeLine = box.lifeLine
  const orderIndex = getOrderIndex(lifeLine, lifeLines)
  return x - (lifeLine.index - orderIndex) * LAYOUT.xMultiplier
}

function arrowOffsetX (lifeLine: LifeLine, lifeLines: LifeLine[]) {
  const orderIndex = getOrderIndex(lifeLine, lifeLines)
  return (lifeLine.index - orderIndex) * LAYOUT.xMultiplier
}

// returns the x-coordinate of an arrow text depending on possibly hidden lifelines
export function getXForArrowText (arrow: Arrow, lifeLines: LifeLine[]) {
  let x = getXBaseForArrowText(arrow)
  if (arrow.direction === 'Left' && !arrow.isHidden) {
    x -= arrowOffsetX(arrow.from!!, lifeLines)
  }
  return x
}

// returns the x-coordinate of an arrow depending on possibly hidden lifelines
export function getXForArrow (x: number, arrow: Arrow, lifeLines: LifeLine[]) {
  if (!arrow.isHidden) {
    x -= arrowOffsetX(arrow.from!!, lifeLines)
  }
  return x
}

// returns the x-coordinate of an arrow depending on possibly hidden lifelines
export function getX2ForArrow (x: number, arrow: Arrow, lifeLines: LifeLine[]) {
  if (!arrow.isHidden) {
    x -= arrowOffsetX(arrow.to!!, lifeLines)
  }
  return x
}

// returns the updated height of a box
export function getUpdatedHeight (box: Box, activeTimeIndices: number[], timeIdx: number, hiddenLifeLines: LifeLine[], { boxes, arrows }: Elements) {
  const lifeLine = box.lifeLine
  const nVisibleBoxes = getVisibleBoxesForLifeLine(lifeLine, boxes).length
  if (isMainBox(box) && nVisibleBoxes === 1 && activeTimeIndices.length === DATA.programStart) {
    const collapsedHeight = getCollapsedBoxHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows)
    return collapsedHeight + LAYOUT.box.shift
  }
  return getHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows)
}

// returns the height of a collapsed box
export function getCollapsedBoxHeight (box: Box, timeIdx: number, activeTimeIndices: number[], hiddenLifeLines: LifeLine[], arrows: Arrow[]) {
  const newBoxHeight = getNewBoxHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows)
  if (!isMainBox(box)) {
    return newBoxHeight
  }
  let boxOffset = LAYOUT.box.collapsedBoxOffset
  if (activeTimeIndices.length === DATA.programStart) {
    boxOffset = DATA.programStart
  }
  return newBoxHeight + boxOffset
}

// calculates the second y-coordinate of a vertical line
export function getSecondYForVerticalLine (lifeLine: LifeLine, activeTimeIndices: number[], boxes: Box[], timeIdx: number) {
  const boxesForLifeLine = getBoxesForLifeLine(lifeLine, boxes)
  if (isMainLifeLine(lifeLine) && boxesForLifeLine.length === 1) {
    const firstBox = boxesForLifeLine[0]
    if (activeTimeIndices.length === DATA.programStart || (activeTimeIndices.length === 4 && firstBox.currState === 'collapsed' && firstBox.isDrawn)) {
      return LAYOUT.line.mainY2
    }
  }
  return getYCoordinateForLine(lifeLine, timeIdx, activeTimeIndices, boxes)
}

// calculates the starting y-position of a dot
function getDotPosition (id: string, box: Box, activeTimeIndices: number[], timeIdx: number, hiddenLifeLines: LifeLine[], { arrows, boxes }: Elements) {
  let height = getCollapsedBoxHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows) + 2
  const lifeLine = box.lifeLine
  const visibleBoxes = getVisibleBoxesForLifeLine(lifeLine, boxes)
  if (isMainBox(box) && visibleBoxes.length === 1 && activeTimeIndices.length === DATA.programStart) {
    height = getHeight(box, timeIdx, activeTimeIndices, hiddenLifeLines, arrows) + 15
  }
  if (id === HTML.ids.dot1) {
    return height / 2 - 3 * LAYOUT.circle.radius - 1
  } else if (id === HTML.ids.dot2) {
    return height / 2 - LAYOUT.circle.radius
  } else {
    return height / 2 + LAYOUT.circle.radius + 1
  }
}

// returns the cx-coordinate of a dot
export function getCXForDot (box: Box, lifeLines: LifeLine[]) {
  let base = LAYOUT.shift
  if (box.callArrow) {
    base += getXBaseForBox(box)
  } else {
    base += getXForConstructorBox(box)
  }
  const lifeLine = box.lifeLine
  return base - (lifeLine.index - getOrderIndex(lifeLine, lifeLines)) * LAYOUT.xMultiplier
}

// returns the cy-coordinate of a dot
export function getCYForDot (
  id: string,
  box: Box,
  activeTimeIndices: number[],
  timeIdx: number,
  hiddenLifeLines: LifeLine[],
  elems: Elements
) {
  return LAYOUT.box.yOffset + getDotPosition(id, box, activeTimeIndices, timeIdx, hiddenLifeLines, elems)
}

// updates the dots of a box
export function updateDots (
  u: Selection<BaseType, Box, BaseType, unknown>,
  activeTimeIndices: number[],
  elems: Elements,
  timeIdx: number,
  hiddenLifeLines: LifeLine[]
) {
  u.select(`#${HTML.ids.dot1}`)
    .filter(d => isChangedWithNoTransition(d))
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot1, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', '1')
  u.select(`#${HTML.ids.dot1}`)
    .filter(d => !isCollapsedAndDrawn(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => getDotOpacity(d))
  u.select(`#${HTML.ids.dot1}`)
    .filter(d => isChangedWithTransition(d))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot1, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', '1')
  u.select(`#${HTML.ids.dot2}`)
    .filter(d => isChangedWithNoTransition(d))
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot2, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', '1')
  u.select(`#${HTML.ids.dot2}`)
    .filter(d => !isCollapsedAndDrawn(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => getDotOpacity(d))
  u.select(`#${HTML.ids.dot2}`)
    .filter(d => isChangedWithTransition(d))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot2, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', '1')
  u.select(`#${HTML.ids.dot3}`)
    .filter(d => isChangedWithNoTransition(d))
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot3, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', d => {
      d.prevState = 'collapsed'
      d.wasDrawn = true
      return '1'
    })
  u.select(`#${HTML.ids.dot3}`)
    .filter(d => !isCollapsedAndDrawn(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      if (d.currState === 'expanded' && (d.prevState === 'hidden' || (d.prevState === 'collapsed' && !d.wasDrawn))) {
        d.prevState = 'expanded'
      }
      return getDotOpacity(d)
    })
  u.select(`#${HTML.ids.dot3}`)
    .filter(d => isChangedWithTransition(d))
    .transition()
    .ease(easeCubic)
    .duration(DURATION)
    .attr('cx', d => getCXForDot(d, elems.lifeLines))
    .attr('cy', d => getCYForDot(HTML.ids.dot3, d, activeTimeIndices, timeIdx, hiddenLifeLines, elems))
    .attr('fill', LAYOUT.dotColor)
    .style('opacity', '1')
}

// updates all arrows
export function updateArrows (
  u: Selection<BaseType, Arrow, BaseType, unknown>,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[],
  elems: Elements
) {
  updateCallArrows(u, activeTimeIndices, hiddenLifeLines, elems)
  updateSelfCallArrows(u, activeTimeIndices, hiddenLifeLines, elems)
  updateReturnArrows(u, activeTimeIndices, hiddenLifeLines, elems)
}

// updates the call arrows
function updateCallArrows (
  u: Selection<BaseType, Arrow, BaseType, unknown>,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[],
  { arrows, boxes, lifeLines }: Elements
) {
  u.select(`#${HTML.ids.callArrowLine}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.callArrowLine}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .style('opacity', '1')
  u.select(`#${HTML.ids.callTextLabel}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x', d => getXForArrowText(d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) - 1)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      d.wasHidden = false
      return '1'
    })
  u.select(`#${HTML.ids.callTextLabel}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x', d => getXForArrowText(d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) - 1)
    .style('opacity', '1')
  u.select(`#${HTML.ids.constructorLine}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, lifeLines) - LAYOUT.constructorOffset)
    .attr('y1', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.constructorOffset)
    .attr('y2', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.constructorOffset)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.constructorLine}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('x2', d => getX2ForArrow(getSecondXBaseForArrow(d), d, lifeLines) - LAYOUT.constructorOffset)
    .attr('y1', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.constructorOffset)
    .attr('y2', d => getYForArrow(LAYOUT.arrow.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.constructorOffset)
    .style('opacity', '1')
  u.select(`#${HTML.ids.constructorLabel}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x', d => getXForArrow(getXBaseForArrowText(d), d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.text.constructor)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      d.wasHidden = false
      return '1'
    })
  u.select(`#${HTML.ids.constructorLabel}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x', d => getXForArrow(getXBaseForArrowText(d), d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.constructor, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.text.constructor)
    .style('opacity', '1')
}

// updates self call arrows
function updateSelfCallArrows (
  u: Selection<BaseType, Arrow, BaseType, unknown>,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[],
  { arrows, boxes, lifeLines }: Elements
) {
  u.select(`#${HTML.ids.selfCallArrowLine1}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowLine1}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line1.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowLine2}`)
    .filter(d => !d.wasHidden && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowLine2}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line2.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowLine3}`)
    .filter(d => !d.wasHidden && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowLine3}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x1, d, lifeLines))
    .attr('x2', d => getXForArrow(getCoordsForSelfCallArrow(d).line3.x2, d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .attr('y2', d => getYForArrow(LAYOUT.arrow.secYOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowText}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x', d => getXForArrow(getTextCoordinate(d), d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) - LAYOUT.text.selfCall)
    .style('opacity', '1')
  u.select(`#${HTML.ids.selfCallArrowText}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x', d => getXForArrow(getTextCoordinate(d), d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.selfCall.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) - LAYOUT.text.selfCall)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      d.wasHidden = false
      return '1'
    })
}

// updates return arrows
function updateReturnArrows (
  u: Selection<BaseType, Arrow, BaseType, unknown>,
  activeTimeIndices: number[],
  hiddenLifeLines: LifeLine[],
  { arrows, boxes, lifeLines }: Elements
) {
  u.select(`#${HTML.ids.returnArrowLine}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.returnOffset)
    .attr('y2', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.returnOffset)
    .style('opacity', '1')
  u.select(`#${HTML.ids.returnArrowLine}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x1', d => getXForArrow(getFirstXForArrow(d), d, lifeLines))
    .attr('y1', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.returnOffset)
    .attr('y2', d => getYForArrow(LAYOUT.arrow.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes) + LAYOUT.returnOffset)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.returnTextLabel}`)
    .filter(d => !d.wasHidden!! && !d.isHidden)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x', d => getXForArrowText(d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .style('opacity', '1')
  u.select(`#${HTML.ids.returnTextLabel}`)
    .filter(d => d.wasHidden!! && !d.isHidden)
    .attr('x', d => getXForArrowText(d, lifeLines))
    .attr('y', d => getYForArrow(LAYOUT.arrowText.return.yOffset, activeTimeIndices, d, hiddenLifeLines, arrows, boxes))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      d.wasHidden = false
      return '1'
    })
}

// updates lifelines
export function updateLifeLines (
  u: Selection<BaseType, LifeLine, BaseType, unknown>,
  activeTimeIndices: number[],
  boxes: Box[],
  lifeLines: LifeLine[],
  timeIdx: number
) {
  u.select(`#${HTML.ids.verticalLine}`)
    .filter(d => wasVisible(d) && isVisible(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForVerticalLine(d, lifeLines))
    .attr('x2', d => getXForVerticalLine(d, lifeLines))
    .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
    .attr('y2', d => {
      if (isMainLifeLine(d) && getFirstBox(boxes, d)!!.currState === 'collapsed') {
        return LAYOUT.line.mainY2
      }
      return getSecondYForVerticalLine(d, activeTimeIndices, boxes, timeIdx)
    })
    .style('opacity', '1')
  u.select(`#${HTML.ids.verticalLine}`)
    .filter(d => !wasVisible(d) && isVisible(d))
    .attr('x1', d => getXForVerticalLine(d, lifeLines))
    .attr('x2', d => getXForVerticalLine(d, lifeLines))
    .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
    .attr('y2', d => {
      if (isMainLifeLine(d) && getFirstBox(boxes, d)!!.currState === 'collapsed') {
        return LAYOUT.line.mainY2
      }
      return getSecondYForVerticalLine(d, activeTimeIndices, boxes, timeIdx)
    })
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.textLabel}`)
    .filter(d => wasVisible(d) && isVisible(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x', d => getXForLabel(d, lifeLines) - 4.5)
    .attr('y', d => getYForVerticalLine(d, activeTimeIndices) - 10)
    .style('opacity', '1')
  u.select(`#${HTML.ids.textLabel}`)
    .filter(d => !wasVisible(d) && isVisible(d))
    .attr('x', d => getXForLabel(d, lifeLines) - 4.5)
    .attr('y', d => getYForVerticalLine(d, activeTimeIndices) - 10)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
  u.select(`#${HTML.ids.horizontalLine}`)
    .filter(d => wasVisible(d) && isVisible(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForHorizontal(d, lifeLines)[0])
    .attr('x2', d => getXForHorizontal(d, lifeLines)[1])
    .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
    .attr('y2', d => getYForVerticalLine(d, activeTimeIndices))
    .style('opacity', '1')
  u.select(`#${HTML.ids.horizontalLine}`)
    .filter(d => !wasVisible(d) && isVisible(d))
    .attr('x1', d => getXForHorizontal(d, lifeLines)[0])
    .attr('x2', d => getXForHorizontal(d, lifeLines)[1])
    .attr('y1', d => getYForVerticalLine(d, activeTimeIndices))
    .attr('y2', d => getYForVerticalLine(d, activeTimeIndices))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', '1')
}

// updates the crosses indicating the end of a lifeline
export function updateCrosses (
  u: Selection<BaseType, LifeLine, BaseType, unknown>,
  activeTimeIndices: number[],
  boxes: Box[],
  lifeLines: LifeLine[],
  timeIdx: number
) {
  u.select(`#${HTML.ids.firstCrossLine}`)
    .filter(d => wasVisible(d) && isVisible(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForCross(d, lifeLines)[0])
    .attr('x2', d => getXForCross(d, lifeLines)[1])
    .attr('y1', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, boxes).y1)
    .attr('y2', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, boxes).y2)
    .style('opacity', d => getCrossOpacity(d, timeIdx))
  u.select(`#${HTML.ids.firstCrossLine}`)
    .filter(d => !wasVisible(d) && isVisible(d))
    .attr('x1', d => getXForCross(d, lifeLines)[0])
    .attr('x2', d => getXForCross(d, lifeLines)[1])
    .attr('y1', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, boxes).y1)
    .attr('y2', d => getYCoordsForCross(d, HTML.ids.firstCrossLine, timeIdx, activeTimeIndices, boxes).y2)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => getCrossOpacity(d, timeIdx))
  u.select(`#${HTML.ids.secondCrossLine}`)
    .filter(d => wasVisible(d) && isVisible(d))
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .attr('x1', d => getXForCross(d, lifeLines)[0])
    .attr('x2', d => getXForCross(d, lifeLines)[1])
    .attr('y1', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, boxes).y1)
    .attr('y2', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, boxes).y2)
    .style('opacity', d => getCrossOpacity(d, timeIdx))
  u.select(`#${HTML.ids.secondCrossLine}`)
    .filter(d => !wasVisible(d) && isVisible(d))
    .attr('x1', d => getXForCross(d, lifeLines)[0])
    .attr('x2', d => getXForCross(d, lifeLines)[1])
    .attr('y1', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, boxes).y1)
    .attr('y2', d => getYCoordsForCross(d, HTML.ids.secondCrossLine, timeIdx, activeTimeIndices, boxes).y2)
    .transition()
    .duration(DURATION)
    .ease(easeCubic)
    .style('opacity', d => {
      d.prevState = d.currState
      d.wasDrawn = d.isDrawn
      return getCrossOpacity(d, timeIdx)
    })
}
