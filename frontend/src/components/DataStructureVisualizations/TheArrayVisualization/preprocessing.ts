import { DataStructureGraphNode } from '../dataStructureGraph'
import { ArrayAccessTarget, ArrayAccessValue, HeapArray, IndexExpression, PrimitiveVal, ProcessedTraceState, StackFrame, Var, VariableTarget } from '@/dto/TraceState'
import { rootVariableIdentifier } from '@/identifiers/trace-identifiers'
import {
  IndexLabel,
  GhostIndexLabelCandidate,
  ArrayBox,
  VariableToArrayPointer,
  CopyAnimationGroup,
  VanishedSourceVariable,
  ParsedIndexLabelSetting, IndexLabelSetting,
  TemporaryVariableBox,
  TwoDimArrayRowBox,
  TwoDimArrayBox,
  ValidParsedIndexLabelSetting
} from './types'
import { DISPLAYABLE_TYPES, HTML, LAYOUT, REGEX } from './constants'
import { getCellWidth, getCoordinatesAndWidth } from './utils'
import { addIndexLabel, getIndexCoordinates } from './index-utils'
import { BaseType, Selection } from 'd3-selection'
import { getAnimationArray, visualizeValueCopy } from './animation'
import { checkIndexCoverage, formatIndexLabelExpression } from './index-processing'
import { SVG } from '../constants'
import { blendOutAnimation } from '../animations'
import type { Ref } from 'vue'

export function createTemporaryVariableBoxes (
  rootDataStructureGraphNode: DataStructureGraphNode,
  component: { traceState?: ProcessedTraceState, minCellWidth: number, onlyCurrentStackFrame: boolean }
) {
  const temporaryVariableBoxes: TemporaryVariableBox[] = []
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
          const heapNode = rootDataStructureGraphNode.childDataStructureGraphNodes.find(child => child.traceElement === variable)
          if (heapNode && !temporaryVariableBoxes.find(temporaryVariableBox => temporaryVariableBox.variableDataStructureGraphNode === heapNode)) {
            const cellWidth = getCellWidth(heapNode, component.minCellWidth)
            temporaryVariableBoxes.push({
              kind: 'TemporaryVariableBox',
              variableDataStructureGraphNode: heapNode,
              coordinates: [x, LAYOUT.yOrigin + LAYOUT.tempVariables.yOrigin],
              cellWidth
            })
            x += cellWidth + component.minCellWidth / 2
          }
        }
      })
    }
  }
  return temporaryVariableBoxes
}

function isDisplayAbleType (type: string) {
  return DISPLAYABLE_TYPES.oneDim.includes(type) || DISPLAYABLE_TYPES.twoDim.includes(type)
}

function isDisplayableArray (child: DataStructureGraphNode) {
  // test if referenced array is displayable
  const displayableArrayReference = (child.traceElement as Var).value.kind === 'ReferenceVal' &&
    isDisplayAbleType((child.childDataStructureGraphNodes[0].traceElement as HeapArray).type)
  // test if array null pointer is displayable
  const displayableArrayNullPointer = (child.traceElement as Var).value.kind === 'NullVal' &&
    isDisplayAbleType((child.traceElement as Var).type)
  return displayableArrayReference || displayableArrayNullPointer
}

export function createArrayBoxesAndVariablePointers (rootDataStructureGraphNode: DataStructureGraphNode, component: { showArgs: boolean, minCellWidth: number }) {
  const variableToArrayPointers: VariableToArrayPointer[] = []
  const arrayBoxes: ArrayBox[] = []
  let ignored = 0
  rootDataStructureGraphNode.childDataStructureGraphNodes
    .filter(child => isDisplayableArray(child))
    .forEach((node, index) => {
      if (!component.showArgs && (node.label === 'args' || node.label === 'arg')) {
        ignored++
        return
      }
      let arrayBox = arrayBoxes.find(n => n.traceElement === node.childDataStructureGraphNodes[0]?.traceElement)
      if (!arrayBox && (node.traceElement as Var).value.kind !== 'NullVal') {
        if ((node.childDataStructureGraphNodes[0].traceElement as HeapArray).type.endsWith('[][]') || (node.traceElement as Var).type.endsWith('[][]')) {
          const cellWidth = Math.max(...node.childDataStructureGraphNodes[0].childDataStructureGraphNodes.map(child => getCellWidth(child, component.minCellWidth)))
          const maxLength = Math.max(...node.childDataStructureGraphNodes[0].childDataStructureGraphNodes.map(child => child.childDataStructureGraphNodes.length))
          const parentDimensions: [number, number] = [node.childDataStructureGraphNodes[0].childDataStructureGraphNodes.length, maxLength]
          const twoDimArrayBox: TwoDimArrayBox = {
            ...node.childDataStructureGraphNodes[0],
            kind: 'TwoDimArrayBox',
            row: index - ignored,
            cellWidth,
            dimensions: parentDimensions,
            childDataStructureGraphNodes: node.childDataStructureGraphNodes[0].childDataStructureGraphNodes.map((child, i, _): TwoDimArrayRowBox => {
              return {
                ...child,
                kind: 'TwoDimArrayRowBox',
                parentArrayBox: undefined,
                rowIndex: i,
                row: index - ignored,
                cellWidth,
                parentDimensions
              }
            })
          }
          twoDimArrayBox.childDataStructureGraphNodes.forEach(child => {
            child.parentArrayBox = twoDimArrayBox
          })
          arrayBoxes.push(...twoDimArrayBox.childDataStructureGraphNodes)
          arrayBoxes.push(twoDimArrayBox)
          arrayBox = twoDimArrayBox
        } else {
          arrayBox = {
            ...node.childDataStructureGraphNodes[0],
            kind: 'OneDimArrayBox',
            dimensions: [node.childDataStructureGraphNodes[0].childDataStructureGraphNodes.length],
            row: index - ignored,
            cellWidth: getCellWidth(node.childDataStructureGraphNodes[0], component.minCellWidth)
          }
          arrayBoxes.push(arrayBox)
        }
      }
      variableToArrayPointers.push({
        targetArrayBox: arrayBox,
        name: node.label,
        row: index - ignored,
        isNull: (node.traceElement as Var).value.kind === 'NullVal',
        // Same identifier as in the Memory View, e.g. `local_0_arr`.
        sourceVariableIdentifier: rootVariableIdentifier(node.traceElement as Var, node.stackFrameNumber),
        sourceDataStructureGraphNode: node,
        changed: (node.traceElement as Var).changed
      })
    })
  return { arrayBoxes, variableToArrayPointers }
}

export function createRowYCoordinates (variableToArrayPointers: VariableToArrayPointer[], arrayBoxes: ArrayBox[]) {
  const rowYCoordinates: number[] = []
  let lastY = LAYOUT.yOrigin + LAYOUT.arrays.yOrigin
  variableToArrayPointers
    .slice()
    .sort((a, b) => a.row - b.row)
    .forEach(pointer => {
      rowYCoordinates.push(lastY)
      const arrayBox = arrayBoxes.find(array => array.row === pointer.row)
      if (arrayBox?.kind === 'TwoDimArrayRowBox') {
        lastY += arrayBox.parentDimensions[0] * SVG.cellHeight
      } else {
        lastY += SVG.cellHeight
      }
      lastY += LAYOUT.arrays.distanceBetween
    })
  return rowYCoordinates
}

export function createIndexLabels (
  arrayBoxes: ArrayBox[],
  rootDataStructureGraphNode: DataStructureGraphNode,
  ghostIndexLabelCandidates: GhostIndexLabelCandidate[],
  component: { parsedIndexLabelSettings: ParsedIndexLabelSetting[] }
) {
  const indexLabels: IndexLabel[] = []
  component.parsedIndexLabelSettings
    .filter(index => !index.isHidden && index.isValid)
    .forEach(parsedIndexLabelSetting => {
      const validParsedIndexLabelSetting = parsedIndexLabelSetting as ValidParsedIndexLabelSetting

      const indexedArrayBoxes: ArrayBox[] = []
      if (validParsedIndexLabelSetting.arrayBox) {
        indexedArrayBoxes.push(validParsedIndexLabelSetting.arrayBox)
      } else if (validParsedIndexLabelSetting.arrayName === REGEX.arrayWildcard) {
        indexedArrayBoxes.push(...arrayBoxes)
      } else {
        for (let i = arrayBoxes.length - 1; i >= 0; i--) {
          if (arrayBoxes[i].parentDataStructureGraphNodes?.find(par => par.label === validParsedIndexLabelSetting.arrayName)) {
            indexedArrayBoxes.push(arrayBoxes[i])
          }
        }
      }

      validParsedIndexLabelSetting.variableNames.forEach((variableName, i) => {
        if (variableName === '*') {
          return
        }
        // find variable
        const variable = rootDataStructureGraphNode.childDataStructureGraphNodes.slice().reverse()
          .find(child => child.label === variableName)
        if (!variable || (variable.traceElement as Var).value.kind !== 'PrimitiveVal') {
          return
        }
        // convert value of variable to number
        const value = +(((variable.traceElement as Var).value as PrimitiveVal).primitiveValue)
        if (!Number.isInteger(value)) {
          return
        }
        // add index labels
        indexedArrayBoxes
          .filter(array => array.kind !== 'TwoDimArrayRowBox')
          .forEach(array => {
            const arrayBox = i > 0 ? (array as TwoDimArrayBox).childDataStructureGraphNodes[0] : array
            if (arrayBox) {
              addIndexLabel(indexLabels, { arrayBox, text: variableName, cellIndex: value, changed: (variable.traceElement as Var).changed, isGhost: false })
            }
          })
      })
    })
  ghostIndexLabelCandidates.forEach(ghostIndexLabelCandidate => {
    if (!indexLabels.find(indexLabel => indexLabel.text === ghostIndexLabelCandidate.text &&
      (indexLabel.arrayBox.traceElement as HeapArray).id === (ghostIndexLabelCandidate.arrayBox.traceElement as HeapArray).id)) {
      addIndexLabel(
        indexLabels,
        { arrayBox: ghostIndexLabelCandidate.arrayBox, text: ghostIndexLabelCandidate.text, cellIndex: ghostIndexLabelCandidate.cellIndex, changed: false, isGhost: true }
      )
    }
  })
  return indexLabels
}

function handleSourceVariables (
  arrayAccessValue: ArrayAccessValue,
  stackFrameNumber: number,
  arrayBox: ArrayBox,
  structures: {
    temporaryVariableBoxes: TemporaryVariableBox[],
    copyAnimationGroup: CopyAnimationGroup,
    vanishedSourceVariables: VanishedSourceVariable[],
    staticViz: Selection<BaseType, unknown, HTMLElement, any>,
  }
) {
  arrayAccessValue.arrayAccess.assignmentSourceVariableNames.forEach(sourceVariableName => {
    const sourceTemporaryVariableBox = structures.temporaryVariableBoxes.find(temporaryVariableBox =>
      temporaryVariableBox.variableDataStructureGraphNode.label === sourceVariableName &&
      temporaryVariableBox.variableDataStructureGraphNode.stackFrameNumber === stackFrameNumber)
    if (arrayBox) {
      const targetArrayBox = getAnimationArray(arrayAccessValue, arrayBox)
      const indexTo = arrayAccessValue.indexValues[0]
      if (sourceTemporaryVariableBox) {
        visualizeValueCopy(
          structures.copyAnimationGroup,
          structures.staticViz,
          { source: sourceTemporaryVariableBox, target: targetArrayBox, isWholeArrayCopy: false },
          { target: indexTo }
        )
      } else {
        structures.vanishedSourceVariables.unshift({
          variableName: sourceVariableName,
          stackFrameNumber,
          targetCell: getCoordinatesAndWidth(targetArrayBox, false, indexTo)
        })
      }
    }
  })
}

function handleTargetAccess (
  targetInfo: {
    dimension: number, arrayBox: ArrayBox, arrayAccessValue: ArrayAccessValue, indexExpression: IndexExpression
  },
  ghostIndexLabelCandidates: GhostIndexLabelCandidate[],
  changeCoordinates?: [number, number]
) {
  const ghostIndexLabelCandidate: GhostIndexLabelCandidate = {
    arrayBox: targetInfo.dimension === 0 && targetInfo.arrayAccessValue.indexValues.length > 1
      ? (targetInfo.arrayBox as TwoDimArrayBox).childDataStructureGraphNodes[0]
      : targetInfo.arrayBox,
    text: targetInfo.indexExpression.expression,
    cellIndex: targetInfo.arrayAccessValue.indexValues[targetInfo.dimension]
  }

  ghostIndexLabelCandidates.push(ghostIndexLabelCandidate)

  return changeCoordinates ?? getIndexCoordinates(ghostIndexLabelCandidate)
}

function addArrayTargetAnimation (
  targetArrayAccess: ArrayAccessTarget,
  source: {
    arrayBox: ArrayBox,
    animationArrayBox: ArrayBox,
    accessValue: ArrayAccessValue
  },
  structures: {
    arrayBoxes: ArrayBox[],
    stackFrame: StackFrame,
    copyAnimationGroup: CopyAnimationGroup,
    staticViz: Selection<BaseType, unknown, HTMLElement, any>
  }
) {
  // find target access
  const targetAccessValue = structures.stackFrame.arrayAccessValues.find((access: ArrayAccessValue) => access.arrayAccess.id === targetArrayAccess.id)
  const targetArrayBox = structures.arrayBoxes.find(array => (array.traceElement as HeapArray).id === targetAccessValue?.arrayObjectId)
  if (targetAccessValue && targetArrayBox) {
    visualizeValueCopy(
      structures.copyAnimationGroup,
      structures.staticViz,
      {
        source: getAnimationArray(source.accessValue, source.arrayBox),
        target: getAnimationArray(targetAccessValue, targetArrayBox),
        isWholeArrayCopy: source.animationArrayBox.kind === 'TwoDimArrayBox' && source.accessValue.indexValues.length === 1
      },
      { source: source.accessValue.indexValues[0], target: targetAccessValue.indexValues[0] }
    )
  }
}

function addVariableTargetAnimation (
  targetName: string,
  stackFrameNumber: number,
  source: {
    arrayBox: ArrayBox,
    arrayAccessValue: ArrayAccessValue
  },
  structures: {
    temporaryVariableBoxes: TemporaryVariableBox[],
    copyAnimationGroup: CopyAnimationGroup,
    staticViz: Selection<BaseType, unknown, HTMLElement, any>
  },
  changeCoordinates?: [number, number]
) {
  const targetTemporaryVariableBox = structures.temporaryVariableBoxes.find(temporaryVariableBox => temporaryVariableBox.variableDataStructureGraphNode.label === targetName &&
    temporaryVariableBox.variableDataStructureGraphNode.stackFrameNumber === stackFrameNumber)
  if (targetTemporaryVariableBox) {
    visualizeValueCopy(
      structures.copyAnimationGroup,
      structures.staticViz,
      {
        source: getAnimationArray(source.arrayAccessValue, source.arrayBox),
        target: targetTemporaryVariableBox,
        isWholeArrayCopy: source.arrayBox.kind === 'TwoDimArrayBox' && source.arrayAccessValue.indexValues.length === 1
      },
      { source: source.arrayAccessValue.indexValues[0] }
    )
  }

  return changeCoordinates ?? targetTemporaryVariableBox?.coordinates
}

export function createGhostIndexLabelsAndCopyAnimations (
  arrayBoxes: ArrayBox[],
  temporaryVariableBoxes: TemporaryVariableBox[],
  viz: Selection<BaseType, unknown, HTMLElement, any>,
  component: { traceState?: ProcessedTraceState }
) {
  const ghostIndexLabelCandidates: GhostIndexLabelCandidate[] = []
  let changeCoordinates: [number, number] | undefined

  const staticViz = viz.select(`#${HTML.ids.arrayWriteAccesses.static}`)
  const movingLayerSelection = viz.select(`#${HTML.ids.arrayWriteAccesses.moving}`)
  const copyAnimationGroup: CopyAnimationGroup = { duration: 0, movingLayerSelection, copyAnimations: [] }
  blendOutAnimation(staticViz.selectAll(`.${HTML.classes.highlightedCells.sources}, .${HTML.classes.highlightedCells.targets}`))

  const vanishedSourceVariables: VanishedSourceVariable[] = []

  if (component.traceState) {
    for (let i = 0; i < component.traceState.stackAfterExecution.length; i++) {
      const stackFrame: StackFrame = component.traceState.stackAfterExecution[i]
      stackFrame.arrayAccessValues
        .filter(arrayAccessValue => arrayAccessValue.evaluated)
        .forEach(arrayAccessValue => {
          const arrayBox = arrayBoxes.find(array => (array.traceElement as HeapArray).id === arrayAccessValue.arrayObjectId)
          if (!arrayBox) {
            return
          }

          const stackFrameNumber = component.traceState!.stackAfterExecution.length - 1 - i

          handleSourceVariables(
            arrayAccessValue,
            stackFrameNumber,
            arrayBox,
            { temporaryVariableBoxes, copyAnimationGroup, vanishedSourceVariables, staticViz }
          )

          arrayAccessValue.arrayAccess.indexExpressions.forEach((indexExpression, j) => {
            if (arrayAccessValue.arrayAccess.isWrittenTo) {
              changeCoordinates = handleTargetAccess(
                { dimension: j, arrayAccessValue, arrayBox, indexExpression },
                ghostIndexLabelCandidates,
                changeCoordinates
              )
            } else {
              const sourceArrayBox = j === 0 && arrayAccessValue.indexValues.length > 1
                ? (arrayBox as TwoDimArrayBox).childDataStructureGraphNodes[0]
                : arrayBox

              const target = arrayAccessValue.arrayAccess.assignmentTarget
              if (target && target.kind === 'ArrayAccessTarget' && sourceArrayBox && j === 0) {
                addArrayTargetAnimation(
                  target,
                  { arrayBox, animationArrayBox: sourceArrayBox, accessValue: arrayAccessValue },
                  { arrayBoxes, stackFrame, copyAnimationGroup, staticViz }
                )
              } else if (target && target.kind === 'VariableTarget' && j === 0) {
                changeCoordinates = addVariableTargetAnimation(
                  target.name,
                  stackFrameNumber,
                  { arrayBox, arrayAccessValue },
                  { temporaryVariableBoxes, copyAnimationGroup, staticViz },
                  changeCoordinates
                )
              }

              if (sourceArrayBox) {
                ghostIndexLabelCandidates.push({
                  arrayBox: sourceArrayBox,
                  text: indexExpression.expression,
                  cellIndex: arrayAccessValue.indexValues[j]
                })
              }
            }
          })
        })
    }
  }
  return { ghostIndexLabelCandidates, copyAnimationGroup, changeCoordinates, vanishedSourceVariables }
}

export function detectArrayAccesses (
  arrayBoxes: ArrayBox[],
  hiddenIndexLabelSettings: IndexLabelSetting[],
  component: { traceState?: ProcessedTraceState, indexLabelSettings: IndexLabelSetting[], parsedIndexLabelSettings: Readonly<Ref<ParsedIndexLabelSetting[]>> }
) {
  if (component.traceState) {
    let nrOfDetected = 0

    component.traceState.stackAfterExecution.forEach(stackFrame => {
      stackFrame.arrayAccessValues
        .forEach((arrayAccessValue: ArrayAccessValue) => {
          const accessedArrayBox = arrayBoxes.find(array => (array.traceElement as HeapArray).id === arrayAccessValue.arrayObjectId)
          if (!accessedArrayBox) {
            return
          }

          arrayAccessValue.arrayAccess.indexExpressions.forEach((indexExpression, i) => {
            if (!indexExpression.isVariable) {
              return
            }

            let arrayBox: ArrayBox = accessedArrayBox
            if (i === 0 && arrayAccessValue.indexValues.length > 1) {
              if (arrayBox.kind !== 'TwoDimArrayBox') {
                return
              }
              arrayBox = arrayBox.childDataStructureGraphNodes[0]
            }

            const name = accessedArrayBox.label
            const index = arrayAccessValue.arrayAccess.indexExpressions.length - 1 - i
            const indexInSettings = component.parsedIndexLabelSettings.value
              .find(idx => idx.isValid &&
                checkIndexCoverage(idx, { arrayName: name, variableNames: index === 0 ? [indexExpression.expression] : [REGEX.arrayWildcard, indexExpression.expression] }))
            if (arrayBox && !indexInSettings) {
              const expression = formatIndexLabelExpression(name, indexExpression.expression, index)
              component.indexLabelSettings.splice(
                nrOfDetected,
                0,
                { expression, arrayBox: accessedArrayBox, isDetected: true, isHidden: !!hiddenIndexLabelSettings.find(idx => idx.expression === expression) }
              )
              nrOfDetected++
            }
          })
        })
    })
  }
}
