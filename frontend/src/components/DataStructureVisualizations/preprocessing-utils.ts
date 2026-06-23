import { HeapTreeNode } from './heapBFS'
import { HeapObject, Var } from '@/dto/TraceState'

/**
 * returns array of nodes in heapNodes having the given type
 * @param heapNodes nodes to filter
 * @param type type of the returned nodes
 */
export function getNodesOfType (heapNodes: HeapTreeNode[], type: string) {
  return heapNodes.filter(heapNode => heapNode.element?.kind === 'HeapObject' && heapNode.element.type === type).sort((a, b) =>
    (a.element as HeapObject).id - (b.element as HeapObject).id)
}

/**
 * return array with heapNodes containing variables pointing to a node
 * @param heapTree heapNodes to filter
 * @param nodeClassName class name of nodes
 */
export function getVariablePointers (heapTree: HeapTreeNode, nodeClassName: string) {
  return heapTree
    .children
    .filter(child =>
      (child.element as Var).type === nodeClassName
    )
}
