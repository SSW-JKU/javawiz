import { Arrow, Box, Elements, LifeLine } from '@/components/TheSequenceDiagram/types'

// returns the direction of an arrow depending on the indices of the lifelines
export function getArrowDirection (from: LifeLine, to: LifeLine): 'Right' | 'Left' | 'Neither' {
  if (from.index === to.index) {
    return 'Neither'
  } else if (from.index < to.index) {
    return 'Right'
  }
  return 'Left'
}

// hides certain boxes after step over of a box
export function setHiddenBoxesAfterStepOver (
  boxes: Box[],
  box: Box,
  timeIdx: number,
  hiddenIntervals: Box[],
  activeTimeIndices: number[]
) {
  if (!hiddenIntervals.includes(box)) return
  updateElementState(box, 'collapsed')
  updateDrawnState(box, activeTimeIndices.includes(box.start))
  for (let i = 0; i < boxes.length; i++) {
    const inner = boxes[i]
    if (isWithinScope(inner, box, timeIdx)) {
      updateElementState(inner, 'hidden')
    }
  }
}

// returns the ending time index of a box
export function getBoxEnd (box: Box, timeIdx: number) {
  return box.end ? Math.min(timeIdx, box.end) : timeIdx
}

// returns the last time index
export function getLastTimeIdx (boxes: Box[]) {
  let timeIdx = 0
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    timeIdx = Math.max(timeIdx, box.start, box.end ?? 0)
  }
  return timeIdx
}

function updateElementState (element: Box | LifeLine, newState: 'hidden' | 'expanded' | 'collapsed') {
  if (element.currState !== newState) {
    element.prevState = element.currState
  }
  element.currState = newState
}

function updateDrawnState (element: Box | LifeLine, newState: boolean) {
  if (element.isDrawn !== newState) {
    element.wasDrawn = element.isDrawn
  }
  element.isDrawn = newState
}

function updateHiddenState (element: Arrow, newState: boolean) {
  if (element.isHidden !== newState) {
    element.wasHidden = element.isHidden
  }
  element.isHidden = newState
}

function isArrowWithinLifeLineScope (arrow: Arrow, l: LifeLine, timeIdx: number) {
  const lineEnd = l.end ?? timeIdx
  return arrow.time && arrow.time >= l.start && arrow.time <= lineEnd
}

function isLifeLineWithinLifeLineScope (elem: LifeLine, l: LifeLine, timeIdx: number) {
  const lineEnd = l.end ?? timeIdx
  const elemEnd = elem.end ?? timeIdx
  return elem.start >= l.start && elem.start <= lineEnd && elemEnd >= l.start && elemEnd <= lineEnd
}

function isBoxWithinLifeLineScope (box: Box, l: LifeLine, timeIdx: number) {
  const boxEnd = getBoxEnd(box, timeIdx)
  const lineEnd = l.end ?? timeIdx
  return box.start >= l.start && box.start <= lineEnd && boxEnd >= l.start && boxEnd <= lineEnd
}

// checks whether a box is defined inside the scope of another box
function isWithinScope (firstBox: Box, secondBox: Box, timeIdx: number) {
  const secondBoxEnd = getBoxEnd(secondBox, timeIdx)
  const firstBoxEnd = getBoxEnd(firstBox, timeIdx)
  return firstBox !== secondBox && firstBox.start >= secondBox.start && firstBox.start <= secondBoxEnd && firstBoxEnd >= secondBox.start && firstBoxEnd <= secondBoxEnd
}

export function toggleLifeLine (
  { arrows, boxes, lifeLines }: Elements,
  l: LifeLine,
  timeIdx: number,
  hiddenIntervals: Box[],
  hiddenLifeLines: LifeLine[]
) {
  if (hiddenLifeLines.includes(l)) {
    hiddenLifeLines.splice(hiddenLifeLines.indexOf(l), 1)
  } else if (l.start === 1 || ((l.end ?? timeIdx) - l.start > 1)) {
    hiddenLifeLines.push(l)
  }

  const activeTimeIndices = getActiveTimeIndices(hiddenLifeLines, hiddenIntervals, timeIdx, { arrows, boxes, lifeLines })
  for (const arrow of arrows) {
    if (!isArrowWithinLifeLineScope(arrow, l, timeIdx) && arrow.time !== l.start + 1) {
      continue
    }
    let found = false
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      if (!box.callArrow && box.lifeLine === l && box.end && arrow.time === box.end + 1) {
        found = true
        break
      }
    }
    const isVisible = arrow.time !== timeIdx && arrow.from !== l && arrow.to !== l
    if (!found && isVisible) {
      const newHiddenState = hiddenLifeLines.includes(l) || activeTimeIndices.includes(arrow.time!)
      updateHiddenState(arrow, newHiddenState)
    }
  }
  if (!hiddenLifeLines.includes(l)) {
    toggleNonHiddenLifeLine({ arrows, boxes, lifeLines }, l, timeIdx, hiddenIntervals, hiddenLifeLines, activeTimeIndices)
    return
  }
  updateElementState(l, 'collapsed')
  l.wasDrawn = wasVisible(l)
  l.isDrawn = true
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    if (isBoxWithinLifeLineScope(box, l, timeIdx)) {
      hideElement(box)
    }
  }
  for (let i = 0; i < lifeLines.length; i++) {
    if (isLifeLineWithinLifeLineScope(lifeLines[i], l, timeIdx) && lifeLines[i] !== l) {
      hideElement(lifeLines[i])
    }
  }
}

function toggleNonHiddenLifeLine ({ boxes, lifeLines }: Elements,
  l: LifeLine,
  timeIdx: number,
  hiddenIntervals: Box[],
  hiddenLifeLines: LifeLine[],
  activeTimeIndices: number[]) {
  updateElementState(l, 'expanded')
  l.wasDrawn = true
  l.isDrawn = true
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    if (!isBoxWithinLifeLineScope(box, l, timeIdx)) {
      continue
    }
    const startActive = activeTimeIndices.includes(box.start)
    if (box.currState === 'collapsed') {
      updateDrawnState(box, startActive)
    } else {
      updateElementState(box, startActive ? 'expanded' : 'hidden')
      for (let j = 0; j < hiddenIntervals.length; j++) {
        if (isWithinScope(box, hiddenIntervals[j], timeIdx)) {
          box.currState = 'hidden'
        }
      }
    }
  }
  for (let i = 0; i < lifeLines.length; i++) {
    const inner = lifeLines[i]
    if (!isLifeLineWithinLifeLineScope(inner, l, timeIdx) || inner === l) {
      continue
    }
    const startActive = activeTimeIndices.includes(inner.start)
    if (inner.currState === 'collapsed') {
      updateDrawnState(inner, startActive)
    } else {
      updateElementState(inner, startActive ? 'expanded' : 'hidden')
      for (let j = 0; j < hiddenLifeLines.length; j++) {
        if (isLifeLineWithinLifeLineScope(inner, hiddenLifeLines[j], timeIdx)) {
          inner.currState = 'hidden'
        }
      }
    }
  }
}

function hideElement (element: Box | LifeLine) {
  if (element.currState === 'collapsed') {
    updateDrawnState(element, false)
  } else {
    updateElementState(element, 'hidden')
  }
}
// sets the hidden flags of the boxes
export function setHiddenBoxes (boxes: Box[], box: Box, timeIdx: number, hiddenIntervals: Box[], activeTimeIndices: number[]) {
  if (hiddenIntervals.includes(box)) {
    updateElementState(box, 'collapsed')
    updateDrawnState(box, true)
    for (let i = 0; i < boxes.length; i++) {
      if (isWithinScope(boxes[i], box, timeIdx)) {
        hideElement(boxes[i])
      }
    }
    return
  }

  updateElementState(box, 'expanded')
  for (let i = 0; i < boxes.length; i++) {
    const inner = boxes[i]
    if (!isWithinScope(inner, box, timeIdx)) {
      continue
    }

    if (inner.currState === 'collapsed') {
      if (!inner.callArrow) {
        updateDrawnState(inner, activeTimeIndices.includes(inner.start))
      } else {
        const fromBox = getBoxByIndex(inner.callArrow.fromBoxIndex!, boxes)!
        if (fromBox.currState === 'expanded') {
          updateDrawnState(inner, true)
        }
      }
    } else {
      updateElementState(inner, 'expanded')
      for (let j = 0; j < hiddenIntervals.length; j++) {
        if (isWithinScope(inner, hiddenIntervals[j], timeIdx)) {
          inner.currState = 'hidden'
        }
      }
    }
  }
}

// sets the hidden flags of the arrows
export function setHiddenArrows ({ boxes, arrows, lifeLines }: Elements, activeTimeIndices: number[], hiddenLifeLines: LifeLine[], timeIdx: number) {
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const callArrow = box.callArrow
    if (!callArrow || callArrow.kind === 'CallMain') {
      continue
    }
    const hidden = isHidden(box)
    updateHiddenState(callArrow, hidden || !activeTimeIndices.includes(callArrow.time!))
    const returnArrow = box.returnArrow
    if (returnArrow) {
      updateHiddenState(returnArrow, hidden || !activeTimeIndices.includes(returnArrow.time!))
    }
  }
  for (let i = 0; i < arrows.length; i++) {
    const arrow = arrows[i]
    if (arrow.kind !== 'Constructor') {
      continue
    }
    const boxState = getBoxByIndex(arrow.fromBoxIndex!, boxes)?.currState
    if (boxState === 'hidden' || boxState === 'collapsed' || !activeTimeIndices.includes(arrow.time!)) {
      updateHiddenState(arrow, true)
    } else {
      let found = false
      for (let j = 0; j < lifeLines.length; j++) {
        const lifeLine = lifeLines[j]
        const isWithinScope = hiddenLifeLines.some(hidden => isLifeLineWithinLifeLineScope(lifeLine, hidden, timeIdx))
        if (lifeLine.start === arrow.time! && lifeLine.currState !== 'expanded' && arrow.to !== lifeLine && isWithinScope) {
          found = true
          break
        }
      }
      updateHiddenState(arrow, found)
    }
  }
}

// sets the hidden flags of the lifelines
export function setHiddenLifeLines ({ boxes, arrows, lifeLines }: Elements, activeTimeIndices: number[], hiddenLifeLines: LifeLine[]) {
  for (let i = 0; i < lifeLines.length; i++) {
    const lifeLine = lifeLines[i]
    const nVisibleBoxes = getVisibleBoxesForLifeLine(lifeLine, boxes).length
    if (!activeTimeIndices.includes(lifeLine.start)) {
      hideElement(lifeLine)
      continue
    }

    const arrow = arrows.find(a => a.kind === 'Constructor' && a.to === lifeLine)

    const arrowHidden = arrow && arrow.isHidden
    updateDrawnState(lifeLine, !arrowHidden)
    if (nVisibleBoxes === 0) {
      if (arrow) {
        if (arrow.isHidden) {
          if (lifeLine.currState === 'collapsed') {
            updateElementState(lifeLine, 'collapsed')
          } else {
            updateElementState(lifeLine, 'hidden')
          }
        } else if (hiddenLifeLines.includes(lifeLine)) {
          updateElementState(lifeLine, 'collapsed')
        } else {
          updateElementState(lifeLine, 'expanded')
        }
      } else if (lifeLine.index !== 0) {
        updateElementState(lifeLine, 'hidden')
      }
    } else if (nVisibleBoxes !== 0) {
      if (lifeLine.currState === 'collapsed') {
        updateElementState(lifeLine, 'collapsed')
      } else if (arrowHidden) {
        updateElementState(lifeLine, 'hidden')
      } else {
        updateElementState(lifeLine, 'expanded')
      }
    } else if (!isMainLifeLine(lifeLine) || lifeLine.currState !== 'collapsed') {
      updateElementState(lifeLine, 'expanded')
    }
  }
}

export function getBoxesForLifeLine (lifeLine: LifeLine | null, boxes: Box[]) { // TODO: consider storing boxes within lifeline object
  if (lifeLine === null) {
    return []
  }
  return boxes.filter(box => box.lifeLine === lifeLine)
}

export function getVisibleBoxesForLifeLine (lifeLine: LifeLine, boxes: Box[]) {
  return boxes.filter(box => box.lifeLine === lifeLine && isVisible(box))
}

// returns the index of a lifeline without considering hidden lifelines in between
export function getOrderIndex (lifeLine: LifeLine, lifeLines: LifeLine[]) {
  let index = lifeLine.index
  for (let i = 0; i < lifeLines.length; i++) {
    if (isHidden(lifeLines[i]) && lifeLines[i].index < lifeLine.index) {
      index--
    }
  }
  return index
}

// checks whether an element is visible or not
export function isVisible (elem: LifeLine | Box) {
  return elem.currState === 'expanded' || isCollapsedAndDrawn(elem)
}

// checks whether an element is visible or not
export function wasVisible (elem: LifeLine | Box) {
  return elem.prevState === 'expanded' || wasCollapsedAndDrawn(elem)
}

export function isHidden (elem: LifeLine | Box) {
  return elem.currState === 'hidden' || (elem.currState === 'collapsed' && !elem.isDrawn)
}

export function isCollapsedAndDrawn (d: Box | LifeLine) {
  return d.currState === 'collapsed' && d.isDrawn
}

function wasCollapsedAndDrawn (elem: LifeLine | Box) {
  return elem.prevState === 'collapsed' && elem.wasDrawn
}

// checks whether a box must be updated with no transition
export function isChangedWithNoTransition (d: Box) {
  return isCollapsedAndDrawn(d) && ((d.prevState === 'collapsed' && !d.wasDrawn) || d.prevState === 'expanded')
}

// checks whether a box must be updated with transition
export function isChangedWithTransition (d: Box) {
  return isCollapsedAndDrawn(d) && wasCollapsedAndDrawn(d)
}

export function getBoxByIndex (index: number, boxes: Box[]) {
  return boxes.find(box => box.index === index)
}

// updates the active time indices depending on changes of the hidden intervals
export function getActiveTimeIndices (hiddenLifeLines: LifeLine[], hiddenIntervals: Box[], timeIdx: number, { boxes, arrows, lifeLines }: Elements) {
  const result = [0]
  const hiddenIndices: (number | undefined)[] = []
  for (let i = 1; i <= timeIdx; i++) {
    for (let j = 0; j < hiddenLifeLines.length; j++) {
      const start = hiddenLifeLines[j].start
      const end = hiddenLifeLines[j].end ?? timeIdx
      if (start < i && i < end) {
        hiddenIndices.push(i)
      }
    }
  }
  for (let i = 1; i < timeIdx; i++) {
    for (let j = 0; j < hiddenIntervals.length; j++) {
      const start = hiddenIntervals[j].start
      const end = getBoxEnd(hiddenIntervals[j], timeIdx)
      if (start < i && i < end) {
        pushUnlessIncluded(hiddenIndices, i)
      }
    }
  }
  for (let i = 1; i <= timeIdx; i++) {
    if (!hiddenIndices.includes(i)) {
      result.push(i)
    }
  }
  for (let i = 0; i < hiddenIntervals.length; i++) {
    const interval = hiddenIntervals[i]
    const isInsideScope = hiddenLifeLines.some(hiddenLifeLine => isBoxWithinLifeLineScope(interval, hiddenLifeLine, timeIdx))
    const start = interval.start
    if (!hiddenIndices.includes(start) && isVisible(interval.lifeLine) && !isInsideScope) {
      pushUnlessIncluded(result, start)
    }
  }
  for (let i = 0; i < hiddenLifeLines.length; i++) {
    const hiddenLifeLine = hiddenLifeLines[i]
    const end = hiddenLifeLine.end
    if (end && !hiddenIndices.includes(end) && hiddenLifeLine.programEnd) {
      pushUnlessIncluded(result, end)
    }
    if (!hiddenIndices.includes(timeIdx) && isMainLifeLine(hiddenLifeLine) && hiddenLifeLine.programEnd === undefined) {
      pushUnlessIncluded(result, timeIdx)
    }
  }
  for (let i = 0; i < hiddenLifeLines.length; i++) {
    for (let j = 0; j < arrows.length; j++) {
      const arrow = arrows[j]
      if (arrow.kind === 'Constructor' && arrow.to === hiddenLifeLines[i]) {
        const box = getBoxByIndex(arrow.fromBoxIndex!, boxes)
        if (box) {
          const end = getBoxEnd(box, timeIdx)
          if (!hiddenIndices.includes(end) && isVisible(box)) {
            pushUnlessIncluded(result, end)
          }
        }
      }
    }
  }
  for (let i = 0; i < lifeLines.length; i++) {
    const lifeLine = lifeLines[i]
    if (lifeLine.currState === 'collapsed' && lifeLine.isDrawn && lifeLine.end) {
      pushUnlessIncluded(result, lifeLine.end)
    }
  }
  sort(result)
  return result
}

export function updateHiddenLabelsForBoxes (boxes: Box[], activeTimeIndices: number[], hiddenLifeLines: LifeLine[], timeIdx: number) {
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i]
    const lifeLine = box.lifeLine
    if (!isVisible(lifeLine)) {
      hideElement(box)
    } else if (!activeTimeIndices.includes(box.start)) {
      if (box.currState === 'expanded') {
        updateElementState(box, 'hidden')
      } else {
        hideElement(box)
      }
    } else if (!isMainBox(box) && box.callArrow !== undefined) {
      if (!wasVisible(lifeLine) && isVisible(lifeLine)) {
        if (box.currState === 'collapsed') {
          updateDrawnState(box, true)
        } else {
          updateElementState(box, 'expanded')
        }
      } else if (box.currState === 'collapsed') {
        updateDrawnState(box, true)
      } else if (box.currState === 'hidden') {
        const fromBoxIndex = box.callArrow!.fromBoxIndex!
        const currState = getBoxByIndex(fromBoxIndex, boxes)!.currState
        if (box.start === timeIdx && fromBoxIndex !== 0 && (currState === 'collapsed' || currState === 'hidden')) {
          box.currState = 'hidden'
        } else {
          updateElementState(box, 'expanded')
        }
      }
      if (hiddenLifeLines.length > 0 && timeIdx === box.start) {
        hideElement(box)
      }
    }
  }
}

export function sort (numbers: number[]) {
  numbers.sort((a, b) => a - b)
}

export function pushUnlessIncluded<A> (array: A[], elem: A) {
  if (!array.includes(elem)) {
    array.push(elem)
  }
}

export function getLifeLineClassWithoutPackageAndOuterClass (label: string) {
  let idx = -1
  if (label.includes('$')) {
    idx = label.lastIndexOf('$')
  } else if (label.lastIndexOf('.')) {
    idx = label.lastIndexOf('.')
  }
  return label.substring(idx + 1, label.length)
}

export function isMainBox (box: Box) {
  return box.index === 0
}

export function isMainLifeLine (lifeLine: LifeLine) {
  return lifeLine.index === 0
}
