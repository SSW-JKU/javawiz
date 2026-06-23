import { HeapArrayElementVar, HeapItem, LoadedClass, PrimitiveVal, Recordable, ReferenceVal, StackFrame, Var } from '@/dto/TraceState'

export interface HeapTreeNode {
  element?: Recordable | HeapArrayElementVar,
  children: HeapTreeNode[],
  depth: number,
  name: string,
  parents?: HeapTreeNode[],
  stackFrameDepth?: number,
  className?: string,
  changesInFields?: boolean[]
}

interface HeapBFSUtils {
  root: HeapTreeNode,
  idMap: Map<number, HeapTreeNode>,
  queue: HeapTreeNode[],
  heapNodes: Set<HeapTreeNode>
}

/**
 * generates tree of heapNodes from given stack and heap
 * @param loadedClasses array of loaded classes
 * @param stackFrames stack that should be used
 * @param heap corresponding heap
 * @param onlyCurrentStackFrame true, iff only the last stack frame should be traversed
 */
export function heapBFS (
  loadedClasses: LoadedClass[],
  stackFrames: StackFrame[],
  heap: HeapItem[],
  onlyCurrentStackFrame?: boolean
): { root: HeapTreeNode, heapNodes: HeapTreeNode[] } {
  const heapBFSUtils: HeapBFSUtils = {
    root: { children: [], depth: 0, name: 'root' },
    idMap: new Map(),
    queue: [],
    heapNodes: new Set()
  }
  processStatics(heapBFSUtils, loadedClasses, heap)
  processStack(heapBFSUtils, stackFrames, heap, onlyCurrentStackFrame)
  processHeap(heapBFSUtils, heap)
  return { root: heapBFSUtils.root, heapNodes: [...heapBFSUtils.heapNodes] }
}

function processStatics (
  heapBFSUtils: HeapBFSUtils,
  loadedClasses: LoadedClass[],
  heap: HeapItem[]
) {
  loadedClasses.forEach(loadedClass => {
    loadedClass.staticFields.forEach(variable => {
      processVar(heapBFSUtils, variable, heap, undefined, loadedClass.class)
    })
  })
}

function processStack (
  heapBFSUtils: HeapBFSUtils,
  stackFrames: StackFrame[],
  heap: HeapItem[],
  onlyCurrentStackFrame?: boolean
) {
  for (let i = onlyCurrentStackFrame ? 0 : stackFrames.length - 1; i >= 0; i--) {
    for (let j = 0; j < stackFrames[i].localVariables.length; j++) {
      const variable: Var = stackFrames[i].localVariables[j]
      const stackFrameDepth = stackFrames.length - 1 - i
      // create nodes for stack-variables
      processVar(heapBFSUtils, variable, heap, stackFrameDepth)
    }
  }
}

function processVar (
  heapBFSUtils: HeapBFSUtils,
  variable: Var,
  heap: HeapItem[],
  stackFrameDepth?: number,
  className?: string
) {
  const node = {
    element: variable,
    parents: [heapBFSUtils.root],
    children: [] as HeapTreeNode[],
    depth: 1,
    name: variable.name as string,
    stackFrameDepth,
    className
  }
  heapBFSUtils.root.children.push(node)
  // check if heap-object has to be added
  if (variable.value.kind === 'ReferenceVal') {
    const id = variable.value.reference
    let heapNode = heapBFSUtils.idMap.get(id)
    if (heapNode) {
      // if node was already added to tree, update its parents
      if (heapNode.parents) {
        heapNode.parents.push(node)
      }
    } else {
      // if node was ned processed yet, get heap-object and add create node
      const element = heap.find(hi => hi.id === id)
      heapNode = {
        element,
        parents: [node],
        children: [] as HeapTreeNode[],
        depth: 2,
        name: variable.name as string
      }
      heapBFSUtils.idMap.set(id, heapNode)
      // add it to the queue, so further heap-objects referenced from this can be found
      heapBFSUtils.queue.push(heapNode)
    }
    // add the referenced node to the children of the stack node
    node.children.push(heapNode)
    // add the node to the other heapNodes
    heapBFSUtils.heapNodes.add(heapNode)
  }
}

function processHeap (
  heapBFSUtils: HeapBFSUtils,
  heap: HeapItem[]
) {
  while (heapBFSUtils.queue.length > 0) {
    const node = heapBFSUtils.queue.shift()
    if (node) {
      // get children
      let children: Var[] | HeapArrayElementVar[] = []
      if (node.element?.kind === 'HeapObject') {
        children = node.element.fields
      } else if (node.element?.kind === 'HeapArray') {
        children = node.element.elements
      } else if (node.element?.kind === 'HeapString') {
        const id = (node.element.charArr.value as ReferenceVal).reference
        const array = heap.find(hi => hi.id === id)
        if (array?.kind === 'HeapArray') {
          children = array.elements
        }
      }
      // process children
      children.forEach((child: Var | HeapArrayElementVar) => {
        let childNode: HeapTreeNode
        if (child.value.kind === 'ReferenceVal' && heapBFSUtils.idMap.has(child.value.reference)) {
          // if child already exists, update parents
          const id: number = child.value.reference
          childNode = heapBFSUtils.idMap.get(id)!
          if (childNode.parents) {
            childNode.parents.push(node)
          } else {
            childNode.parents = [node]
          }
        } else {
          // if child does not exist, get name to be added to it
          let name: string = ''
          if (node.element?.kind === 'HeapString') {
            name = String.fromCharCode(parseInt((child.value as PrimitiveVal).primitiveValue)) as string
          } else if (node.element?.kind === 'HeapArray') {
            if ((child.value as unknown as PrimitiveVal).primitiveValue) {
              name = (child.value as unknown as PrimitiveVal).primitiveValue
            }
          } else if (child.kind === 'Var') {
            name = child.name as string
          }
          // create child-node
          childNode = {
            element: child, parents: [node], children: [] as HeapTreeNode[], depth: node.depth + 1, name
          }
          // check if element of child is a heap-object and add it to the id-map
          if (child.value.kind === 'ReferenceVal') {
            const id = child.value.reference
            const heapItem = heap.find(hi => hi.id === id)
            if (heapItem) {
              childNode.element = heapItem
            }
            heapBFSUtils.idMap.set(id, childNode)
          }
          // push child to queue for further processing
          heapBFSUtils.queue.push(childNode)
        }
        // add all children to parent's children
        node.children.push(childNode)
        // push to heapNode-list
        heapBFSUtils.heapNodes.add(childNode)
      })
    }
  }
}
