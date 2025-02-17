import { BaseType, select, Selection } from 'd3-selection'
import { ArrayIndex, ArrayNode, ArrayPointer, CopyAnimations, MissingSource, TempVariable, TwoDimArrayChild } from './types'
import { GHOST_INDEXES, HTML, LAYOUT } from './constants'
import { Var } from '@/dto/TraceState'
import { animateAlongPath, highlightRectAttributes, updateDuration, visualizeValueCopy } from './animation'
import { getArrayCoordinates, getArrayName, getUniqueArrayString, joinDividerLines, joinElementTexts, joinIndexesAtArray } from './array-utils'
import { getPointerCoordinates, nullPointerLineAttributes, pointerLineAttributes, updatePointerLineAttributes } from './pointer-utils'
import { DEFINITIONS } from '@/helpers/SvgDefinitions.vue'
import { calculateIndexOffsetCoordinates, getIndexCoordinates, indexForeignObjectAttributes } from './index-utils'
import { curveBasis, line } from 'd3'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getNodeString } from '../heap-tree-node-utils'

import { getPointerDescription } from '../description-utils'
import { TRANSFORMATION } from '@/helpers/constants'

export function drawArrays (svg: Selection<BaseType, unknown, HTMLElement, any>, arrays: ArrayNode[]) {
  svg.select(`#${HTML.ids.arrays}`)
    .selectAll(`.${HTML.classes.nodes.group}`)
    .data(arrays, (d: any) => `${getUniqueArrayString((d as ArrayNode))}`)
    .join(
      entered => {
        // create group for node
        const group = entered
          .filter(d => d.kind !== 'TwoDimArrayNode')
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.arrays}-${getUniqueArrayString(d)}`)
          .attr('transform', d => `translate(${getArrayCoordinates(d)})`)
          .classed(HTML.classes.nodes.group, true)
        blendInAnimation(group)
        // append rectangle
        group.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', d => (d.children.length > 0 ? d.children.length : LAYOUT.arrays.cells.widthMultiplier.empty) * d.cellWidth)
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
        group.filter(d => d.kind === 'TwoDimArrayChild')
          .append('foreignObject')
          .classed(HTML.classes.indexes.number, true)
          .classed(HTML.classes.indexes.twoDim, true)
          .attr('x', d => (d as TwoDimArrayChild).parentDimensions[1] * d.cellWidth)
          .attr('y', 0)
          .attr('width', LAYOUT.indexes.row.text.width)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
          .text(d => (d as TwoDimArrayChild).indexInParent)
          .attr('title', d => (d as TwoDimArrayChild).indexInParent)
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
          .attr('width', d => (d.children.length > 0 ? d.children.length : LAYOUT.arrays.cells.widthMultiplier.empty) * d.cellWidth)
        // update lines
        joinDividerLines(updated.select(`.${HTML.classes.nodes.lines}`))
        // update indexes
        joinIndexesAtArray(updated.select(`.${HTML.classes.indexes.numbers}`))
        updated.select(`.${HTML.classes.indexes.twoDim}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => (d as TwoDimArrayChild).parentDimensions[1] * d.cellWidth)
          .select('div')
          .text(d => (d as TwoDimArrayChild).indexInParent)
          .attr('title', d => (d as TwoDimArrayChild).indexInParent)
        // update elements
        joinElementTexts(updated.select(`.${HTML.classes.textGroup}`))
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawPointers (svg: Selection<BaseType, unknown, HTMLElement, any>, pointers: ArrayPointer[]) {
  svg.select(`#${HTML.ids.arrayPointers}`)
    .selectAll(`.${HTML.classes.pointers.group}`)
    .data(pointers, (d: any) => d?.name + d?.methodOrParentId)
    .join(
      entered => {
        const group = entered.append('g')
          .attr('transform', d => `translate(${getPointerCoordinates(d)})`)
          .attr('id', d => `${HTML.ids.prefixes.pointers}-${d.name}-${d.methodOrParentId}`)
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

export function drawIndexes (svg: Selection<BaseType, unknown, HTMLElement, any>, indexes: ArrayIndex[]) {
  svg.select(`#${HTML.ids.arrayIndexes}`)
    .selectAll(`.${HTML.classes.indexes.group}`)
    .data(indexes, (d: any) => `${getArrayName(d?.array)} ${d?.name}`)
    .join(
      entered => {
        const group = entered
          .append('g')
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.indexes.group, true)
          .attr('transform', d => `translate(${getIndexCoordinates(d, true)})`)
          .attr('id', d => `${HTML.ids.prefixes.indexes}-${getArrayName(d.array)}-${d.name}`)
        blendInAnimation(group.filter(d => !d.isGhost))
        blendInAnimation(group.filter(d => d.isGhost), GHOST_INDEXES.opacity, GHOST_INDEXES.blendAnimation)
        const nameGroup = group.append('g')
          .attr('transform', d => `translate(${calculateIndexOffsetCoordinates(d)})`)
        // add arrow
        nameGroup.append('use').attr('href', DEFINITIONS.triangle)
          .filter(d => d.array.kind === 'TwoDimArrayNode')
          .attr('transform', 'rotate(90)')
        // add text
        const foreignObject = nameGroup.append('foreignObject')
          .classed(HTML.classes.indexes.text, true)
        indexForeignObjectAttributes(foreignObject)
        foreignObject.append('xhtml:div')
          .text(d => d.name)
          .attr('title', d => d.name)
          .filter(d => d.array.kind !== 'TwoDimArrayNode' && !d.rotated)
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
export function drawTempVariables (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  tempVariables: TempVariable[],
  missingSources: MissingSource[],
  copyAnimations: CopyAnimations
) {
  svg.select(`#${HTML.ids.tempVariables}`)
    .selectAll(`.${HTML.classes.tempVariables.group}`)
    .data(tempVariables, (d: any) => `${d?.variable.name}-${d?.variable.stackFrameDepth}`)
    .join(
      entered => {
        const group = entered.append('g')
          .attr('id', d => `${HTML.ids.prefixes.tempVariables}-${d.variable.name}-${d.variable.stackFrameDepth}`)
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
          .text(d => d.variable.name)
          .attr('title', d => d.variable.name)
        // append text for value
        group.append('foreignObject')
          .classed(HTML.classes.textGroup, true)
          .attr('x', LAYOUT.arrays.cells.padding)
          .attr('y', LAYOUT.arrays.cells.verticalTextOffset)
          .attr('width', d => d.cellWidth - 2 * LAYOUT.arrays.cells.padding)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
          .classed(HTML.classes.valueText, true)
          .classed(HTML.classes.changed, d => (d.variable.element as Var).changed)
          .text(d => getNodeString(d.variable))
          .attr('title', d => getNodeString(d.variable))
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
          .text(d => d.variable.name)
          .attr('title', d => d.variable.name)
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
          .classed(HTML.classes.changed, d => (d.variable.element as Var).changed)
          .text(d => getNodeString(d.variable))
          .attr('title', d => getNodeString(d.variable))
        return updated
      },
      removed => {
        const staticViz = select(`#${HTML.ids.arrayWriteAccesses.static}`)
        // handle if variables was used as source in last step
        const missingSourcesSelection = removed
          .each(d => {
            const sources = missingSources.filter(missingSource => missingSource.name === d.variable.name && missingSource.stackDepth === d.variable.stackFrameDepth)
            if (sources.length > 0) {
              d.missingSource = sources[0]
              updateDuration(
                d.coordinates,
                sources[0].target.coordinates,
                copyAnimations
              )

              for (let i = 1; i < sources.length; i++) {
                visualizeValueCopy(
                  copyAnimations,
                  staticViz,
                  { source: d, target: { kind: 'MissingSource', ...sources[i].target }, arrayCopy: false },
                  { }
                )
              }
            }
          })
          .filter(d => !!d.missingSource)
        // blend out variable name and value
        missingSourcesSelection.selectAll('foreignObject')
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', 0)
        // translate variable to target location and remove it afterward
        missingSourcesSelection
          .transition()
          .duration(copyAnimations.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${d.missingSource!.target.coordinates})`)
          .transition()
          .remove()
        // transition cell width to target cell width
        missingSourcesSelection.select('rect')
          .transition()
          .duration(copyAnimations.duration)
          .ease(TRANSFORMATION.ease)
          .attr('width', d => d.missingSource!.target.width)
        // blend out variables that where not used as source in last step
        blendOutAnimation(
          removed
            .filter(d => !d.missingSource)
        )
        return removed
      }
    )
}

export function animateValueCopies (copyAnimations: CopyAnimations) {
  copyAnimations.data.forEach(copyAnimation => {
    const coordinatesMiddle = [
      (copyAnimation.coordinatesFrom[0] + copyAnimation.coordinatesTo[0]) / 2,
      copyAnimation.coordinatesFrom[1] === copyAnimation.coordinatesTo[1]
        ? copyAnimation.coordinatesFrom[1] + LAYOUT.arrays.cells.copyInSameArrayYOffset
        : (copyAnimation.coordinatesFrom[1] + copyAnimation.coordinatesTo[1]) / 2
    ] as [number, number]

    const curve3 = line().curve(curveBasis)
    const points3: [number, number][] = [copyAnimation.coordinatesFrom, coordinatesMiddle, copyAnimation.coordinatesTo]
    const path = copyAnimations.movingViz.append('path')
      .attr('d', curve3(points3)!!)
      .attr('stroke', 'red')
      .attr('fill', 'none')
    copyAnimations.movingViz.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', copyAnimation.widthFrom)
      .attr('height', SVG.cellHeight)
      .attr('transform', 'translate(' + copyAnimation.coordinatesFrom + ')')
      .style('opacity', GHOST_INDEXES.opacity)
      .classed(HTML.classes.nodes.dividers, true)
      .transition()
      .ease(TRANSFORMATION.ease)
      .duration(copyAnimations.duration)
      .attr('width', copyAnimation.widthTo)
      .attrTween('transform', animateAlongPath(path))
      .transition()
      .remove()

    path.remove()
  })
}
