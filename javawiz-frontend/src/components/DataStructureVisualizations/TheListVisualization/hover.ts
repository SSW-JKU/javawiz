import { HeapObject } from '@/dto/TraceState'
import { HoverInfo } from '@/hover/types'
import { ListNode, ListNodePointer, ReferenceNode, NextPointer } from './types'
import { createHoverField, createHoverHeapObject } from '@/hover/hoverinfo-builder'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'

export function isHighlighted (hoveredInfos: HoverInfo[], nodeOrPointer: ListNode | ListNodePointer, fieldIndex: number = -1): boolean {
  if (nodeOrPointer === undefined || nodeOrPointer.node === undefined) return false
  let nodeOrPointerIsHighlighted = false

  for (const hInfo of hoveredInfos) {
    if (hInfo.kind === 'Field' || hInfo.kind === 'Local' || hInfo.kind === 'Static') {
      // check if a pointer is highlighted
      if ('isListPointer' in nodeOrPointer) {
        const pointerNode = (nodeOrPointer as ListNodePointer).node?.node?.element as HeapObject

        nodeOrPointerIsHighlighted = pointerNode.id === hInfo.reference && nodeOrPointer.name === hInfo.name
        if (hInfo.kind === 'Local') {
          nodeOrPointerIsHighlighted &&= nodeOrPointer.methodOrParentId.startsWith(hInfo.method)
        }

        if (nodeOrPointerIsHighlighted) return true
      } else if (hInfo.kind === 'Field') { // check if the next field of a list node is highlighted
        const currNode = (nodeOrPointer.node as any).element as HeapObject
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
  return nodeOrPointerIsHighlighted
}

export function isHighlightedRef (hoveredRefs: HoverInfo[], node: ListNode | ReferenceNode): boolean {
  for (const hInfo of hoveredRefs) {
    if (hInfo.kind !== 'HeapObject') continue
    const currNode = ('reference' in node ? (node.reference as any).element : (node.node as any).element) as HeapObject
    if (currNode.id === hInfo.objId) {
      return true
    }
  }
  return false
}

export function isHighlightedNextPointer (hoveredInfos: HoverInfo[], pointer: NextPointer): boolean {
  if (pointer.to.nextFieldIndex === -1) return false
  const fromNode = (pointer.from.node?.element as HeapObject)
  const toNode = (pointer.to.node?.element as HeapObject)

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
    const currField = node.fields.find(field => field.name === name)!!
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
