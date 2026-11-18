import { DataStructureGraphNode } from '../dataStructureGraph'
import { ListNodeBox, VariableToListNodePointer, NextFieldPointer, ValueObjectBox } from './types'
import { HeapObject, ReferenceVal, Var } from '@/dto/TraceState'
import { heapObjectFieldIdentifier, rootVariableIdentifier } from '@/identifiers/trace-identifiers'
import { hasNextFieldPointerChanged } from './pointer-utils'
import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { SVG } from '../constants'
import { moveElemInArray } from '../utils'
import { getVariablePointers } from '../preprocessing-utils'
import { getFieldIndex, setChildChangedFlags } from '../data-structure-graph-node-utils'

function processNode (
  dataStructureGraphNode: DataStructureGraphNode & { list?: DataStructureGraphNode },
  positionInfo: {
    column: number,
    row: number
  },
  iterationInfo: {
    currentDataStructureGraphNode: DataStructureGraphNode,
    previousListNodeBox: ListNodeBox | undefined
  },
  structures: {
    listNodeBoxes: ListNodeBox[],
    valueObjectBoxes: ValueObjectBox[],
    nextFieldPointers: NextFieldPointer[],
    nullTargetPlaceholders: ListNodeBox[]
  },
  component: { nodeClassNames: ReadonlySet<string>, nextName: string, valName: string }
) {
  // add node
  const containingListDataStructureGraphNodes = dataStructureGraphNode.list ? [dataStructureGraphNode.list] : []
  let nodeHeight = SVG.cellHeight * iterationInfo.currentDataStructureGraphNode.childDataStructureGraphNodes.length
  const listNodeBox: ListNodeBox = {
    dataStructureGraphNode: iterationInfo.currentDataStructureGraphNode,
    column: positionInfo.column,
    containingListDataStructureGraphNodes,
    row: positionInfo.row,
    height: nodeHeight,
    valueFieldPosition: getFieldIndex(iterationInfo.currentDataStructureGraphNode, component.valName),
    nextFieldPosition: getFieldIndex(iterationInfo.currentDataStructureGraphNode, component.nextName)
  }
  structures.listNodeBoxes.push(listNodeBox)
  // handle value object box
  const nrOfFieldsInValueObject = processValueObjectBox(listNodeBox, structures.valueObjectBoxes)
  if (nrOfFieldsInValueObject > 0) {
    nodeHeight += (nrOfFieldsInValueObject + 1) * SVG.cellHeight
  }
  // add next pointer
  const currentListNodeBox = structures.listNodeBoxes[structures.listNodeBoxes.length - 1]
  if (iterationInfo.previousListNodeBox) {
    structures.nextFieldPointers.push({
      sourceListNodeBox: iterationInfo.previousListNodeBox,
      targetListNodeBox: currentListNodeBox,
      changed: hasNextFieldPointerChanged(component.nextName, iterationInfo.previousListNodeBox)
    })
  }
  const nextDataStructureGraphNode: DataStructureGraphNode | undefined =
    iterationInfo.currentDataStructureGraphNode.childDataStructureGraphNodes[currentListNodeBox.nextFieldPosition]
  const nextListNodeBox = structures.listNodeBoxes.find(listNodeBox =>
    (listNodeBox.dataStructureGraphNode?.traceElement as HeapObject)?.id === (nextDataStructureGraphNode?.traceElement as HeapObject)?.id)
  let nextNode: DataStructureGraphNode | undefined
  if (nextListNodeBox) {
    // next node is already existing
    // create next pointer
    structures.nextFieldPointers.push({
      sourceListNodeBox: currentListNodeBox,
      targetListNodeBox: nextListNodeBox,
      changed: hasNextFieldPointerChanged(component.nextName, currentListNodeBox)
    })
    // shift the columns of the boxes before and after this box, if the next box belongs to some list
    if (nextListNodeBox.containingListDataStructureGraphNodes.length > 0 && nextListNodeBox.row !== currentListNodeBox.row) {
      const nrOfNewNodes = positionInfo.column + 1
      const indexDifference = nextListNodeBox.column
      // shift the columns of the list's boxes from the next box on
      const nodesToCheck = structures.listNodeBoxes.concat(structures.nullTargetPlaceholders)
      nodesToCheck.filter(n => n.column >= indexDifference &&
        n.containingListDataStructureGraphNodes.some(list => nextListNodeBox.containingListDataStructureGraphNodes.includes(list))).forEach(n => {
        n.column += nrOfNewNodes
        n.containingListDataStructureGraphNodes.push(...containingListDataStructureGraphNodes)
      })

      // shift the columns of the boxes in this box's row
      structures.listNodeBoxes.filter(n => n.row === positionInfo.row).forEach(n => {
        n.column += indexDifference
        n.containingListDataStructureGraphNodes.push(...nextListNodeBox.containingListDataStructureGraphNodes)
      })
    }
  } else {
    // next node does not exist yet
    if (nextDataStructureGraphNode?.traceElement?.kind === 'HeapObject' && component.nodeClassNames.has(nextDataStructureGraphNode.traceElement.type)) {
      // set nextNode to be processed
      nextNode = nextDataStructureGraphNode
    } else if (!nextDataStructureGraphNode || nextDataStructureGraphNode.traceElement?.kind !== 'HeapObject') {
      // if next node is null, add a next pointer to a placeholder box
      const nullTargetPlaceholder: ListNodeBox = {
        column: positionInfo.column + 1,
        containingListDataStructureGraphNodes,
        row: positionInfo.row,
        height: 0,
        valueFieldPosition: -1,
        nextFieldPosition: -1
      }
      structures.nullTargetPlaceholders.push(nullTargetPlaceholder)
      structures.nextFieldPointers.push({
        sourceListNodeBox: currentListNodeBox,
        targetListNodeBox: nullTargetPlaceholder,
        changed: hasNextFieldPointerChanged(component.nextName, currentListNodeBox)
      })
    }
  }
  return { nextNode, currentListNodeBox, nodeHeight }
}

export function createListNodeBoxesAndNextFieldPointers (
  rootDataStructureGraphNode: DataStructureGraphNode,
  listDataStructureGraphNodes: DataStructureGraphNode[],
  rowYCoordinates: number[],
  component: { nodeClassNames: ReadonlySet<string>, nextName: string, valName: string }
) {
  const listNodeBoxes: ListNodeBox[] = []
  const valueObjectBoxes: ValueObjectBox[] = []
  const nullTargetPlaceholders: ListNodeBox[] = []
  const nextFieldPointers: NextFieldPointer[] = []

  // get all variables that point to a node
  const variableDataStructureGraphNodes = getVariablePointers(rootDataStructureGraphNode, component.nodeClassNames)

  // collect nodes
  const listNodeDataStructureGraphNodes: (DataStructureGraphNode & { list?: DataStructureGraphNode })[] = listDataStructureGraphNodes.flatMap(list =>
    list.childDataStructureGraphNodes.filter(child => child.traceElement?.kind === 'HeapObject' && component.nodeClassNames.has(child.traceElement.type))
      .map(node => {
        return { ...node, list }
      })
  )
  listNodeDataStructureGraphNodes.push(...variableDataStructureGraphNodes
    .filter(pointer => (pointer.traceElement as Var).value.kind === 'ReferenceVal' && pointer.childDataStructureGraphNodes[0])
    .map(pointer => pointer.childDataStructureGraphNodes[0]))

  // process nodes
  let row = 0
  listNodeDataStructureGraphNodes.forEach(heapNode => {
    const node = heapNode.traceElement as HeapObject
    // create node, if it's not in the visualization
    if (!listNodeBoxes.find(n => (n.dataStructureGraphNode?.traceElement as HeapObject).id === node.id)) {
      let column = 0
      let currentDataStructureGraphNode: DataStructureGraphNode | undefined = heapNode
      let previousListNodeBox: ListNodeBox | undefined
      let maxNodeHeightInLevel = 0
      previousListNodeBox = undefined
      while (currentDataStructureGraphNode) {
        const ret = processNode(
          heapNode,
          { column, row },
          { currentDataStructureGraphNode, previousListNodeBox },
          { listNodeBoxes, valueObjectBoxes, nextFieldPointers, nullTargetPlaceholders },
          component
        )
        currentDataStructureGraphNode = ret.nextNode
        previousListNodeBox = ret.currentListNodeBox
        if (ret.nodeHeight > maxNodeHeightInLevel) {
          maxNodeHeightInLevel = ret.nodeHeight
        }
        column++
      }
      rowYCoordinates.push(rowYCoordinates[rowYCoordinates.length - 1] + maxNodeHeightInLevel + LAYOUT.nodes.distances.between)
      row++
    }
  })
  return { listNodeBoxes, variableDataStructureGraphNodes, nextFieldPointers, valueObjectBoxes }
}

// adds changed flag to children of nodes and moves value and next children to the beginning/end of the children-array
export function processChildren (boxes: (ListNodeBox | ValueObjectBox)[], component?: { valName: string, nextName: string }) {
  boxes
    .map(box => box.dataStructureGraphNode)
    .filter(node => node && node.traceElement?.kind === 'HeapObject')
    .forEach(node => {
      setChildChangedFlags(node!)

      if (component) {
        const nextIndex = getFieldIndex(node!, component.nextName)
        const valueIndex = getFieldIndex(node!, component.valName)

        if (nextIndex !== -1) {
          node!.childDataStructureGraphNodes[nextIndex].label = component.nextName
          moveElemInArray(node!.childDataStructureGraphNodes, nextIndex, 0)
          moveElemInArray(node!.childChangedFlags, nextIndex, 0)
        }

        if (valueIndex !== -1) {
          const valueIndexUpdate = valueIndex < nextIndex ? valueIndex + 1 : valueIndex
          node!.childDataStructureGraphNodes[valueIndexUpdate].label = component.valName
          moveElemInArray(node!.childDataStructureGraphNodes, valueIndexUpdate, -1)
          moveElemInArray(node!.childChangedFlags, valueIndexUpdate, -1)
        }
      }
    })
}

export function createVariablePointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  listNodeBoxes: ListNodeBox[],
  variableDataStructureGraphNodes: DataStructureGraphNode[],
  listDataStructureGraphNodes: DataStructureGraphNode[],
  component: { prevName: string, nodeClassNames: ReadonlySet<string> }
) {
  // create the pointers of variables that reference a list node
  const variableToListNodePointers: VariableToListNodePointer[] = listNodeBoxes.flatMap(listNodeBox =>
    variableDataStructureGraphNodes.filter(pointer => (pointer.traceElement as Var).value.kind === 'ReferenceVal' &&
      ((pointer.traceElement as Var).value as ReferenceVal).reference ===
      (listNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id)
      .map((pointer, index): VariableToListNodePointer => {
        return {
          name: pointer.label,
          sourceVariableIdentifier: rootVariableIdentifier(pointer.traceElement as Var, pointer.stackFrameNumber),
          sourceDataStructureGraphNode: pointer,
          targetListNodeBox: listNodeBox,
          positionAtTarget: index,
          isNull: false,
          targetColumn: listNodeBox.column,
          changed: (pointer.traceElement as Var).changed,
          isListObjectField: false
        }
      })
  )

  // find prev-pointer and move to front
  const prevPointer = variableToListNodePointers.find(pointer => pointer.name === component.prevName)
  if (prevPointer) {
    const otherPointers = variableToListNodePointers
      .filter(pointer => pointer.targetListNodeBox === prevPointer.targetListNodeBox && pointer !== prevPointer)
    prevPointer.positionAtTarget = 0
    otherPointers.forEach((pointer, index) => {
      pointer.positionAtTarget = index + 1
    })
  }

  // index for pointers that are null
  let frontIndex = 0

  // add variables of tree itself (root, ...)
  listDataStructureGraphNodes.forEach(heapNode => {
    const dataStructure = heapNode.traceElement as HeapObject
    dataStructure.fields.filter(field => field.value.kind === 'ReferenceVal'
      ? listNodeBoxes.some(listNodeBox => (listNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === (field.value as ReferenceVal).reference)
      : field.value.kind === 'NullVal' && component.nodeClassNames.has(field.type))
      .slice()
      .reverse()
      .forEach(field => {
        if (field.value.kind === 'ReferenceVal') {
          const fieldReference = field.value.reference
          // increment indices of all other pointers to same node, so list-pointers are displayed first
          variableToListNodePointers.filter(pointer =>
            (pointer.targetListNodeBox?.dataStructureGraphNode?.traceElement as HeapObject | undefined)?.id === fieldReference)
            .forEach(pointer => {
              pointer.positionAtTarget++
            })
          // find node and add entry
          const listNodeBox = listNodeBoxes.find(listNodeBox =>
            (listNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === fieldReference)
          if (listNodeBox) {
            variableToListNodePointers.push({
              name: field.name,
              sourceVariableIdentifier: heapObjectFieldIdentifier(dataStructure, field),
              sourceDataStructureGraphNode: heapNode,
              targetListNodeBox: listNodeBox as ListNodeBox,
              positionAtTarget: 0,
              isNull: false,
              targetColumn: listNodeBox.column,
              changed: field.changed,
              isListObjectField: true
            })
          }
        } else if (field.value.kind === 'NullVal') {
          variableToListNodePointers.push({
            name: field.name,
            sourceVariableIdentifier: heapObjectFieldIdentifier(dataStructure, field),
            sourceDataStructureGraphNode: heapNode,
            positionAtTarget: frontIndex,
            isNull: true,
            targetColumn: -1,
            changed: field.changed,
            isListObjectField: true
          })
          frontIndex++
        }
      })
  })

  // add null-pointers
  const columnAfterLastBox = Math.max(...listNodeBoxes.map(listNodeBox => listNodeBox.column)) + 1
  let backIndex = 0
  variableDataStructureGraphNodes
    .filter(pointer => (pointer.traceElement as Var).value.kind === 'NullVal')
    .forEach(pointer => {
      const sourceVariableIdentifier = rootVariableIdentifier(pointer.traceElement as Var, pointer.stackFrameNumber)
      const pointerSelection = svg.select(`#${HTML.ids.prefixes.pointer}-${sourceVariableIdentifier}`)
      const previousTargetColumn = pointerSelection.empty()
        ? undefined
        : ((pointerSelection.datum() as VariableToListNodePointer).targetColumn)
      variableToListNodePointers.push({
        name: (pointer.traceElement as Var).name as string,
        sourceVariableIdentifier,
        sourceDataStructureGraphNode: pointer,
        positionAtTarget: (listNodeBoxes.length === 0 || pointerSelection.empty() || previousTargetColumn === -1)
          ? frontIndex++
          : backIndex++,
        isNull: true,
        // if pointer existed and pointed to a node in the right half of the list, move to end
        targetColumn: (listNodeBoxes.length === 0 || pointerSelection.empty() || previousTargetColumn === -1 || previousTargetColumn! < (columnAfterLastBox / 2))
          ? -1
          : columnAfterLastBox,
        changed: (pointer.traceElement as Var).changed,
        isListObjectField: false
      })
    })
  return variableToListNodePointers
}

// checks if the value field of the given list node box references an object; if so, the value object box of that object
// is stored in the list node box and, if new, added to the value object boxes
// assumed to be called before processChildren(), returns number of fields of the value object (0 if there is none)
function processValueObjectBox (listNodeBox: ListNodeBox, valueObjectBoxes: ValueObjectBox[]) {
  if (listNodeBox.dataStructureGraphNode && listNodeBox.dataStructureGraphNode.childDataStructureGraphNodes[listNodeBox.valueFieldPosition]?.traceElement?.kind === 'HeapObject') {
    const valueObjectDataStructureGraphNode = listNodeBox.dataStructureGraphNode.childDataStructureGraphNodes[listNodeBox.valueFieldPosition]
    let valueObjectBox = valueObjectBoxes.find(valueObjectBox => valueObjectBox.dataStructureGraphNode === valueObjectDataStructureGraphNode)
    if (!valueObjectBox) {
      valueObjectBox = { ownerListNodeBox: listNodeBox, dataStructureGraphNode: valueObjectDataStructureGraphNode }
      valueObjectBoxes.push(valueObjectBox)
    }
    listNodeBox.valueObjectBox = valueObjectBox
    return valueObjectBox.dataStructureGraphNode.childDataStructureGraphNodes.length
  }
  return 0
}
