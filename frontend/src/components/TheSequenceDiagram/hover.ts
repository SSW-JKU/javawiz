import { HoverInfo } from '@/hover/types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { Arrow, Box, LifeLine } from '@/components/TheSequenceDiagram/types'
import {createHoverBox, createHoverClass, createHoverHeapObject, createHoverMethod, createHoverMethodCall} from '@/hover/hoverinfo-builder'
import { getBoxByIndex } from '@/components/TheSequenceDiagram/data-utils'
import { getReferencesOfHoveredHeapItem } from '@/components/TheHeapVisualization/hover'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/types'

export function isHighlightedArrow (hoveredInfos: HoverInfo[], arrow: Arrow, boxes: Box[]): boolean {
  return hoveredInfos.some(info => {
    if (arrow.kind === 'Return') {
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].returnArrow && boxes[i].returnArrow === arrow
            && info.kind === 'MethodCall'
            && info.methodCallId === boxes[i].methodCallId
            && boxes[i].callArrow && boxes[i].callArrow?.time
            && boxes[i].callArrow?.time === info.time) {
          return true
        }
      }
      return info.kind === 'MethodCall' && info.methodCallId === arrow.methodCallId && arrow.time && arrow.time === info.time
    } else {
      return info.kind === 'MethodCall' && info.methodCallId === arrow.methodCallId && arrow.time && arrow.time === info.time
    }
  })
}

export function isHighlightedBox (hoveredInfos: HoverInfo[], box: Box): boolean {
  return hoveredInfos.some(info => {
    return (info.kind === 'Box' && info.index === box.index) || (info.kind === 'MethodCall' && info.methodCallId === box.methodCallId && info.time === box.start)
  })
}

export function isHighlightedRefArrow (hoveredInfos: HoverInfo[], arrow: Arrow, arrows: Arrow[], boxes: Box[], timeIdx: number): boolean {
  if (arrow.time === undefined) {
    return false
  }
  for (const info of hoveredInfos) {
    if (info.kind === 'MethodCall' && info.methodCallId !== arrow.methodCallId) {
      for (const a of arrows) {
        if (a.kind === 'Return' && a.methodCallId === info.methodCallId) {
          const end = a.time
          const box = boxes.find(b => b.methodCallId === info.methodCallId)
          if (end && arrow.time > info.time && arrow.time <= end && arrow.kind !== 'Return' && box && arrow.fromBoxIndex === box.index) {
            return true
          }
        }
      }
    } else if (info.kind === 'Box') {
      const box = getBoxByIndex(info.index, boxes)
      if (box) {
        const end = box.end ?? timeIdx
        if (arrow.fromBoxIndex === box.index) {
          if (arrow.kind === 'Constructor') {
            return arrow.time >= box.start && arrow.time <= end
          } else if (arrow.kind !== 'Return') {
            return arrow.time > box.start && arrow.time < end
          }
          return false
        }
      }
    }
  }
  return false
}

export function isHighlightedLifeLine (hoveredInfos: HoverInfo[], arrows: Arrow[], lifeLine: LifeLine): boolean {
  for (const info of hoveredInfos) {
    if ((info.kind === 'MethodCall' && info.time === lifeLine.start - 1 && arrows.some(a => a.kind === 'Constructor' && a.to === lifeLine)) ||
        ((info.kind === 'HeapObject' && lifeLine.heapId && info.objId === lifeLine.heapId) ||
            (info.kind === 'Class' && lifeLine.heapId === undefined && info.class === lifeLine.className)) ||
        (info.kind === 'Local' && info.name === lifeLine.label && info.reference === lifeLine.heapId)) {
      return true
    }
  }
  return false
}

export function getArrowHoverInfo (arrow: Arrow, state: HeapVizTraceState) {
  const hoverInfos: HoverInfo[] = []
  if (arrow.methodCallId !== -1 && arrow.time) {
    if (arrow.kind === 'Constructor' && arrow.to && arrow.to.heapId) {
      const hoverHeapObject = createHoverHeapObject(arrow.to.heapId)
      if (!hoverInfos.includes(hoverHeapObject)) hoverInfos.push(hoverHeapObject)
      const addHoverInfos = getReferencesOfHoveredHeapItem(arrow.to.heapId, state)
      for (const info of addHoverInfos) {
        if (!hoverInfos.includes(info)) hoverInfos.push(info)
      }
    }
    hoverInfos.push(createHoverMethodCall(arrow.label, arrow.methodCallId, arrow.time))
  }
  if ((arrow.reference || arrow.this) && arrow.to) {
    const addHoverInfos = getLifeLineHoverInfo(arrow.to.className, arrow.to.heapId, state)
    for (const info of addHoverInfos) {
      if (!hoverInfos.includes(info)) hoverInfos.push(info)
    }
  }
  return hoverInfos
}

export function getBoxHoverInfo (index: number, time: number, clazz: string, callArrow: Arrow | undefined, heapId: number | undefined, state: HeapVizTraceState) {
  const hoverInfos: HoverInfo[] = []
  hoverInfos.push(createHoverBox(index, time))
  getLifeLineHoverInfo(clazz, heapId, state).forEach(i => hoverInfos.push(i))
  if (callArrow) hoverInfos.push(createHoverMethod(clazz, callArrow.label.substring(callArrow.label.indexOf(' ') + 1, callArrow.label.indexOf('(') - 1)))
  return hoverInfos
}

export function getLifeLineHoverInfo (className: string, heapId: number | undefined, state: HeapVizTraceState) {
  const hoverInfos: HoverInfo[] = []
  if (heapId) {
    const hoverHeapObject = createHoverHeapObject(heapId)
    if (!hoverInfos.includes(hoverHeapObject)) hoverInfos.push(createHoverHeapObject(heapId))
    const addHoverInfos = getReferencesOfHoveredHeapItem(heapId, state)
    for (const info of addHoverInfos) {
      if (!hoverInfos.includes(info)) hoverInfos.push(info)
    }
  } else {
    const hoverClass = createHoverClass(className)
    if (!hoverInfos.includes(hoverClass)) hoverInfos.push(createHoverClass(className))
  }
  return hoverInfos
}

export function onHover (hoverInfos: HoverInfo[]) {
  HoverSynchronizer.hover(hoverInfos)
}