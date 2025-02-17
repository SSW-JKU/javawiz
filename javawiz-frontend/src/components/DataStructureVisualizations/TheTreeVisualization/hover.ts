import { HeapObject } from '@/dto/TraceState'
import { HoverInfo, HoverHeapObject, HoverField } from '@/hover/types'
import { TreeNode, TreeNodePointer, ChildPointer } from './types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { createHoverField, createHoverHeapObject } from '@/hover/hoverinfo-builder'

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

export function isHighlighted (hoveredInfos: HoverInfo[], nodeOrPointer: TreeNode | TreeNodePointer, fieldIndex: number = -1): boolean {
  if (nodeOrPointer === undefined || nodeOrPointer.node === undefined) return false
  for (const hInfo of hoveredInfos) {
    if (hInfo.kind !== 'Field' && hInfo.kind !== 'Local' && hInfo.kind !== 'Static') {
      continue
    }
    if ('methodOrParentId' in nodeOrPointer) {
      const pointerNode = nodeOrPointer.node.node?.element as HeapObject

      if (pointerNode.id === hInfo.reference && nodeOrPointer.name === hInfo.name) {
        if (hInfo.kind === 'Local') {
          return nodeOrPointer.methodOrParentId.startsWith(hInfo.method)
        }
        return true
      }
    } else if (hInfo.kind === 'Field') { // check if the next field of a list node is highlighted
      const currNode = (nodeOrPointer.node as any).element
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

export function isHighlightedRef (hoveredRefs: HoverHeapObject[], node: TreeNode): boolean {
  for (const hInfo of hoveredRefs) {
    const currNode = (node.node as any).element as HeapObject
    if (currNode.id === hInfo.objId) {
      return true
    }
  }
  return false
}

export function isHighlightedChildPointer (hoveredInfos: HoverInfo[], pointer: ChildPointer): boolean {
  if (pointer.child.leftFieldIndex === -1 || pointer.child.rightFieldIndex === -1) return false
  const fromNode = (pointer.parent.node?.element as HeapObject)
  const toNode = (pointer.child.node?.element as HeapObject)

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
