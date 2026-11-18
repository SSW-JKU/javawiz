// appends a rectangle and a text per field, lines between the fields and, if needed, the arrow to the value object box for each list node box
import { BaseType, select, Selection } from 'd3-selection'
import { ListNodeBox, VariableToListNodePointer, NextFieldPointer, ValueObjectBox } from './types'
import { HTML, LAYOUT } from './constants'
import {
  calculateColumnXCoordinate, calculateRowYCoordinate,
  calculateXDistanceToValueObjectBox,
  calculateYDistanceToValueObjectBox,
  getListNodeBoxCoordinates,
  getValueObjectBoxCoordinates,
  joinFieldTexts
} from './node-utils'
import { HeapObject, Var } from '@/dto/TraceState'
import { DEFINITIONS } from '@/helpers/SvgDefinitions'
import {
  calculateNextFieldPointerXOffset,
  calculateNextFieldPointerYOffset,
  getNextFieldPointerCoordinates,
  nextLineAttributes,
  updateNextLineAttributes
} from './next-field-pointer-utils'
import { getPointerCoordinates, getPointerLength, getPointerTextWidth, getPointerTextYOffset } from './pointer-utils'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getNodeString, isFieldChanged } from '../data-structure-graph-node-utils'
import { getPointerDescription, getSimpleParentDescription } from '../description-utils'
import { HoverInfo } from '@/hover/types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { createHoverField } from '@/hover/hoverinfo-builder'
import { createRootVariableHover, idOfOwningHeapObject, isField } from '../pointer-hover'
import { getListNodeHoverInfo, isHighlighted, isHighlightedNextFieldPointer, isHighlightedNodeRefField, isHighlightedRef, onHover } from './hover'
import { TRANSFORMATION } from '@/helpers/constants'
import { heapItemIdentifier } from '@/identifiers/trace-identifiers'

export function appendListNodeBoxFieldRects (
  group: Selection<SVGGElement, ListNodeBox, BaseType, unknown>,
  component: { valName: string, nextName: string }
) {
  // append rectangle for each field
  group
    .selectAll('rect')
    .data(d => d.dataStructureGraphNode?.childDataStructureGraphNodes ?? [])
    .enter()
    .append('rect')
    .attr('width', SVG.cellWidth)
    .attr('height', SVG.cellHeight)
    .attr('y', (_d, i) => i * SVG.cellHeight)
  // append separating lines for fields
  group.append('g')
    .classed(HTML.classes.nodes.lineGroup, true)
    .selectAll('line')
    .data(d => d.dataStructureGraphNode ? d.dataStructureGraphNode.childDataStructureGraphNodes : [])
    .enter()
    .filter((_, i) => i > 0) // filter one line, since there is one child more than lines needed
    .append('line')
    .attr('x1', 0)
    .attr('x2', SVG.cellWidth)
    .attr('y1', (_, i) => (i + 1) * SVG.cellHeight)
    .attr('y2', (_, i) => (i + 1) * SVG.cellHeight)

  // append group for text
  joinFieldTexts(group.append('g')
    .classed(HTML.classes.nodes.textGroup, true), component)

  // hover synchronization of the value text
  group.selectAll(`.${HTML.classes.valueText}`)
    .on('mouseenter', (_event, d) => {
      const currentNode = d as any
      const heapObject = currentNode.parent.traceElement as HeapObject
      const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.label)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  // hover synchronization of the field text
  group.selectAll(`.${HTML.classes.fieldText}`)
    .on('mouseenter', (_event, d) => {
      const currentNode = d as any
      const heapObject = currentNode.parent.traceElement as HeapObject
      const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.label)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  // append arrow to the value object box
  group.filter(d => !!d.valueObjectBox)
    .append('line')
    .classed(HTML.classes.nodes.valueArrow, true)
    .attr('x1', SVG.cellWidth / 2)
    .attr('x2', d => calculateXDistanceToValueObjectBox(d))
    .attr('y1', d => d.height - LAYOUT.nodes.valuePointerYOffset)
    .attr('y2', d => calculateYDistanceToValueObjectBox(d))
    .classed(HTML.classes.changed, d => !!(d.dataStructureGraphNode?.traceElement as HeapObject).fields.find(field => field.name === component.valName)?.changed)
    .attr('marker-start', DEFINITIONS.urls.redDot)
    .attr('marker-end', DEFINITIONS.urls.redArrow)
}

export function drawListNodeBoxes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  listNodeBoxes: ListNodeBox[],
  component: { valName: string, nextName: string},
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.listNodes}`)
    .selectAll(`.${HTML.classes.nodes.group}`)
    .data(listNodeBoxes, (d: any) => (d?.dataStructureGraphNode.traceElement as HeapObject).id)
    .join(
      entered => {
        const group = entered
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.nodes}-${heapItemIdentifier(d.dataStructureGraphNode?.traceElement as HeapObject)}`)
          .attr('transform', d => `translate(${getListNodeBoxCoordinates(d)})`)
          .classed(HTML.classes.nodes.group, true)
          .classed(HTML.classes.changed, true)
        blendInAnimation(group)
        appendListNodeBoxFieldRects(group, component)
        return group
      },
      updated => {
        updated
          .style('opacity', '1')
          .classed(HTML.classes.changed, false)
          .classed(HTML.classes.highlighted.ref, d => isHighlightedRef(hoveredInfos.filter(info => info.kind === 'HeapObject'), d))
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getListNodeBoxCoordinates(d)})`)
        updated
          .selectAll('rect')
          .classed(HTML.classes.highlighted.field, d => {
            const field = ((d as DataStructureGraphNode).traceElement! as Var)
            return isHighlightedNodeRefField(hoveredInfos, field.heapObjectId!, field.name)
          })
        // update the arrow to the value object box
        updated.select(`.${HTML.classes.nodes.valueArrow}`)
          .classed(HTML.classes.changed, d => isFieldChanged(d.dataStructureGraphNode, -1))
          .classed(HTML.classes.highlighted.pointer, d => isHighlighted(hoveredInfos, d))
          .attr('marker-start', d => isHighlighted(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : isFieldChanged(d.dataStructureGraphNode, -1)
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : isFieldChanged(d.dataStructureGraphNode, -1)
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x2', d => (d.valueObjectBox ? getValueObjectBoxCoordinates(d.valueObjectBox)[0] : 0) - calculateColumnXCoordinate(d.column) + SVG.cellWidth / 2)
          .attr('y2', d => (d.valueObjectBox ? getValueObjectBoxCoordinates(d.valueObjectBox)[1] : 0) - calculateRowYCoordinate(d.row))
        // update fields
        joinFieldTexts(updated.select(`.${HTML.classes.nodes.textGroup}`), component)
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawValueObjectBoxes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  valueObjectBoxes: ValueObjectBox[],
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.listNodes}`)
    .selectAll(`.${HTML.classes.nodes.referenceGroup}`)
    .data(valueObjectBoxes, (d: any) => (d?.dataStructureGraphNode.traceElement as HeapObject).id)
    .join(
      entered => {
        const group = entered
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.reference}-${heapItemIdentifier(d.dataStructureGraphNode.traceElement as HeapObject)}`)
          .attr('transform', d => `translate(${getValueObjectBoxCoordinates(d)})`)
          .classed(HTML.classes.nodes.referenceGroup, true)
          .classed(HTML.classes.changed, true)
        blendInAnimation(group)
        // create group for node
        const nodeGroup = group.append('g')
          .attr('id', HTML.classes.nodes.group)
        // append rectangle for each field of the value object
        nodeGroup
          .selectAll('rect')
          .data(d => (d.dataStructureGraphNode.traceElement as HeapObject).fields)
          .enter()
          .append('rect')
          .attr('y', (_, i) => SVG.cellHeight * i)
          .attr('width', SVG.cellWidth)
          .attr('height', SVG.cellHeight)
        // append separating lines for fields
        nodeGroup.append('g')
          .classed(HTML.classes.nodes.lineGroup, true)
          .selectAll('line')
          .data(d => d.dataStructureGraphNode.childDataStructureGraphNodes)
          .enter()
          .filter((_, i) => i > 0) // filter one line, since there is one child more than lines needed
          .append('line')
          .attr('x1', 0)
          .attr('x2', SVG.cellWidth)
          .attr('y1', (_, i) => (i + 1) * SVG.cellHeight)
          .attr('y2', (_, i) => (i + 1) * SVG.cellHeight)

        // append group for text
        nodeGroup
          .append('g')
          .classed(HTML.classes.nodes.textGroup, true)
          .selectAll('foreignObject')
          // like the update branch: each row knows its value object, for the text and the hover info
          .data(d => d.dataStructureGraphNode.childDataStructureGraphNodes.map(node => ({ ...node, parent: d.dataStructureGraphNode })))
          .enter()
          .append('foreignObject')
          .attr('x', 0)
          .attr('y', (_, i) => i * SVG.cellHeight + LAYOUT.nodes.fieldTextYOffset)
          .attr('width', SVG.cellWidth)
          .attr('height', SVG.cellHeight - LAYOUT.nodes.fieldTextYOffset)
          .append('xhtml:div')
          .classed(HTML.classes.valueText, true)
          .text(d => getNodeString(d))
          .attr('title', d => getNodeString(d))
          .on('mouseenter', (_event, d) => {
            const currentNode = d as any
            const heapObject = currentNode.parent.traceElement as HeapObject
            const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.label)
            onHover(hoverInfos)
          })
          .on('mouseleave', () => HoverSynchronizer.clear())
        return group
      },
      updated => {
        updated
          .classed(HTML.classes.changed, false)
          .classed(HTML.classes.highlighted.ref, d => isHighlightedRef(hoveredInfos, d))
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getValueObjectBoxCoordinates(d)})`)
        updated
          .select(`.${HTML.classes.nodes.textGroup}`)
          .selectAll('foreignObject')
          .data(d => d.dataStructureGraphNode.childDataStructureGraphNodes.map(node => {
            return { ...node, parent: d.dataStructureGraphNode }
          }))
          .join(
            // no children will get added
            enter => enter,
            updated => updated.select('div')
              .classed(HTML.classes.changed, (d, i) => isFieldChanged(d.parent, i))
              .text(d => getNodeString(d))
              .attr('title', d => getNodeString(d)),
            removed => removed.remove()
          )
        // each rectangle is bound to its field; the object ID comes from the value box itself
        updated.each(function(valueObjectBox) {
          const heapObject = valueObjectBox.dataStructureGraphNode.traceElement as HeapObject
          select(this).selectAll<SVGRectElement, Var>('rect')
            .classed(HTML.classes.highlighted.field, field => isHighlightedNodeRefField(hoveredInfos, heapObject.id, field.name))
        })
        return updated
      },
      removed => blendOutAnimation(removed)
    )
  return valueObjectBoxes.length > 0
}

export function drawNextFieldPointers (svg: Selection<BaseType, unknown, HTMLElement, any>, nextFieldPointers: NextFieldPointer[], hoveredInfos: HoverInfo[]) {
  svg.select(`#${HTML.ids.nextPointers}`)
    .selectAll('g')
    .data(nextFieldPointers, (nextFieldPointer: any) => (nextFieldPointer?.sourceListNodeBox.dataStructureGraphNode.traceElement as HeapObject).id)
    .on('mouseenter', (_event, d) => {
      if (d.sourceListNodeBox.dataStructureGraphNode) {
        const currentNode = d.sourceListNodeBox.dataStructureGraphNode
        const hoverInfos = getListNodeHoverInfo(currentNode.traceElement as HeapObject, currentNode.label)
        onHover(hoverInfos)
      }
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
    .join(
      entered => {
        const group = entered.append('g')
          .attr('id', d => `${HTML.ids.prefixes.next}-${heapItemIdentifier(d.sourceListNodeBox.dataStructureGraphNode?.traceElement as HeapObject)}`)
          .classed(HTML.classes.changed, true)
          .attr(
            'transform',
            d => `translate(${getNextFieldPointerCoordinates(d)})`
          )
        blendInAnimation(group)
        // normal pointer line, always visible
        const line = group.append('line')
        nextLineAttributes(line)
        line.attr('id', HTML.ids.pointers.line)
          .attr('marker-start', d => isHighlightedNextFieldPointer(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, visible when the target box is not the placeholder of a null next field
        const arrowLine = group.append('line')
        nextLineAttributes(arrowLine)
        arrowLine.attr('id', HTML.ids.pointers.arrowLine)
          .attr('marker-end', d => isHighlightedNextFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.targetListNodeBox.dataStructureGraphNode ? '1' : '0')
        // null line, visible when the target box is the placeholder of a null next field
        group.append('line')
          .attr('id', HTML.ids.pointers.nullLine)
          .attr('x1', d => calculateNextFieldPointerXOffset(d))
          .attr('x2', d => calculateNextFieldPointerXOffset(d))
          .attr('y1', d => calculateNextFieldPointerYOffset(d) -
            LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y2', d => calculateNextFieldPointerYOffset(d) +
            LAYOUT.pointers.null.verticalLineLength / 2)
          .style('opacity', d => d.targetListNodeBox.dataStructureGraphNode ? '0' : '1')
        return group
      },
      updated => {
        updated
          .style('opacity', '1')
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlightedNextFieldPointer(hoveredInfos, d))
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', '1')
          .attr(
            'transform',
            d => `translate(${getNextFieldPointerCoordinates(d)})`
          )
        // update pointer line
        const pointerLine = updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlightedNextFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : d.changed
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
        updateNextLineAttributes(pointerLine)
        // update arrow line
        const arrowLine = updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlightedNextFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : d.changed
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
        updateNextLineAttributes(arrowLine)
          .style('opacity', d => d.targetListNodeBox.dataStructureGraphNode ? '1' : '0')
        // update null line
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x1', d => calculateNextFieldPointerXOffset(d))
          .attr('x2', d => calculateNextFieldPointerXOffset(d))
          .attr('y1', d => calculateNextFieldPointerYOffset(d) -
            LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y2', d => calculateNextFieldPointerYOffset(d) +
            LAYOUT.pointers.null.verticalLineLength / 2)
          .style('opacity', d => d.targetListNodeBox.dataStructureGraphNode ? '0' : '1')
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawVariablePointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  variableToListNodePointers: VariableToListNodePointer[],
  hoveredInfos: HoverInfo[]
) {
  // count how many pointers point to each node
  const pointerSpacingByTargetListNodeBox = new Map<ListNodeBox | null, {count: number, distance: number}>()
  let nullPointerCount = 0
  variableToListNodePointers.forEach(pointer => {
    if (pointer.targetListNodeBox) {
      if (pointerSpacingByTargetListNodeBox.has(pointer.targetListNodeBox)) {
        pointerSpacingByTargetListNodeBox.get(pointer.targetListNodeBox)!.count++
      } else {
        pointerSpacingByTargetListNodeBox.set(pointer.targetListNodeBox, { count: 1, distance: LAYOUT.pointers.distance })
      }
    } else if (pointer.targetColumn === -1) {
      nullPointerCount++
    }
  })
  // calculate pointer distances, if there are too many
  pointerSpacingByTargetListNodeBox.forEach(value => {
    if ((value.count - 1) * value.distance > SVG.cellWidth - 2 * LAYOUT.pointers.xOffset) {
      value.distance = (SVG.cellWidth - 2 * LAYOUT.pointers.xOffset) / (value.count - 1)
    }
  })
  // add distance for null-pointers
  pointerSpacingByTargetListNodeBox.set(null, {
    count: nullPointerCount,
    distance: (nullPointerCount - 1) * LAYOUT.pointers.distance > SVG.cellWidth - 2 * LAYOUT.pointers.xOffset
      ? SVG.cellWidth / (nullPointerCount - 1)
      : LAYOUT.pointers.distance
  })
  // draw pointers
  svg.select(`#${HTML.ids.nodePointers}`)
    // Typing the selection lets D3 type `d` in the key function and all callbacks below as VariableToListNodePointer.
    .selectAll<SVGGElement, VariableToListNodePointer>('g')
    .data(variableToListNodePointers, d => d.sourceVariableIdentifier)
    .join(
      entered => {
        const group = entered.append('g')
          .on('mouseenter', (_event, d) => {
            const node = d.targetListNodeBox?.dataStructureGraphNode
            const currNode = node?.traceElement as HeapObject

            // the currently hovered list node
            // hover/highlight the value field
            const hoverInfos = getListNodeHoverInfo(currNode)

            if (currNode) {
              // add the hovered pointer: a field of the list object or a variable
              hoverInfos.push(isField(d.sourceDataStructureGraphNode)
                ? createHoverField(idOfOwningHeapObject(d.sourceDataStructureGraphNode), d.name, currNode.id)
                : createRootVariableHover(d.sourceDataStructureGraphNode, currNode.id))
            }

            onHover(hoverInfos)
          })
          .on('mouseleave', () => HoverSynchronizer.clear())
          .classed(HTML.classes.changed, true)
          .attr(
            'transform',
            d => `translate(${getPointerCoordinates(d, pointerSpacingByTargetListNodeBox)})`
          )
          .attr('id', d => `${HTML.ids.prefixes.pointer}-${d.sourceVariableIdentifier}`)
        blendInAnimation(group)
        // normal pointer line, always visible
        group.append('line')
          .attr('id', HTML.ids.pointers.line)
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', d => getPointerLength(d))
          .attr('y2', 0)
          .attr('marker-start', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, only visible when not null
        group.append('line')
          .attr('id', HTML.ids.pointers.arrowLine)
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', d => getPointerLength(d))
          .attr('y2', 0)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedArrow : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.isNull ? '0' : '1')
        // pointer name
        group.append('foreignObject')
          .attr('id', HTML.ids.pointers.name)
          .classed(HTML.classes.pointers.text, true)
          .attr('x', d => -getPointerTextWidth(d, pointerSpacingByTargetListNodeBox) / 2)
          .attr('y', d => getPointerTextYOffset(d))
          .attr('width', d => getPointerTextWidth(d, pointerSpacingByTargetListNodeBox))
          .attr('height', LAYOUT.pointers.text.height)
          .append('xhtml:div')
          .classed(HTML.classes.pointers.name, true)
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // parent name
        group.filter(d => d.isListObjectField)
          .append('foreignObject')
          .attr('id', HTML.ids.pointers.parent)
          .classed(HTML.classes.pointers.text, true)
          .classed(HTML.classes.pointers.parent, true)
          .attr('x', d => -getPointerTextWidth(d, pointerSpacingByTargetListNodeBox) / 2)
          .attr('y', d => getPointerTextYOffset(d) - LAYOUT.pointers.text.parent.yOffset)
          .attr('width', d => getPointerTextWidth(d, pointerSpacingByTargetListNodeBox))
          .attr('height', LAYOUT.pointers.text.parent.height)
          .append('xhtml:div')
          .text(d => getSimpleParentDescription(d.sourceDataStructureGraphNode))
          .attr('title', d => getSimpleParentDescription(d.sourceDataStructureGraphNode))
        // null line, only visible when null
        group.append('line')
          .attr('x1', -LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('x2', LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y1', 0)
          .attr('y2', 0)
          .style('opacity', d => d.isNull ? '1' : '0')
          .attr('id', HTML.ids.pointers.nullLine)
        return group
      },
      updated => {
        // update group position
        const toReturn = updated
          .style('opacity', '1')
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlighted(hoveredInfos, d))
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr(
            'transform',
            d => `translate(${getPointerCoordinates(d, pointerSpacingByTargetListNodeBox)})`
          )
          .selection()
        // update pointer line
        updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : d.changed ? DEFINITIONS.urls.redDot : DEFINITIONS.urls.dot)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('y1', d => getPointerLength(d))
        // update arrow line
        updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedArrow : d.changed ? DEFINITIONS.urls.redArrow : DEFINITIONS.urls.arrow)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('y1', d => getPointerLength(d))
          .style('opacity', d => d.isNull ? '0' : '1')
        // update null-line visibility
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => d.isNull ? '1' : '0')
        // update name
        updated.select(`#${HTML.ids.pointers.name}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => -getPointerTextWidth(d, pointerSpacingByTargetListNodeBox) / 2)
          .attr('y', d => getPointerTextYOffset(d))
          .attr('width', d => getPointerTextWidth(d, pointerSpacingByTargetListNodeBox))
          .select('div')
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // update parent
        updated.select(`#${HTML.ids.pointers.parent}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => -getPointerTextWidth(d, pointerSpacingByTargetListNodeBox) / 2)
          .attr('y', d => getPointerTextYOffset(d) - LAYOUT.pointers.text.parent.yOffset)
          .attr('width', d => getPointerTextWidth(d, pointerSpacingByTargetListNodeBox))
          .select('div')
          .text(d => getSimpleParentDescription(d.sourceDataStructureGraphNode))
          .attr('title', d => getSimpleParentDescription(d.sourceDataStructureGraphNode))
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}
