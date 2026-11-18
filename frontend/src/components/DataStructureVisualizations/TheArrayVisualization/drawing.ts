import { BaseType, select, Selection } from 'd3-selection'
import { IndexLabel, ArrayBox, VariableToArrayPointer, CopyAnimationGroup, VanishedSourceVariable, TemporaryVariableBox, TwoDimArrayRowBox } from './types'
import { GHOST_INDEXES, HTML, LAYOUT } from './constants'
import { Var } from '@/dto/TraceState'
import { animateAlongPath, highlightRectAttributes, updateDuration, visualizeValueCopy } from './animation'
import { getArrayCoordinates, getArrayName, getUniqueArrayString, joinDividerLines, joinElementTexts, joinIndexesAtArray } from './array-utils'
import { getPointerCoordinates, nullPointerLineAttributes, pointerLineAttributes, updatePointerLineAttributes } from './pointer-utils'
import { DEFINITIONS } from '@/helpers/SvgDefinitions'
import { calculateIndexOffsetCoordinates, getIndexCoordinates, indexForeignObjectAttributes } from './index-utils'
import { curveBasis, line } from 'd3'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getNodeString } from '../data-structure-graph-node-utils'

import { getPointerDescription } from '../description-utils'
import { TRANSFORMATION } from '@/helpers/constants'
import { rootVariableIdentifier } from '@/identifiers/trace-identifiers'

export function drawArrayBoxes (svg: Selection<BaseType, unknown, HTMLElement, any>, arrayBoxes: ArrayBox[]) {
  svg.select(`#${HTML.ids.arrays}`)
    .selectAll(`.${HTML.classes.nodes.group}`)
    .data(arrayBoxes, (d: any) => `${getUniqueArrayString((d as ArrayBox))}`)
    .join(
      entered => {
        // create group for node
        const group = entered
          .filter(d => d.kind !== 'TwoDimArrayBox')
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.arrays}-${getUniqueArrayString(d)}`)
          .attr('transform', d => `translate(${getArrayCoordinates(d)})`)
          .classed(HTML.classes.nodes.group, true)
        blendInAnimation(group)
        // append rectangle
        group.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', d => (d.childDataStructureGraphNodes.length > 0 ? d.childDataStructureGraphNodes.length : LAYOUT.arrays.cells.widthMultiplier.empty) * d.cellWidth)
          .attr('height', SVG.cellHeight)
        // append lines
        joinDividerLines(
          group
            .append('g')
            .classed(HTML.classes.nodes.lines, true)
            .classed(HTML.classes.nodes.dividers, true)
        )
        // append indexes horizontal
        joinIndexesAtArray(
          group
            .append('g')
            .classed(HTML.classes.indexes.numbers, true)
        )
        // append index for two-dim arrays
        group.filter(d => d.kind === 'TwoDimArrayRowBox')
          .append('foreignObject')
          .classed(HTML.classes.indexes.number, true)
          .classed(HTML.classes.indexes.twoDim, true)
          .attr('x', d => (d as TwoDimArrayRowBox).parentDimensions[1] * d.cellWidth)
          .attr('y', 0)
          .attr('width', LAYOUT.indexes.row.text.width)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
          .text(d => (d as TwoDimArrayRowBox).rowIndex)
          .attr('title', d => (d as TwoDimArrayRowBox).rowIndex)
        // append elements
        joinElementTexts(
          group
            .append('g')
            .classed(HTML.classes.textGroup, true)
        )
        return group
      },
      updated => {
        updated
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getArrayCoordinates(d)})`)
          .selection()
        // update rect
        updated.select('rect')
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => (d.childDataStructureGraphNodes.length > 0 ? d.childDataStructureGraphNodes.length : LAYOUT.arrays.cells.widthMultiplier.empty) * d.cellWidth)
        // update lines
        joinDividerLines(updated.select(`.${HTML.classes.nodes.lines}`))
        // update indexes
        joinIndexesAtArray(updated.select(`.${HTML.classes.indexes.numbers}`))
        updated.select(`.${HTML.classes.indexes.twoDim}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => (d as TwoDimArrayRowBox).parentDimensions[1] * d.cellWidth)
          .select('div')
          .text(d => (d as TwoDimArrayRowBox).rowIndex)
          .attr('title', d => (d as TwoDimArrayRowBox).rowIndex)
        // update elements
        joinElementTexts(updated.select(`.${HTML.classes.textGroup}`))
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawVariablePointers (svg: Selection<BaseType, unknown, HTMLElement, any>, variableToArrayPointers: VariableToArrayPointer[]) {
  svg.select(`#${HTML.ids.arrayPointers}`)
    // Typing the selection lets D3 type `d` in the key function and all callbacks below as VariableToArrayPointer.
    .selectAll<SVGGElement, VariableToArrayPointer>(`.${HTML.classes.pointers.group}`)
    .data(variableToArrayPointers, d => d.sourceVariableIdentifier)
    .join(
      entered => {
        const group = entered.append('g')
          .attr('transform', d => `translate(${getPointerCoordinates(d)})`)
          .attr('id', d => `${HTML.ids.prefixes.pointers}-${d.sourceVariableIdentifier}`)
          .classed(HTML.classes.pointers.group, true)
          .classed(HTML.classes.changed, d => d.changed)
        blendInAnimation(group)
        // add name of pointer
        group.append('foreignObject')
          .classed(HTML.classes.pointers.text, true)
          .attr('x', -LAYOUT.pointers.text.width - LAYOUT.pointers.text.xOffset)
          .attr('y', LAYOUT.pointers.text.yOffset)
          .attr('width', LAYOUT.pointers.text.width)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // add normal line, always visible
        const line = group.append('line')
          .attr('id', HTML.ids.pointers.line)
        pointerLineAttributes(line)
        // add arrow line, visible when not null
        const arrowLine = group.append('line')
          .attr('id', HTML.ids.pointers.arrowLine)
          .attr('marker-end', d => d.changed ? DEFINITIONS.urls.redArrow : DEFINITIONS.urls.arrow)
          .attr('opacity', d => d.isNull ? '0' : '1')
        pointerLineAttributes(arrowLine)
        // add null line, visible when null
        nullPointerLineAttributes(group.append('line').attr('id', HTML.ids.pointers.nullLine), false)
        return group
      },
      updated => {
        const toReturn = updated
          .style('opacity', 1)
          .classed(HTML.classes.changed, d => d.changed)
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getPointerCoordinates(d)})`)
          .selection()
        // update pointer line
        const pointerLine = updated.select(`#${HTML.ids.pointers.line}`)
        updatePointerLineAttributes(pointerLine)
        // update arrow line
        const arrowLine = updated.select(`#${HTML.ids.pointers.arrowLine}`)
        updatePointerLineAttributes(arrowLine)
          .attr('opacity', d => d.isNull ? '0' : '1')
          .attr('marker-end', d => d.changed ? DEFINITIONS.urls.redArrow : DEFINITIONS.urls.arrow)
        // update null line
        nullPointerLineAttributes(updated.select(`#${HTML.ids.pointers.nullLine}`), true)
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawIndexLabels (svg: Selection<BaseType, unknown, HTMLElement, any>, indexLabels: IndexLabel[]) {
  // Index labels are keyed by array name and label text (`i`, `i + 1`): they are expressions, not variables.
  svg.select(`#${HTML.ids.arrayIndexes}`)
    .selectAll(`.${HTML.classes.indexes.group}`)
    .data(indexLabels, (d: any) => `${getArrayName(d?.arrayBox)} ${d?.text}`)
    .join(
      entered => {
        const group = entered
          .append('g')
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.indexes.group, true)
          .attr('transform', d => `translate(${getIndexCoordinates(d, true)})`)
          .attr('id', d => `${HTML.ids.prefixes.indexes}-${getArrayName(d.arrayBox)}-${d.text}`)
        blendInAnimation(group.filter(d => !d.isGhost))
        blendInAnimation(group.filter(d => d.isGhost), GHOST_INDEXES.opacity, GHOST_INDEXES.blendAnimation)
        const nameGroup = group.append('g')
          .attr('transform', d => `translate(${calculateIndexOffsetCoordinates(d)})`)
        // add arrow
        nameGroup.append('use').attr('href', DEFINITIONS.triangle)
          .filter(d => d.arrayBox.kind === 'TwoDimArrayBox')
          .attr('transform', 'rotate(90)')
        // add text
        const foreignObject = nameGroup.append('foreignObject')
          .classed(HTML.classes.indexes.text, true)
        indexForeignObjectAttributes(foreignObject)
        foreignObject.append('xhtml:div')
          .text(d => d.text)
          .attr('title', d => d.text)
          .filter(d => d.arrayBox.kind !== 'TwoDimArrayBox' && !d.isRotated)
          .style('text-align', 'center')
        // add highlighting rectangle
        highlightRectAttributes(
          group.append('rect')
            .classed(HTML.classes.highlightedCells.group, true)
        )
        return group
      },
      // TODO generalize
      updated => {
        updated
          .filter(d => !d.isGhost)
          .style('opacity', '1')
          .classed(HTML.classes.changed, d => d.changed)
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr(
            'transform',
            d => `translate(${getIndexCoordinates(d, true)})`
          )
        updated
          .filter(d => d.isGhost)
          .interrupt()
          .style('opacity', '0')
          .classed(HTML.classes.changed, d => d.changed)
          .attr(
            'transform',
            d => `translate(${getIndexCoordinates(d, true)})`
          )
          .transition()
          .duration(GHOST_INDEXES.blendAnimation)
          .ease(TRANSFORMATION.ease)
          .style('opacity', GHOST_INDEXES.opacity)
        const nameGroup = updated.select('g')
        nameGroup
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${calculateIndexOffsetCoordinates(d)})`)
        indexForeignObjectAttributes(nameGroup.select('foreignObject'))
        highlightRectAttributes(
          updated.select(`.${HTML.classes.highlightedCells.group}`)
            .transition()
            .duration(GHOST_INDEXES.blendAnimation)
            .ease(TRANSFORMATION.ease)
        )
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}
/** The identifier of the local variable a temporary-variable box shows, the same as in the Memory View (e.g. `local_0_tmp`). */
function temporaryVariableBoxIdentifier (temporaryVariableBox: TemporaryVariableBox): string {
  return rootVariableIdentifier(temporaryVariableBox.variableDataStructureGraphNode.traceElement as Var, temporaryVariableBox.variableDataStructureGraphNode.stackFrameNumber)
}

export function drawTemporaryVariableBoxes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  temporaryVariableBoxes: TemporaryVariableBox[],
  vanishedSourceVariables: VanishedSourceVariable[],
  copyAnimationGroup: CopyAnimationGroup
) {
  svg.select(`#${HTML.ids.tempVariables}`)
    .selectAll(`.${HTML.classes.tempVariables.group}`)
    .data(temporaryVariableBoxes, (d: any) => temporaryVariableBoxIdentifier(d))
    .join(
      entered => {
        const group = entered.append('g')
          .attr('id', d => `${HTML.ids.prefixes.tempVariables}-${temporaryVariableBoxIdentifier(d)}`)
          .attr('transform', d => `translate(${d.coordinates})`)
          .classed(HTML.classes.tempVariables.group, true)
        blendInAnimation(group)
        // append rectangle
        group.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', d => d.cellWidth)
          .attr('height', SVG.cellHeight)
        // append text for name
        group.append('foreignObject')
          .classed(HTML.classes.tempVariables.text, true)
          .attr('x', 0)
          .attr('y', LAYOUT.tempVariables.nameYOffset)
          .attr('width', d => d.cellWidth)
          .attr('height', LAYOUT.tempVariables.height)
          .append('xhtml:div')
          .text(d => d.variableDataStructureGraphNode.label)
          .attr('title', d => d.variableDataStructureGraphNode.label)
        // append text for value
        group.append('foreignObject')
          .classed(HTML.classes.textGroup, true)
          .attr('x', LAYOUT.arrays.cells.padding)
          .attr('y', LAYOUT.arrays.cells.verticalTextOffset)
          .attr('width', d => d.cellWidth - 2 * LAYOUT.arrays.cells.padding)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
          .classed(HTML.classes.valueText, true)
          .classed(HTML.classes.changed, d => (d.variableDataStructureGraphNode.traceElement as Var).changed)
          .text(d => getNodeString(d.variableDataStructureGraphNode))
          .attr('title', d => getNodeString(d.variableDataStructureGraphNode))
        return group
      },
      updated => {
        updated
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${d.coordinates})`)
        // update rectangle
        updated.select('rect')
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => d.cellWidth)
        // update name text
        const nameObject = updated.select(`.${HTML.classes.tempVariables.text}`)
          .interrupt()
          .style('opacity', 1)
        nameObject
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => d.cellWidth)
        nameObject.select('div')
          .text(d => d.variableDataStructureGraphNode.label)
          .attr('title', d => d.variableDataStructureGraphNode.label)
        // update value text
        const valueObject = updated.select(`.${HTML.classes.textGroup}`)
          .interrupt()
          .style('opacity', 1)
        valueObject
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => d.cellWidth - 2 * LAYOUT.arrays.cells.padding)
        valueObject.select('div')
          .classed(HTML.classes.changed, d => (d.variableDataStructureGraphNode.traceElement as Var).changed)
          .text(d => getNodeString(d.variableDataStructureGraphNode))
          .attr('title', d => getNodeString(d.variableDataStructureGraphNode))
        return updated
      },
      removed => {
        const staticViz = select(`#${HTML.ids.arrayWriteAccesses.static}`)
        // handle if variables was used as source in last step
        const temporaryVariableBoxesWithVanishedSource = removed
          .each(d => {
            const matchingVanishedSourceVariables = vanishedSourceVariables.filter(vanishedSourceVariable =>
              vanishedSourceVariable.variableName === d.variableDataStructureGraphNode.label &&
              vanishedSourceVariable.stackFrameNumber === d.variableDataStructureGraphNode.stackFrameNumber)
            if (matchingVanishedSourceVariables.length > 0) {
              d.vanishedSourceVariable = matchingVanishedSourceVariables[0]
              updateDuration(
                d.coordinates,
                matchingVanishedSourceVariables[0].targetCell.coordinates,
                copyAnimationGroup
              )

              for (let i = 1; i < matchingVanishedSourceVariables.length; i++) {
                visualizeValueCopy(
                  copyAnimationGroup,
                  staticViz,
                  { source: d, target: { kind: 'VanishedSourceVariable', ...matchingVanishedSourceVariables[i].targetCell }, isWholeArrayCopy: false },
                  { }
                )
              }
            }
          })
          .filter(d => !!d.vanishedSourceVariable)
        // blend out variable name and value
        temporaryVariableBoxesWithVanishedSource.selectAll('foreignObject')
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', 0)
        // translate variable to target location and remove it afterward
        temporaryVariableBoxesWithVanishedSource
          .transition()
          .duration(copyAnimationGroup.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${d.vanishedSourceVariable!.targetCell.coordinates})`)
          .transition()
          .remove()
        // transition cell width to target cell width
        temporaryVariableBoxesWithVanishedSource.select('rect')
          .transition()
          .duration(copyAnimationGroup.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => d.vanishedSourceVariable!.targetCell.width)
        // blend out variables that where not used as source in last step
        blendOutAnimation(
          removed
            .filter(d => !d.vanishedSourceVariable)
        )
        return removed
      }
    )
}

export function animateValueCopies (copyAnimationGroup: CopyAnimationGroup) {
  copyAnimationGroup.copyAnimations.forEach(copyAnimation => {
    const coordinatesMiddle = [
      (copyAnimation.sourceCoordinates[0] + copyAnimation.targetCoordinates[0]) / 2,
      copyAnimation.sourceCoordinates[1] === copyAnimation.targetCoordinates[1]
        ? copyAnimation.sourceCoordinates[1] + LAYOUT.arrays.cells.copyInSameArrayYOffset
        : (copyAnimation.sourceCoordinates[1] + copyAnimation.targetCoordinates[1]) / 2
    ] as [number, number]

    const curve3 = line().curve(curveBasis)
    const points3: [number, number][] = [copyAnimation.sourceCoordinates, coordinatesMiddle, copyAnimation.targetCoordinates]
    const path = copyAnimationGroup.movingLayerSelection.append('path')
      .attr('d', curve3(points3)!)
      .attr('stroke', 'red')
      .attr('fill', 'none')
    copyAnimationGroup.movingLayerSelection.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', copyAnimation.sourceWidth)
      .attr('height', SVG.cellHeight)
      .attr('transform', 'translate(' + copyAnimation.sourceCoordinates + ')')
      .style('opacity', GHOST_INDEXES.opacity)
      .classed(HTML.classes.nodes.dividers, true)
      .transition()
      .ease(TRANSFORMATION.ease)
      .duration(copyAnimationGroup.duration)
      .attr('width', copyAnimation.targetWidth)
      .attrTween('transform', animateAlongPath(path))
      .transition()
      .remove()

    path.remove()
  })
}
