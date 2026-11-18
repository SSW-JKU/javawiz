import { HeapArrayElementVar, HeapItem, LoadedClass, PrimitiveVal, Recordable, ReferenceVal, StackFrame, Var } from '@/dto/TraceState'

/**
 * One node of the data-structure graph that the Array View, the List View, and the Tree View draw from. The graph
 * starts at an artificial root, whose children are the root variables (static fields, then the
 * locals of the stack), and continues through the heap: variable → referenced heap item → its
 * fields or elements → the heap items they reference, and so on. It is not a tree: a heap item
 * that several variables or fields reference has several parents, and cycles are possible.
 *
 * Example: for `Node head = new Node()` in `main`, the root has a child for the local `head`
 * (`label: 'head'`, `stackFrameNumber: 0`), whose only child is the `Node` object.
 */
export interface DataStructureGraphNode {
  /**
   * The trace element this node stands for: a variable (static field, local, or field of a
   * heap object), a heap object, array or string, or an array element.
   * `undefined` for the artificial root and for a referenced heap item missing from the trace.
   */
  traceElement?: Recordable | HeapArrayElementVar,
  /**
   * The nodes this node leads to, in trace order: the root variables for the root, the referenced
   * heap item for a reference variable (none for `null` or a primitive), one node per field of a
   * heap object, and one node per element of an array or character of a string. The List View and the
   * Tree View move the value, next, left and right fields of their node objects to fixed positions.
   */
  childDataStructureGraphNodes: DataStructureGraphNode[],
  /**
   * Distance from the root in the breadth-first build: 0 for the root, 1 for root variables,
   * 2 for the heap items they reference, and so on. A heap item reached on several paths keeps
   * the distance of the path that found it first.
   */
  bfsDepth: number,
  /**
   * Display name: the name of a variable or field; for a heap item, the name of the variable or
   * field that referenced it first; for a character of a string, the character itself; for a
   * primitive array element, its value; `'root'` for the root.
   */
  label: string,
  /** All nodes that lead to this node, e.g. every variable referencing a heap item; `undefined` for the root. */
  parentDataStructureGraphNodes?: DataStructureGraphNode[],
  /**
   * Stack frame of a local variable, counted from the bottom of the stack (`main` = 0), the same
   * numbering as the official trace identifiers. `undefined` for static fields, heap items and
   * everything below them.
   */
  stackFrameNumber?: number,
  /**
   * For list and tree node objects: one flag per field, in the same order as
   * `childDataStructureGraphNodes`, telling whether the field changed in the last step.
   * Set by `setChildChangedFlags`; `undefined` for all other nodes.
   */
  childChangedFlags?: boolean[]
}

/**
 * Working state of `buildDataStructureGraph` while it builds the data-structure graph breadth-first.
 * The builder returns the root and the heap content nodes from it; the other fields are only needed
 * during the build.
 */
interface DataStructureGraphBuildState {
  /** The artificial root of the graph (`label: 'root'`, depth 0); its children are the root variables. */
  rootDataStructureGraphNode: DataStructureGraphNode,
  /**
   * The node of every heap item already added to the graph, by heap item ID. A heap item that is
   * referenced again gets this existing node as an additional child instead of a second node.
   */
  dataStructureGraphNodeByHeapItemId: Map<number, DataStructureGraphNode>,
  /**
   * Queue of nodes whose children have not been created yet. Nodes are added at the end and taken
   * from the front, so the graph is built breadth-first.
   */
  unvisitedDataStructureGraphNodes: DataStructureGraphNode[],
  /**
   * Every node below the root variables: the heap items they reference, the fields, elements and
   * characters of heap items, and the heap items those reference, in the order they were found.
   * A set, so a node reached on several paths is listed once.
   */
  heapContentDataStructureGraphNodes: Set<DataStructureGraphNode>
}

/**
 * Builds the data-structure graph that the Array View, the List View, and the Tree View draw from: the root variables
 * (static fields of the user's classes, then the locals of the stack) and everything they reach on the heap.
 * @param loadedClasses classes whose static fields become root variables
 * @param stackFrames stack whose local variables become root variables, current frame first
 * @param heap heap items the variables can reference
 * @param onlyCurrentStackFrame `true` to take only the locals of the current stack frame
 * @returns the artificial root of the graph and every node below the root variables
 *   (see `DataStructureGraphBuildState.heapContentDataStructureGraphNodes`)
 */
export function buildDataStructureGraph (
  loadedClasses: LoadedClass[],
  stackFrames: StackFrame[],
  heap: HeapItem[],
  onlyCurrentStackFrame?: boolean
): { rootDataStructureGraphNode: DataStructureGraphNode, heapContentDataStructureGraphNodes: DataStructureGraphNode[] } {
  const dataStructureGraphBuildState: DataStructureGraphBuildState = {
    rootDataStructureGraphNode: { childDataStructureGraphNodes: [], bfsDepth: 0, label: 'root' },
    dataStructureGraphNodeByHeapItemId: new Map(),
    unvisitedDataStructureGraphNodes: [],
    heapContentDataStructureGraphNodes: new Set()
  }
  processStatics(dataStructureGraphBuildState, loadedClasses, heap)
  processStack(dataStructureGraphBuildState, stackFrames, heap, onlyCurrentStackFrame)
  processHeap(dataStructureGraphBuildState, heap)
  return {
    rootDataStructureGraphNode: dataStructureGraphBuildState.rootDataStructureGraphNode,
    heapContentDataStructureGraphNodes: [...dataStructureGraphBuildState.heapContentDataStructureGraphNodes]
  }
}

function processStatics (
  dataStructureGraphBuildState: DataStructureGraphBuildState,
  loadedClasses: LoadedClass[],
  heap: HeapItem[]
) {
  // Static fields of library and helper classes (JDK, In/Out) are not part of the user's
  // program, so the data-structure views skip them like the Tabular View and the Event History View do.
  loadedClasses.filter(loadedClass => !loadedClass.isHeapTraversalStop).forEach(loadedClass => {
    loadedClass.staticFields.forEach(variable => {
      processVar(dataStructureGraphBuildState, variable, heap)
    })
  })
}

function processStack (
  dataStructureGraphBuildState: DataStructureGraphBuildState,
  stackFrames: StackFrame[],
  heap: HeapItem[],
  onlyCurrentStackFrame?: boolean
) {
  for (let i = onlyCurrentStackFrame ? 0 : stackFrames.length - 1; i >= 0; i--) {
    for (let j = 0; j < stackFrames[i].localVariables.length; j++) {
      const variable: Var = stackFrames[i].localVariables[j]
      const stackFrameNumber = stackFrames.length - 1 - i
      // create nodes for stack-variables
      processVar(dataStructureGraphBuildState, variable, heap, stackFrameNumber)
    }
  }
}

function processVar (
  dataStructureGraphBuildState: DataStructureGraphBuildState,
  variable: Var,
  heap: HeapItem[],
  stackFrameNumber?: number
) {
  const variableDataStructureGraphNode: DataStructureGraphNode = {
    traceElement: variable,
    parentDataStructureGraphNodes: [dataStructureGraphBuildState.rootDataStructureGraphNode],
    childDataStructureGraphNodes: [],
    bfsDepth: 1,
    label: variable.name as string,
    stackFrameNumber
  }
  dataStructureGraphBuildState.rootDataStructureGraphNode.childDataStructureGraphNodes.push(variableDataStructureGraphNode)
  // check if heap-object has to be added
  if (variable.value.kind === 'ReferenceVal') {
    const id = variable.value.reference
    let heapItemDataStructureGraphNode = dataStructureGraphBuildState.dataStructureGraphNodeByHeapItemId.get(id)
    if (heapItemDataStructureGraphNode) {
      // if node was already added to tree, update its parents
      if (heapItemDataStructureGraphNode.parentDataStructureGraphNodes) {
        heapItemDataStructureGraphNode.parentDataStructureGraphNodes.push(variableDataStructureGraphNode)
      }
    } else {
      // if node was ned processed yet, get heap-object and add create node
      const element = heap.find(hi => hi.id === id)
      heapItemDataStructureGraphNode = {
        traceElement: element,
        parentDataStructureGraphNodes: [variableDataStructureGraphNode],
        childDataStructureGraphNodes: [] as DataStructureGraphNode[],
        bfsDepth: 2,
        label: variable.name as string
      }
      dataStructureGraphBuildState.dataStructureGraphNodeByHeapItemId.set(id, heapItemDataStructureGraphNode)
      // add it to the queue, so further heap-objects referenced from this can be found
      dataStructureGraphBuildState.unvisitedDataStructureGraphNodes.push(heapItemDataStructureGraphNode)
    }
    // add the referenced node to the children of the stack node
    variableDataStructureGraphNode.childDataStructureGraphNodes.push(heapItemDataStructureGraphNode)
    // add the node to the heap content nodes
    dataStructureGraphBuildState.heapContentDataStructureGraphNodes.add(heapItemDataStructureGraphNode)
  }
}

function processHeap (
  dataStructureGraphBuildState: DataStructureGraphBuildState,
  heap: HeapItem[]
) {
  while (dataStructureGraphBuildState.unvisitedDataStructureGraphNodes.length > 0) {
    const dataStructureGraphNode = dataStructureGraphBuildState.unvisitedDataStructureGraphNodes.shift()
    if (dataStructureGraphNode) {
      // get children
      let children: Var[] | HeapArrayElementVar[] = []
      if (dataStructureGraphNode.traceElement?.kind === 'HeapObject') {
        children = dataStructureGraphNode.traceElement.fields
      } else if (dataStructureGraphNode.traceElement?.kind === 'HeapArray') {
        children = dataStructureGraphNode.traceElement.elements
      } else if (dataStructureGraphNode.traceElement?.kind === 'HeapString') {
        const id = (dataStructureGraphNode.traceElement.charArr.value as ReferenceVal).reference
        const array = heap.find(hi => hi.id === id)
        if (array?.kind === 'HeapArray') {
          children = array.elements
        }
      }
      // process children
      children.forEach((child: Var | HeapArrayElementVar) => {
        let childDataStructureGraphNode: DataStructureGraphNode
        if (child.value.kind === 'ReferenceVal' && dataStructureGraphBuildState.dataStructureGraphNodeByHeapItemId.has(child.value.reference)) {
          // if child already exists, update parents
          const id: number = child.value.reference
          childDataStructureGraphNode = dataStructureGraphBuildState.dataStructureGraphNodeByHeapItemId.get(id)!
          if (childDataStructureGraphNode.parentDataStructureGraphNodes) {
            childDataStructureGraphNode.parentDataStructureGraphNodes.push(dataStructureGraphNode)
          } else {
            childDataStructureGraphNode.parentDataStructureGraphNodes = [dataStructureGraphNode]
          }
        } else {
          // if child does not exist, get name to be added to it
          let name: string = ''
          if (dataStructureGraphNode.traceElement?.kind === 'HeapString') {
            name = String.fromCharCode(parseInt((child.value as PrimitiveVal).primitiveValue)) as string
          } else if (dataStructureGraphNode.traceElement?.kind === 'HeapArray') {
            if ((child.value as unknown as PrimitiveVal).primitiveValue) {
              name = (child.value as unknown as PrimitiveVal).primitiveValue
            }
          } else if (child.kind === 'Var') {
            name = child.name as string
          }
          // create child-node
          childDataStructureGraphNode = {
            traceElement: child,
            parentDataStructureGraphNodes: [dataStructureGraphNode],
            childDataStructureGraphNodes: [],
            bfsDepth: dataStructureGraphNode.bfsDepth + 1,
            label: name
          }
          // check if element of child is a heap-object and add it to the id-map
          if (child.value.kind === 'ReferenceVal') {
            const id = child.value.reference
            const heapItem = heap.find(hi => hi.id === id)
            if (heapItem) {
              childDataStructureGraphNode.traceElement = heapItem
            }
            dataStructureGraphBuildState.dataStructureGraphNodeByHeapItemId.set(id, childDataStructureGraphNode)
          }
          // push child to queue for further processing
          dataStructureGraphBuildState.unvisitedDataStructureGraphNodes.push(childDataStructureGraphNode)
        }
        // add all children to parent's children
        dataStructureGraphNode.childDataStructureGraphNodes.push(childDataStructureGraphNode)
        // add it to the heap content nodes
        dataStructureGraphBuildState.heapContentDataStructureGraphNodes.add(childDataStructureGraphNode)
      })
    }
  }
}
