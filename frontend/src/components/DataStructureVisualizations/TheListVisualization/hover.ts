import { HeapObject } from '@/dto/TraceState'
import { HoverInfo } from '@/hover/types'
import { ListNodeBox, VariableToListNodePointer, ValueObjectBox, NextFieldPointer } from './types'
import { createHoverField, createHoverHeapObject } from '@/hover/hoverinfo-builder'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { isSameRootVariable } from '../pointer-hover'

/** Tells a variable pointer apart from a list node box; both are passed to `isHighlighted`. */
function isVariableToListNodePointer (listNodeBoxOrPointer: ListNodeBox | VariableToListNodePointer): listNodeBoxOrPointer is VariableToListNodePointer {
  return 'sourceVariableIdentifier' in listNodeBoxOrPointer
}

export function isHighlighted (hoveredInfos: HoverInfo[], listNodeBoxOrPointer: ListNodeBox | VariableToListNodePointer, fieldIndex: number = -1): boolean {
  if (listNodeBoxOrPointer === undefined) return false
  // a null pointer has no target, and a list node box without graph node shows nothing to highlight
  if (isVariableToListNodePointer(listNodeBoxOrPointer)
    ? listNodeBoxOrPointer.targetListNodeBox === undefined
    : listNodeBoxOrPointer.dataStructureGraphNode === undefined) return false
  let isListNodeBoxOrPointerHighlighted = false

  for (const hInfo of hoveredInfos) {
    if (hInfo.kind === 'Field' || hInfo.kind === 'Local' || hInfo.kind === 'Static') {
      // check if a pointer is highlighted
      if (isVariableToListNodePointer(listNodeBoxOrPointer)) {
        const pointerNode = listNodeBoxOrPointer.targetListNodeBox?.dataStructureGraphNode?.traceElement as HeapObject

        isListNodeBoxOrPointerHighlighted = pointerNode.id === hInfo.reference && listNodeBoxOrPointer.name === hInfo.name &&
          isSameRootVariable(listNodeBoxOrPointer.sourceDataStructureGraphNode, hInfo)

        if (isListNodeBoxOrPointerHighlighted) return true
      } else if (hInfo.kind === 'Field') { // check if the next field of a list node is highlighted
        const currNode = listNodeBoxOrPointer.dataStructureGraphNode!.traceElement as HeapObject
        if (fieldIndex !== -1) {
          const nodeField = currNode.fields[fieldIndex]
          if (currNode.id === hInfo.objId && nodeField.name === hInfo.name) return true
        } else {
          for (const field of currNode.fields) {
            if (field.heapObjectId === hInfo.objId && field.name === hInfo.name) return true
          }
        }
      }
    }
  }
  return isListNodeBoxOrPointerHighlighted
}

export function isHighlightedRef (hoveredRefs: HoverInfo[], box: ListNodeBox | ValueObjectBox): boolean {
  for (const hInfo of hoveredRefs) {
    if (hInfo.kind !== 'HeapObject') continue
    const currNode = ('ownerListNodeBox' in box ? box.dataStructureGraphNode.traceElement : box.dataStructureGraphNode!.traceElement) as HeapObject
    if (currNode.id === hInfo.objId) {
      return true
    }
  }
  return false
}

export function isHighlightedNextFieldPointer (hoveredInfos: HoverInfo[], pointer: NextFieldPointer): boolean {
  if (pointer.targetListNodeBox.nextFieldPosition === -1) return false
  const fromNode = (pointer.sourceListNodeBox.dataStructureGraphNode?.traceElement as HeapObject)
  const toNode = (pointer.targetListNodeBox.dataStructureGraphNode?.traceElement as HeapObject)

  for (const hInfo of hoveredInfos) {
    if (hInfo.kind !== 'Field') continue
    if (fromNode.id === hInfo.objId) {
      return hoveredInfos.some(hInfo => hInfo.kind === 'HeapObject' && toNode.id === hInfo.objId)
    }
  }
  return false
}

export function isHighlightedNodeRefField (hoveredInfos: HoverInfo[], objId: number, fieldName: string) {
  return hoveredInfos.some(info =>
    info.kind === 'Field' &&
      info.objId === objId &&
      info.name === fieldName)
}

export function getListNodeHoverInfo (node: HeapObject, name: string = ''): HoverInfo[] {
  const hoverInfos: HoverInfo[] = []
  if (!node) {
    return []
  }

  if (name.length > 0) {
    const currField = node.fields.find(field => field.name === name)!
    const reference = 'reference' in currField.value ? currField.value.reference : -1
    hoverInfos.push(createHoverField(node.id, currField.name, reference))

    if (reference !== -1) {
      hoverInfos.push(createHoverHeapObject(reference))
    }
  } else {
    hoverInfos.push(createHoverHeapObject(node.id))
  }
  return hoverInfos
}

export function onHover (hoverInfos: HoverInfo[]) {
  HoverSynchronizer.hover(hoverInfos)
}
