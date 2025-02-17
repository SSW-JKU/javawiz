// appends a rectangle, lines for fields and, if needed, a value node for each node
import { BaseType, Selection } from 'd3-selection'
import { ListNode, ListNodePointer, NextPointer, ReferenceNode } from './types'
import { HTML, LAYOUT } from './constants'
import {
  calculateNodesXCoordinate, calculateNodesYCoordinate,
  calculateXDistanceToReference,
  calculateYDistanceToReference,
  getNodeCoordinates,
  getReferenceNodeCoordinates,
  joinFieldTexts
} from './node-utils'
import { HeapObject, LocalVar, Var } from '@/dto/TraceState'
import { DEFINITIONS } from '@/helpers/SvgDefinitions.vue'
import {
  calculateNextPointerXOffset,
  calculateNextPointerYOffset,
  getNextPointerCoordinates,
  nextLineAttributes,
  updateNextLineAttributes
} from './next-pointer-utils'
import { getPointerCoordinates, getPointerLength, getPointerTextWidth, getPointerTextYOffset } from './pointer-utils'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getNodeString, isFieldChanged } from '../heap-tree-node-utils'
import { getPointerDescription, getSimpleParentDescription } from '../description-utils'
import { HoverInfo } from '@/hover/types'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HeapTreeNode } from '../heapBFS'
import { createHoverField, createHoverLocal } from '@/hover/hoverinfo-builder'
import { getListNodeHoverInfo, isHighlighted, isHighlightedNextPointer, isHighlightedNodeRefField, isHighlightedRef, onHover } from './hover'
import { TRANSFORMATION } from '@/helpers/constants'

export function appendNodeRect (
  group: Selection<SVGGElement, ListNode, BaseType, unknown>,
  component: { valName: string, nextName: string }
) {
  // append rectangle for each field
  group
    .selectAll('rect')
    .data(d => d.node?.children ?? [])
    .enter()
    .append('rect')
    .attr('width', SVG.cellWidth)
    .attr('height', SVG.cellHeight)
    .attr('y', (_d, i) => i * SVG.cellHeight)
  // append separating lines for fields
  group.append('g')
    .classed(HTML.classes.nodes.lineGroup, true)
    .selectAll('line')
    .data(d => d.node ? d.node.children : [])
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
      const heapObject = currentNode.parent.element as HeapObject
      const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.name)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  // hover synchronization of the field text
  group.selectAll(`.${HTML.classes.fieldText}`)
    .on('mouseenter', (_event, d) => {
      const currentNode = d as any
      const heapObject = currentNode.parent.element as HeapObject
      const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.name)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  // append arrow to referenceValue
  group.filter(d => !!d.referenceValue)
    .append('line')
    .classed(HTML.classes.nodes.valueArrow, true)
    .attr('x1', SVG.cellWidth / 2)
    .attr('x2', d => calculateXDistanceToReference(d))
    .attr('y1', d => d.height - LAYOUT.nodes.valuePointerYOffset)
    .attr('y2', d => calculateYDistanceToReference(d))
    .classed(HTML.classes.changed, d => !!(d.node?.element as HeapObject).fields.find(field => field.name === component.valName)?.changed)
    .attr('marker-start', DEFINITIONS.urls.redDot)
    .attr('marker-end', DEFINITIONS.urls.redArrow)
}

export function drawNodeRectangles (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  nodes: ListNode[],
  component: { valName: string, nextName: string},
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.listNodes}`)
    .selectAll(`.${HTML.classes.nodes.group}`)
    .data(nodes, (d: any) => (d?.node.element as HeapObject).id)
    .join(
      entered => {
        const group = entered
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.nodes}-${(d.node?.element as HeapObject).id}`)
          .attr('transform', d => `translate(${getNodeCoordinates(d)})`)
          .classed(HTML.classes.nodes.group, true)
          .classed(HTML.classes.changed, true)
        blendInAnimation(group)
        appendNodeRect(group, component)
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
          .attr('transform', d => `translate(${getNodeCoordinates(d)})`)
        updated
          .selectAll('rect')
          .classed(HTML.classes.highlighted.field, d => {
            const field = ((d as HeapTreeNode).element! as Var)
            return isHighlightedNodeRefField(hoveredInfos, field.heapObjectId!, field.name)
          })
        // update reference node arrow
        updated.select(`.${HTML.classes.nodes.valueArrow}`)
          .classed(HTML.classes.changed, d => isFieldChanged(d.node, -1))
          .classed(HTML.classes.highlighted.pointer, d => isHighlighted(hoveredInfos, d))
          .attr('marker-start', d => isHighlighted(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : isFieldChanged(d.node, -1)
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : isFieldChanged(d.node, -1)
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x2', d => (d.referenceValue ? getReferenceNodeCoordinates(d.referenceValue)[0] : 0) - calculateNodesXCoordinate(d.index) + SVG.cellWidth / 2)
          .attr('y2', d => (d.referenceValue ? getReferenceNodeCoordinates(d.referenceValue)[1] : 0) - calculateNodesYCoordinate(d.level))
        // update fields
        joinFieldTexts(updated.select(`.${HTML.classes.nodes.textGroup}`), component)
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawReferenceNodes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  referenceNodes: ReferenceNode[],
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.listNodes}`)
    .selectAll(`.${HTML.classes.nodes.referenceGroup}`)
    .data(referenceNodes, (d: any) => (d?.reference.element as HeapObject).id)
    .join(
      entered => {
        const group = entered
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.reference}-${(d.reference.element as HeapObject).id}`)
          .attr('transform', d => `translate(${getReferenceNodeCoordinates(d)})`)
          .classed(HTML.classes.nodes.referenceGroup, true)
          .classed(HTML.classes.changed, true)
        blendInAnimation(group)
        // create group for node
        const nodeGroup = group.append('g')
          .attr('id', HTML.classes.nodes.group)
        // append rectangle
        if (referenceNodes.length > 0) {
          for (let i = 0; i < referenceNodes[0].reference.depth; i++) {
            nodeGroup.append('rect')
              .attr('y', SVG.cellHeight * i)
              .attr('width', SVG.cellWidth)
              .attr('height', SVG.cellHeight)
          }
        }
        // append separating lines for fields
        nodeGroup.append('g')
          .classed(HTML.classes.nodes.lineGroup, true)
          .selectAll('line')
          .data(d => d.reference.children)
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
          .data(d => d.reference.children)
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
            const heapObject = currentNode.parent.element as HeapObject
            const hoverInfos = getListNodeHoverInfo(heapObject, currentNode.name)
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
          .attr('transform', d => `translate(${getReferenceNodeCoordinates(d)})`)
        updated
          .select(`.${HTML.classes.nodes.textGroup}`)
          .selectAll('foreignObject')
          .data(d => d.reference.children.map(node => {
            return { ...node, parent: d.reference }
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
        updated.selectAll('rect')
          .classed(HTML.classes.highlighted.field, (d, i) => {
            const currNode = (d as any).reference.element
            return isHighlightedNodeRefField(hoveredInfos, currNode.id, currNode.fields[i].name)
          })
        return updated
      },
      removed => blendOutAnimation(removed)
    )
  return referenceNodes.length > 0
}

export function drawNextPointers (svg: Selection<BaseType, unknown, HTMLElement, any>, nextPointers: NextPointer[], hoveredInfos: HoverInfo[]) {
  svg.select(`#${HTML.ids.nextPointers}`)
    .selectAll('g')
    .data(nextPointers, (nextPointer: any) => (nextPointer?.from.node.element as HeapObject).id)
    .on('mouseenter', (_event, d) => {
      if (d.from.node) {
        const currentNode = d.from.node
        const hoverInfos = getListNodeHoverInfo(currentNode.element as HeapObject, currentNode.name)
        onHover(hoverInfos)
      }
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
    .join(
      entered => {
        const group = entered.append('g')
          .attr('id', d => `${HTML.ids.prefixes.next}-${(d.from.node?.element as HeapObject).id}`)
          .classed(HTML.classes.changed, true)
          .attr(
            'transform',
            d => `translate(${getNextPointerCoordinates(d)})`
          )
        blendInAnimation(group)
        // normal pointer line, always visible
        const line = group.append('line')
        nextLineAttributes(line)
        line.attr('id', HTML.ids.pointers.line)
          .attr('marker-start', d => isHighlightedNextPointer(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, visible when to.node not null
        const arrowLine = group.append('line')
        nextLineAttributes(arrowLine)
        arrowLine.attr('id', HTML.ids.pointers.arrowLine)
          .attr('marker-end', d => isHighlightedNextPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.to.node ? '1' : '0')
        // null line, visible when to.node is null
        group.append('line')
          .attr('id', HTML.ids.pointers.nullLine)
          .attr('x1', d => calculateNextPointerXOffset(d))
          .attr('x2', d => calculateNextPointerXOffset(d))
          .attr('y1', d => calculateNextPointerYOffset(d) -
            LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y2', d => calculateNextPointerYOffset(d) +
            LAYOUT.pointers.null.verticalLineLength / 2)
          .style('opacity', d => d.to.node ? '0' : '1')
        return group
      },
      updated => {
        updated
          .style('opacity', '1')
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlightedNextPointer(hoveredInfos, d))
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', '1')
          .attr(
            'transform',
            d => `translate(${getNextPointerCoordinates(d)})`
          )
        // update pointer line
        const pointerLine = updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlightedNextPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : d.changed
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
        updateNextLineAttributes(pointerLine)
        // update arrow line
        const arrowLine = updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlightedNextPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : d.changed
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
        updateNextLineAttributes(arrowLine)
          .style('opacity', d => d.to.node ? '1' : '0')
        // update null line
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x1', d => calculateNextPointerXOffset(d))
          .attr('x2', d => calculateNextPointerXOffset(d))
          .attr('y1', d => calculateNextPointerYOffset(d) -
            LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y2', d => calculateNextPointerYOffset(d) +
            LAYOUT.pointers.null.verticalLineLength / 2)
          .style('opacity', d => d.to.node ? '0' : '1')
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawPointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  nodePointers: ListNodePointer[],
  hoveredInfos: HoverInfo[]
) {
  // count how many pointers point to each node
  const nodeToPointerDistance = new Map<ListNode | null, {count: number, distance: number}>()
  let nullPointerCount = 0
  nodePointers.forEach(pointer => {
    if (pointer.node) {
      if (nodeToPointerDistance.has(pointer.node)) {
        nodeToPointerDistance.get(pointer.node)!.count++
      } else {
        nodeToPointerDistance.set(pointer.node, { count: 1, distance: LAYOUT.pointers.distance })
      }
    } else if (pointer.nodeIndex === -1) {
      nullPointerCount++
    }
  })
  // calculate pointer distances, if there are too many
  nodeToPointerDistance.forEach(value => {
    if ((value.count - 1) * value.distance > SVG.cellWidth - 2 * LAYOUT.pointers.xOffset) {
      value.distance = (SVG.cellWidth - 2 * LAYOUT.pointers.xOffset) / (value.count - 1)
    }
  })
  // add distance for null-pointers
  nodeToPointerDistance.set(null, {
    count: nullPointerCount,
    distance: (nullPointerCount - 1) * LAYOUT.pointers.distance > SVG.cellWidth - 2 * LAYOUT.pointers.xOffset
      ? SVG.cellWidth / (nullPointerCount - 1)
      : LAYOUT.pointers.distance
  })
  // draw pointers
  svg.select(`#${HTML.ids.nodePointers}`)
    .selectAll('g')
    .data(nodePointers, (d: any) => d?.name + d?.methodOrParentId)
    .join(
      entered => {
        const group = entered.append('g')
          .on('mouseenter', (_event, d) => {
            const node = d.node?.node
            const pointerId = Number(d.methodOrParentId)
            const currNode = node?.element as HeapObject

            // the currently hovered list node
            // hover/highlight the value field
            const hoverInfos = getListNodeHoverInfo(currNode)

            if (currNode) {
              if (pointerId) {
                // add the HoverInfo that a pointer is hovered
                hoverInfos.push(createHoverField(pointerId, d.name, currNode.id))
              }

              // add the local variables that are referencing the currently hovered list node as a HoverInfo if any
              // if the pointerId is NaN then the pointer is a local variable
              const locals = node?.parents as HeapTreeNode[]
              if (isNaN(pointerId) && locals) {
                for (let i = 0; i < locals.length; i++) {
                  const local = locals[i].element as LocalVar
                  const reference = (local.value && 'reference' in local.value) ? local.value.reference : -1
                  if (local.method === (d.parent as any).element.method && reference === currNode.id) {
                    hoverInfos.push(createHoverLocal(local.class, local.method.split('(')[0], local.name, reference))
                    break
                  }
                }
              }
            }

            onHover(hoverInfos)
          })
          .on('mouseleave', () => HoverSynchronizer.clear())
          .classed(HTML.classes.changed, true)
          .attr(
            'transform',
            d => `translate(${getPointerCoordinates(d, nodeToPointerDistance)})`
          )
          .attr('id', d => `${HTML.ids.prefixes.pointer}-${d.name}-${d.methodOrParentId}`)
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
          .attr('x', d => -getPointerTextWidth(d, nodeToPointerDistance) / 2)
          .attr('y', d => getPointerTextYOffset(d))
          .attr('width', d => getPointerTextWidth(d, nodeToPointerDistance))
          .attr('height', LAYOUT.pointers.text.height)
          .append('xhtml:div')
          .classed(HTML.classes.pointers.name, true)
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // parent name
        group.filter(d => d.isListPointer)
          .append('foreignObject')
          .attr('id', HTML.ids.pointers.parent)
          .classed(HTML.classes.pointers.text, true)
          .classed(HTML.classes.pointers.parent, true)
          .attr('x', d => -getPointerTextWidth(d, nodeToPointerDistance) / 2)
          .attr('y', d => getPointerTextYOffset(d) - LAYOUT.pointers.text.parent.yOffset)
          .attr('width', d => getPointerTextWidth(d, nodeToPointerDistance))
          .attr('height', LAYOUT.pointers.text.parent.height)
          .append('xhtml:div')
          .text(d => getSimpleParentDescription(d.parent))
          .attr('title', d => getSimpleParentDescription(d.parent))
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
            d => `translate(${getPointerCoordinates(d, nodeToPointerDistance)})`
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
          .attr('x', d => -getPointerTextWidth(d, nodeToPointerDistance) / 2)
          .attr('y', d => getPointerTextYOffset(d))
          .attr('width', d => getPointerTextWidth(d, nodeToPointerDistance))
          .select('div')
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // update parent
        updated.select(`#${HTML.ids.pointers.parent}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => -getPointerTextWidth(d, nodeToPointerDistance) / 2)
          .attr('y', d => getPointerTextYOffset(d) - LAYOUT.pointers.text.parent.yOffset)
          .attr('width', d => getPointerTextWidth(d, nodeToPointerDistance))
          .select('div')
          .text(d => getSimpleParentDescription(d.parent))
          .attr('title', d => getSimpleParentDescription(d.parent))
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}
