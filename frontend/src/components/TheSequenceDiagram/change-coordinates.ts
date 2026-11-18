import { Arrow, Box, Elements, LifeLine } from '@/components/TheSequenceDiagram/types'
import { getBoxEnd, getOrderIndex, isHidden } from '@/components/TheSequenceDiagram/data-utils'

/**
 * Get the coordinates used for the zoom
 * @param arrow changed arrow that should be zoomed
 * @param activeTimeIndices all currently active time indices
 */
export function getArrowCoordinates (arrow: Arrow, activeTimeIndices: number[]): [number, number] {
  return [
    arrow.to!.index * 80 + 30,
    activeTimeIndices.indexOf(arrow.time!) * 15
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
  const lastArrow = arrows.at(-1)!
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
  const lastLifeLine = lifeLines.at(-1)!
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
  const lastBox = boxes.at(-1)!
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
