import { HeapObject } from '@/dto/TraceState'
import { HoverInfo, HoverHeapObject, HoverField } from '@/hover/types'
import { TreeNodeBox, VariableToTreeNodePointer, ChildFieldPointer } from './types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { createHoverField, createHoverHeapObject } from '@/hover/hoverinfo-builder'
import { isSameRootVariable } from '../pointer-hover'

export function getTreeNodeHoverInfo (node: HeapObject, fieldId: number = -1): HoverInfo[] {
  const hoverInfos: HoverInfo[] = []

  if (node) {
    if (fieldId === -1) {
      hoverInfos.push(createHoverHeapObject(node.id))
    } else {
      const currField = fieldId === 0 ? (node as any) : node.fields[fieldId]
      const reference = 'reference' in currField.value ? currField.value.reference : -1
      hoverInfos.push(createHoverField(currField.heapObjectId, currField.name, reference))

      if (reference !== -1) {
        hoverInfos.push(createHoverHeapObject(reference))
      }
    }
  }
  return hoverInfos
}

/** Tells a pointer apart from a tree node box; both are passed to `isHighlighted`. */
function isVariableToTreeNodePointer (treeNodeBoxOrPointer: TreeNodeBox | VariableToTreeNodePointer): treeNodeBoxOrPointer is VariableToTreeNodePointer {
  return 'sourceVariableIdentifier' in treeNodeBoxOrPointer
}

export function isHighlighted (hoveredInfos: HoverInfo[], treeNodeBoxOrPointer: TreeNodeBox | VariableToTreeNodePointer, fieldIndex: number = -1): boolean {
  if (treeNodeBoxOrPointer === undefined) return false
  // a null pointer has no target, and a placeholder box (without graph node) shows nothing to highlight
  if (isVariableToTreeNodePointer(treeNodeBoxOrPointer)
    ? treeNodeBoxOrPointer.targetTreeNodeBox === undefined
    : treeNodeBoxOrPointer.dataStructureGraphNode === undefined) return false
  for (const hInfo of hoveredInfos) {
    if (hInfo.kind !== 'Field' && hInfo.kind !== 'Local' && hInfo.kind !== 'Static') {
      continue
    }
    if (isVariableToTreeNodePointer(treeNodeBoxOrPointer)) {
      const pointerNode = treeNodeBoxOrPointer.targetTreeNodeBox!.dataStructureGraphNode?.traceElement as HeapObject

      if (pointerNode.id === hInfo.reference && treeNodeBoxOrPointer.name === hInfo.name) {
        return isSameRootVariable(treeNodeBoxOrPointer.sourceDataStructureGraphNode, hInfo)
      }
    } else if (hInfo.kind === 'Field') { // check if the next field of a list node is highlighted
      const currNode = (treeNodeBoxOrPointer.dataStructureGraphNode as any).traceElement
      const nodeId = 'id' in currNode ? Number(currNode.id) : Number(currNode.heapObjectId)

      if (fieldIndex !== -1) {
        const nodeField = currNode.fields[fieldIndex]
        if (nodeId === hInfo.objId && nodeField.name === hInfo.name) return true
      } else {
        for (const field of currNode.fields) {
          if (field.heapObjectId === hInfo.objId && field.name === hInfo.name) return true
        }
      }
    }
  }
  return false
}

export function isHighlightedRef (hoveredRefs: HoverHeapObject[], treeNodeBox: TreeNodeBox): boolean {
  for (const hInfo of hoveredRefs) {
    const currNode = (treeNodeBox.dataStructureGraphNode as any).traceElement as HeapObject
    if (currNode.id === hInfo.objId) {
      return true
    }
  }
  return false
}

export function isHighlightedChildFieldPointer (hoveredInfos: HoverInfo[], pointer: ChildFieldPointer): boolean {
  if (pointer.targetTreeNodeBox.leftFieldPosition === -1 || pointer.targetTreeNodeBox.rightFieldPosition === -1) return false
  const fromNode = (pointer.sourceTreeNodeBox.dataStructureGraphNode?.traceElement as HeapObject)
  const toNode = (pointer.targetTreeNodeBox.dataStructureGraphNode?.traceElement as HeapObject)

  const fields = hoveredInfos.filter((i): i is HoverField => i.kind === 'Field')
  for (const hInfo of fields) {
    if (fromNode.id === hInfo.objId) {
      return hoveredInfos.some(hInfo => hInfo.kind === 'HeapObject' && toNode.id === hInfo.objId)
    }
  }
  return false
}

export function onHover (hoverInfos: HoverInfo[]) {
  HoverSynchronizer.hover(hoverInfos)
}
