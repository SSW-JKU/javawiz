import { HeapTreeNode } from '../heapBFS'
import { ArrayAccessTarget, ArrayAccessValue, HeapArray, IndexExpression, LocalVar, PrimitiveVal, ProcessedTraceState, StackFrame, Var, VariableTarget } from '@/dto/TraceState'
import {
  ArrayIndex,
  ArrayNode,
  ArrayPointer,
  CopyAnimations,
  MissingSource,
  ProcessedIndex, SettingsIndex,
  TempVariable,
  TwoDimArrayNode,
  ValidProcessedIndex
} from './types'
import { DISPLAYABLE_TYPES, HTML, LAYOUT, REGEX } from './constants'
import { getCellWidth, getCoordinatesAndWidth } from './utils'
import { addIndex, getIndexCoordinates } from './index-utils'
import { BaseType, Selection } from 'd3-selection'
import { getAnimationArray, visualizeValueCopy } from './animation'
import { checkIndexCoverage, getDisplayString } from './index-processing'
import { REGEX as COMMON_REGEX, SVG } from '../constants'
import { blendOutAnimation } from '../animations'
import { ComputedRef } from 'vue';

export function createTempVariablesStructure (heapTree: HeapTreeNode, component: { traceState?: ProcessedTraceState, minCellWidth: number, onlyCurrentStackFrame: boolean }) {
  const tempVariables: TempVariable[] = []
  let x = LAYOUT.xOrigin

  if (component.traceState) {
    const stackFrames = component.traceState.stackAfterExecution
    for (let i = component.onlyCurrentStackFrame ? 0 : stackFrames.length - 1; i >= 0; i--) {
      stackFrames[i].arrayAccessValues.forEach(arrayAccessValue => {
        if (arrayAccessValue.arrayAccess.assignmentTarget?.kind === 'VariableTarget') {
          const variable = stackFrames[i].localVariables.find(variable => variable.name === (arrayAccessValue.arrayAccess.assignmentTarget as VariableTarget).name)
          if (!variable || !DISPLAYABLE_TYPES.types.find(type => type === variable.type)) {
            return
          }
          const heapNode = heapTree.children.find(child => child.element === variable)
          if (heapNode && !tempVariables.find(tempVariable => tempVariable.variable === heapNode)) {
            const cellWidth = getCellWidth(heapNode, component.minCellWidth)
            tempVariables.push({
              kind: 'TempVariable',
              variable: heapNode,
              coordinates: [x, LAYOUT.yOrigin + LAYOUT.tempVariables.yOrigin],
              cellWidth
            })
            x += cellWidth + component.minCellWidth / 2
          }
        }
      })
    }
  }
  return tempVariables
}

function isDisplayAbleType (type: string) {
  return DISPLAYABLE_TYPES.oneDim.includes(type) || DISPLAYABLE_TYPES.twoDim.includes(type)
}

function isDisplayableArray (child: HeapTreeNode) {
  // test if referenced array is displayable
  const displayableArrayReference = (child.element as Var).value.kind === 'ReferenceVal' &&
    isDisplayAbleType((child.children[0].element as HeapArray).type)
  // test if array null pointer is displayable
  const displayableArrayNullPointer = (child.element as Var).value.kind === 'NullVal' &&
    isDisplayAbleType((child.element as Var).type)
  return displayableArrayReference || displayableArrayNullPointer
}

export function createArrayAndPointerStructure (heapTree: HeapTreeNode, component: { showArgs: boolean, minCellWidth: number }) {
  const arrayPointers: ArrayPointer[] = []
  const arrays: ArrayNode[] = []
  let ignored = 0
  heapTree.children
    .filter(child => isDisplayableArray(child))
    .forEach((node, index) => {
      if (!component.showArgs && (node.name === 'args' || node.name === 'arg')) {
        ignored++
        return
      }
      let arrayNode = arrays.find(n => n.element === node.children[0]?.element)
      if (!arrayNode && (node.element as Var).value.kind !== 'NullVal') {
        if ((node.children[0].element as HeapArray).type.endsWith('[][]') || (node.element as Var).type.endsWith('[][]')) {
          const cellWidth = Math.max(...node.children[0].children.map(child => getCellWidth(child, component.minCellWidth)))
          const maxLength = Math.max(...node.children[0].children.map(child => child.children.length))
          const parentDimensions: [number, number] = [node.children[0].children.length, maxLength]
          arrayNode = {
            ...node.children[0],
            kind: 'TwoDimArrayNode',
            level: index - ignored,
            cellWidth,
            dimensions: parentDimensions,
            children: node.children[0].children.map((child, i, _) => {
              return {
                ...child,
                kind: 'TwoDimArrayChild',
                parent: undefined,
                indexInParent: i,
                level: index - ignored,
                cellWidth,
                parentDimensions
              }
            })
          }
          arrayNode.children.forEach(child => {
            child.parent = arrayNode
          })
          arrays.push(...(arrayNode as TwoDimArrayNode).children)
          arrays.push(arrayNode)
        } else {
          arrayNode = {
            ...node.children[0],
            kind: 'OneDimArrayNode',
            dimensions: [node.children[0].children.length],
            level: index - ignored,
            cellWidth: getCellWidth(node.children[0], component.minCellWidth)
          }
          arrays.push(arrayNode)
        }
      }
      arrayPointers.push({
        array: arrayNode,
        name: node.name,
        level: index - ignored,
        isNull: (node.element as Var).value.kind === 'NullVal',
        methodOrParentId: (node.element as LocalVar).method.replace(COMMON_REGEX.illegalCssSelector, '') + node.stackFrameDepth,
        parent: node,
        changed: (node.element as Var).changed
      })
    })
  return { arrays, arrayPointers }
}

export function createLevelCoordinates (pointer: ArrayPointer[], arrays: ArrayNode[]) {
  const levelCoordinates: number[] = []
  let lastY = LAYOUT.yOrigin + LAYOUT.arrays.yOrigin
  pointer
    .slice()
    .sort((a, b) => a.level - b.level)
    .forEach(pointer => {
      levelCoordinates.push(lastY)
      const array = arrays.find(array => array.level === pointer.level)
      if (array?.kind === 'TwoDimArrayChild') {
        lastY += array.parentDimensions[0] * SVG.cellHeight
      } else {
        lastY += SVG.cellHeight
      }
      lastY += LAYOUT.arrays.distanceBetween
    })
  return levelCoordinates
}

export function createIndexesStructure (
  arrays: ArrayNode[],
  heapTree: HeapTreeNode,
  ghostIndexes: {array: ArrayNode, name: string, value: number}[],
  component: { processedIndexes: ProcessedIndex[] }
) {
  const indexes: ArrayIndex[] = []
  component.processedIndexes
    .filter(index => !index.isHidden && index.isValid)
    .forEach(processedIndex => {
      const index = processedIndex as ValidProcessedIndex

      const indexedArrays: ArrayNode[] = []
      if (index.array) {
        indexedArrays.push(index.array)
      } else if (index.arrayName === REGEX.arrayWildcard) {
        indexedArrays.push(...arrays)
      } else {
        for (let i = arrays.length - 1; i >= 0; i--) {
          if (arrays[i].parents?.find(par => par.name === index.arrayName)) {
            indexedArrays.push(arrays[i])
          }
        }
      }

      index.variableNames.forEach((variableName, i) => {
        if (variableName === '*') {
          return
        }
        // find variable
        const variable = heapTree.children.slice().reverse()
          .find(child => child.name === variableName)
        if (!variable || (variable.element as Var).value.kind !== 'PrimitiveVal') {
          return
        }
        // convert value of variable to number
        const value = +(((variable.element as Var).value as PrimitiveVal).primitiveValue)
        if (!Number.isInteger(value)) {
          return
        }
        // add indexes
        indexedArrays
          .filter(array => array.kind !== 'TwoDimArrayChild')
          .forEach(array => {
            const arr = i > 0 ? (array as TwoDimArrayNode).children[0] : array
            if (arr) {
              addIndex(indexes, { array: arr, name: variableName, value, changed: (variable.element as Var).changed, isGhost: false })
            }
          })
      })
    })
  ghostIndexes.forEach(ghostIndex => {
    if (!indexes.find(index => index.name === ghostIndex.name && (index.array.element as HeapArray).id === (ghostIndex.array.element as HeapArray).id)) {
      addIndex(indexes, { array: ghostIndex.array, name: ghostIndex.name, value: ghostIndex.value, changed: false, isGhost: true })
    }
  })
  return indexes
}

function handleSourceVariables (
  arrayAccessValue: ArrayAccessValue,
  stackDepth: number,
  array: ArrayNode,
  structures: {
    tempVariables: TempVariable[],
    copyAnimations: CopyAnimations,
    missingSources: MissingSource[],
    staticViz: Selection<BaseType, unknown, HTMLElement, any>,
  }
) {
  arrayAccessValue.arrayAccess.assignmentSourceVariableNames.forEach(sourceVariableName => {
    const source = structures.tempVariables.find(tempVariable => tempVariable.variable.name === sourceVariableName &&
      tempVariable.variable.stackFrameDepth === stackDepth)
    if (array) {
      const targetArray = getAnimationArray(arrayAccessValue, array)
      const indexTo = arrayAccessValue.indexValues[0]
      if (source) {
        visualizeValueCopy(
          structures.copyAnimations,
          structures.staticViz,
          { source, target: targetArray, arrayCopy: false },
          { to: indexTo }
        )
      } else {
        structures.missingSources.unshift({
          name: sourceVariableName,
          stackDepth,
          target: getCoordinatesAndWidth(targetArray, false, indexTo)
        })
      }
    }
  })
}

function handleTargetAccess (
  targetInfo: {
    dimension: number, array: ArrayNode, arrayAccessValue: ArrayAccessValue, indexExpression: IndexExpression
  },
  ghostIndexes: { array: ArrayNode, name: string, value: number }[],
  changeCoordinates?: [number, number]
) {
  const index = {
    array: targetInfo.dimension === 0 && targetInfo.arrayAccessValue.indexValues.length > 1
      ? (targetInfo.array as TwoDimArrayNode).children[0]
      : targetInfo.array,
    name: targetInfo.indexExpression.expression,
    value: targetInfo.arrayAccessValue.indexValues[targetInfo.dimension]
  }

  ghostIndexes.push(index)

  return changeCoordinates ?? getIndexCoordinates(index)
}

function addArrayTargetAnimation (
  targetArrayAccess: ArrayAccessTarget,
  source: {
    array: ArrayNode,
    animationArray: ArrayNode,
    accessValue: ArrayAccessValue
  },
  structures: {
    arrays: ArrayNode[],
    stackFrame: StackFrame,
    copyAnimations: CopyAnimations,
    staticViz: Selection<BaseType, unknown, HTMLElement, any>
  }
) {
  // find target access
  const targetAccessValue = structures.stackFrame.arrayAccessValues.find((access: ArrayAccessValue) => access.arrayAccess.id === targetArrayAccess.id)
  const arrayTo = structures.arrays.find(array => (array.element as HeapArray).id === targetAccessValue?.arrayObjectID)
  if (targetAccessValue && arrayTo) {
    visualizeValueCopy(
      structures.copyAnimations,
      structures.staticViz,
      {
        source: getAnimationArray(source.accessValue, source.array),
        target: getAnimationArray(targetAccessValue, arrayTo),
        arrayCopy: source.animationArray.kind === 'TwoDimArrayNode' && source.accessValue.indexValues.length === 1
      },
      { from: source.accessValue.indexValues[0], to: targetAccessValue.indexValues[0] }
    )
  }
}

function addVariableTargetAnimation (
  targetName: string,
  stackDepth: number,
  source: {
    array: ArrayNode,
    arrayAccessValue: ArrayAccessValue
  },
  structures: {
    tempVariables: TempVariable[],
    copyAnimations: CopyAnimations,
    staticViz: Selection<BaseType, unknown, HTMLElement, any>
  },
  changeCoordinates?: [number, number]
) {
  const targetVariable = structures.tempVariables.find(tempVariable => tempVariable.variable.name === targetName &&
    tempVariable.variable.stackFrameDepth === stackDepth)
  if (targetVariable) {
    visualizeValueCopy(
      structures.copyAnimations,
      structures.staticViz,
      {
        source: getAnimationArray(source.arrayAccessValue, source.array),
        target: targetVariable,
        arrayCopy: source.array.kind === 'TwoDimArrayNode' && source.arrayAccessValue.indexValues.length === 1
      },
      { from: source.arrayAccessValue.indexValues[0] }
    )
  }

  return changeCoordinates ?? targetVariable?.coordinates
}

export function createGhostIdxAndTempVarsStruct (
  arrays: ArrayNode[],
  tempVariables: TempVariable[],
  viz: Selection<BaseType, unknown, HTMLElement, any>,
  component: { traceState?: ProcessedTraceState }
) {
  const ghostIndexes: { array: ArrayNode, name: string, value: number }[] = []
  let changeCoordinates: [number, number] | undefined

  const staticViz = viz.select(`#${HTML.ids.arrayWriteAccesses.static}`)
  const movingViz = viz.select(`#${HTML.ids.arrayWriteAccesses.moving}`)
  const copyAnimations: CopyAnimations = { duration: 0, movingViz, data: [] }
  blendOutAnimation(staticViz.selectAll(`.${HTML.classes.highlightedCells.sources}, .${HTML.classes.highlightedCells.targets}`))

  const missingSources: MissingSource[] = []

  if (component.traceState) {
    for (let i = 0; i < component.traceState.stackAfterExecution.length; i++) {
      const stackFrame: StackFrame = component.traceState.stackAfterExecution[i]
      stackFrame.arrayAccessValues
        .filter(arrayAccessValue => arrayAccessValue.evaluated)
        .forEach(arrayAccessValue => {
          const array = arrays.find(array => (array.element as HeapArray).id === arrayAccessValue.arrayObjectID)
          if (!array) {
            return
          }

          const stackDepth = component.traceState!.stackAfterExecution.length - 1 - i

          handleSourceVariables(
            arrayAccessValue,
            stackDepth,
            array,
            { tempVariables, copyAnimations, missingSources, staticViz }
          )

          arrayAccessValue.arrayAccess.indexExpressions.forEach((indexExpression, j) => {
            if (arrayAccessValue.arrayAccess.isWrittenTo) {
              changeCoordinates = handleTargetAccess(
                { dimension: j, arrayAccessValue, array, indexExpression },
                ghostIndexes,
                changeCoordinates
              )
            } else {
              const arrayFrom = j === 0 && arrayAccessValue.indexValues.length > 1
                ? (array as TwoDimArrayNode).children[0]
                : array

              const target = arrayAccessValue.arrayAccess.assignmentTarget
              if (target && target.kind === 'ArrayAccessTarget' && arrayFrom && j === 0) {
                addArrayTargetAnimation(
                  target,
                  { array, animationArray: arrayFrom, accessValue: arrayAccessValue },
                  { arrays, stackFrame, copyAnimations, staticViz }
                )
              } else if (target && target.kind === 'VariableTarget' && j === 0) {
                changeCoordinates = addVariableTargetAnimation(
                  target.name,
                  stackDepth,
                  { array, arrayAccessValue },
                  { tempVariables, copyAnimations, staticViz },
                  changeCoordinates
                )
              }

              if (arrayFrom) {
                ghostIndexes.push({
                  array: arrayFrom,
                  name: indexExpression.expression,
                  value: arrayAccessValue.indexValues[j]
                })
              }
            }
          })
        })
    }
  }
  return { ghostIndexes, copyAnimations, changeCoordinates, missingSources }
}

export function detectArrayAccesses (
  arrays: ArrayNode[],
  hiddenIndexes: SettingsIndex[],
  component: { traceState?: ProcessedTraceState, indexes: SettingsIndex[], processedIndexes: ComputedRef<ProcessedIndex[]> }
) {
  if (component.traceState) {
    let nrOfDetected = 0

    component.traceState.stackAfterExecution.forEach(stackFrame => {
      stackFrame.arrayAccessValues
        .forEach((arrayAccessValue: ArrayAccessValue) => {
          const accessArray = arrays.find(array => (array.element as HeapArray).id === arrayAccessValue.arrayObjectID)
          if (!accessArray) {
            return
          }

          arrayAccessValue.arrayAccess.indexExpressions.forEach((indexExpression, i) => {
            if (!indexExpression.isVariable) {
              return
            }

            let array: ArrayNode = accessArray
            if (i === 0 && arrayAccessValue.indexValues.length > 1) {
              if (array.kind !== 'TwoDimArrayNode') {
                return
              }
              array = array.children[0]
            }

            const name = accessArray.name
            const index = arrayAccessValue.arrayAccess.indexExpressions.length - 1 - i
            const indexInSettings = component.processedIndexes.value
              .find(idx => idx.isValid &&
                checkIndexCoverage(idx, { arrayName: name, variableNames: index === 0 ? [indexExpression.expression] : [REGEX.arrayWildcard, indexExpression.expression] }))
            if (array && !indexInSettings) {
              const displayString = getDisplayString(name, indexExpression.expression, index)
              component.indexes.splice(
                nrOfDetected,
                0,
                { displayString, array: accessArray, isDetected: true, isHidden: !!hiddenIndexes.find(idx => idx.displayString === displayString) }
              )
              nrOfDetected++
            }
          })
        })
    })
  }
}
