import { BaseType, Selection } from 'd3-selection'
import { ChildPointer, TreeNode, TreeNodePointer } from './types'
import { HTML, LAYOUT } from './constants'
import { HeapObject, LocalVar } from '@/dto/TraceState'
import { getNodeCoordinates, joinFieldTexts } from './node-utils'
import { childLineAttributes, getChildPointerCoordinates, updateChildPointerAttributes } from './child-pointer-utils'
import { getPointerCoordinates, getPointerLength, getPointerTextWidth, getPointerTextXOffset } from './pointer-utils'
import { DEFINITIONS } from '@/helpers/SvgDefinitions.vue'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getPointerDescription } from '../description-utils'
import { isFieldChanged } from '../heap-tree-node-utils'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverHeapObject, HoverInfo } from '@/hover/types'
import { createHoverField, createHoverLocal } from '@/hover/hoverinfo-builder'
import { HeapTreeNode } from '../heapBFS'
import { getTreeNodeHoverInfo, isHighlighted, isHighlightedChildPointer, isHighlightedRef, onHover } from './hover'
import { TRANSFORMATION } from '@/helpers/constants'

// appends a rectangle and lines for fields
export function appendNodeRect (
  group: Selection<SVGGElement, TreeNode, BaseType, unknown>,
  component: { leftName: string, rightName: string }
) {
  // append rectangle
  group.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', SVG.cellWidth)
    .attr('height', SVG.cellHeight)

  // append rectangle for each field
  group.append('rect')
    .attr('y', SVG.cellHeight)
    .attr('width', SVG.cellWidth / 2)
    .attr('height', SVG.cellHeight)

  group.append('rect')
    .attr('x', SVG.cellWidth / 2)
    .attr('y', SVG.cellHeight)
    .attr('width', SVG.cellWidth / 2)
    .attr('height', SVG.cellHeight)

  // append separating lines for fields
  group.append('g')
    .classed(HTML.classes.nodes.lineGroup, true)
    .selectAll('line')
    .data(d => d.node ? d.node.children : [])
    .enter()
    .filter((_, i) => i > 1) // filter one line, since there are two children more than lines needed
    .append('line')
    .attr('x1', 0)
    .attr('x2', SVG.cellWidth)
    .attr('y1', (_, i) => (i + 1) * SVG.cellHeight)
    .attr('y2', (_, i) => (i + 1) * SVG.cellHeight)

  // append middle line for left and right
  group.select(`.${HTML.classes.nodes.lineGroup}`)
    .append('line')
    .attr('x1', SVG.cellWidth / 2)
    .attr('x2', SVG.cellWidth / 2)
    .attr('y1', d => d.height - SVG.cellHeight)
    .attr('y2', d => d.height)

  // append group for text which gets added later
  const textGroup = group.append('g')
    .classed(HTML.classes.nodes.textGroup, true)
  joinFieldTexts(textGroup, component)

  // add left and right fields; they can be added since they are always at the same position
  textGroup.append('foreignObject')
    .attr('id', HTML.ids.nodes.leftField)
    .attr('x', 0)
    .attr('y', d => d.height - SVG.cellHeight)
    .attr('width', SVG.cellWidth / 2)
    .attr('height', SVG.cellHeight)
    .append('xhtml:div')
    .classed(HTML.classes.changed, d => isFieldChanged(d.node, -2))
    .classed(HTML.classes.fieldText, true)
    .text(component.leftName)
    .attr('title', component.leftName)
  textGroup.append('foreignObject')
    .attr('id', HTML.ids.nodes.rightField)
    .attr('x', SVG.cellWidth / 2)
    .attr('y', d => d.height - SVG.cellHeight)
    .attr('width', SVG.cellWidth / 2)
    .attr('height', SVG.cellHeight)
    .append('xhtml:div')
    .classed(HTML.classes.changed, d => isFieldChanged(d.node, -1))
    .classed(HTML.classes.fieldText, true)
    .text(component.rightName)
    .attr('title', component.rightName)

  textGroup.selectAll(`.${HTML.classes.nodes.field}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo((d as any).element as HeapObject, 0)
      HoverSynchronizer.hover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  textGroup.selectAll(`#${HTML.ids.nodes.leftField}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo((d as any).node.element as HeapObject, 1)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  textGroup.selectAll(`#${HTML.ids.nodes.rightField}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo((d as any).node.element as HeapObject, 2)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
}

export function drawNodeRectangles (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  treeNodes: TreeNode[],
  component: { leftName: string, rightName: string },
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.treeNodes}`)
    .selectAll(`.${HTML.classes.nodes.group}`)
    .data(treeNodes, (d: any) => (d?.node.element as HeapObject).id)
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
          .classed(HTML.classes.highlighted.ref, d => isHighlightedRef(hoveredInfos.filter((info: HoverInfo): info is HoverHeapObject => info.kind === 'HeapObject'), d))
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getNodeCoordinates(d)})`)
          .selection()
        // update fields
        joinFieldTexts(updated.select(`.${HTML.classes.nodes.textGroup}`), component)
        updated.selectAll('rect')
          .classed(HTML.classes.highlighted.field, (d, index) => isHighlighted(hoveredInfos, d as any, index))
        // update left and right
        updated.select(`#${HTML.ids.nodes.leftField}`)
          .select('div')
          .classed(HTML.classes.changed, d => isFieldChanged(d.node, -2))
          .text(component.leftName)
          .attr('title', component.leftName)
        updated.select(`#${HTML.ids.nodes.rightField}`)
          .select('div')
          .classed(HTML.classes.changed, d => isFieldChanged(d.node, -1))
          .text(component.rightName)
          .attr('title', component.rightName)
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawChildPointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  childPointers: ChildPointer[],
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.childPointers}`).selectAll('g')
    .data(childPointers, (pointer: any) =>
      (pointer?.parent.node.element as HeapObject).id * (pointer?.direction === 'left' ? -1 : 1))
    .on('mouseenter', (_event, pointer: any) => {
      const hoverInfos = getTreeNodeHoverInfo(pointer.parent.node.element as HeapObject, pointer?.direction === 'left' ? 1 : 2)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
    .join(
      entered => {
        const group = entered.append('g')
          .attr('id', d => `${HTML.ids.prefixes.child}-${(d.parent.node?.element as HeapObject).id}-${d.direction}`)
          .classed(HTML.classes.changed, true)
          .attr('transform', d => `translate(${getChildPointerCoordinates(d)})`)
        blendInAnimation(group)
        // normal pointer line, always visible
        const line = group.append('line')
        childLineAttributes(line)
        line.attr('id', HTML.ids.pointers.line)
          .attr('marker-start', d => isHighlightedChildPointer(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, only visible when not null
        const arrowLine = group.append('line')
        childLineAttributes(arrowLine)
        arrowLine.attr('id', HTML.ids.pointers.arrowLine)
          .attr('marker-end', d => isHighlightedChildPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.child.node ? '1' : '0')
        // null line, only visible when null
        group.append('line')
          .attr('id', HTML.ids.pointers.nullLine)
          .attr('x1', -LAYOUT.childPointers.null.lineLength / 2)
          .attr('x2', LAYOUT.childPointers.null.lineLength / 2)
          .attr('y1', 0)
          .attr('y2', 0)
          .style('opacity', d => d.child.node ? '0' : '1')
        return group
      },
      updated => {
        // update group position
        const toReturn = updated
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlightedChildPointer(hoveredInfos, d))
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getChildPointerCoordinates(d)})`)
          .selection()
        // update pointer line
        const pointerLine = updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlightedChildPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : d.changed
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
        updateChildPointerAttributes(pointerLine)
        // update arrow line
        const arrowLine = updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlightedChildPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : d.changed
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
        updateChildPointerAttributes(arrowLine)
          .style('opacity', d => d.child.node ? '1' : '0')
        // update null line
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => d.child.node ? '0' : '1')
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawPointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  nodePointers: TreeNodePointer[],
  hoveredInfos: HoverInfo[]
) {
  // count how many pointers point to each node
  const nodeToPointerDistance = new Map<TreeNode, { count: number, distance: number }>()
  nodePointers.forEach(pointer => {
    if (pointer.node) {
      if (nodeToPointerDistance.has(pointer.node)) {
        nodeToPointerDistance.get(pointer.node)!.count++
      } else {
        nodeToPointerDistance.set(pointer.node, { count: 1, distance: LAYOUT.pointers.distance })
      }
    }
  })
  // calculate pointer distances, if there are too many
  nodeToPointerDistance.forEach((value, key) => {
    if ((value.count - 1) * value.distance > key.height - 2 * LAYOUT.pointers.yOffset) {
      value.distance = (key.height - 2 * LAYOUT.pointers.yOffset) / (value.count - 1)
    }
  })
  svg.select(`#${HTML.ids.nodePointers}`)
    .selectAll('g')
    .data(nodePointers, (d: any) => d?.name + d?.methodOrParentId)
    .join(
      entered => {
        const group = entered.append('g')
          .on('mouseenter', (_event, pointer) => {
            const node = pointer.node?.node
            const pointerId = Number(pointer.methodOrParentId)
            const currNode = node?.element as HeapObject

            const hoverInfos = getTreeNodeHoverInfo(currNode)

            if (currNode) {
              if (pointerId) {
                // add the HoverInfo that a pointer is hovered
                hoverInfos.push(createHoverField(pointerId, pointer.name, currNode.id))
              }

              // add the local variables that are referencing the currently hovered list node as a HoverInfo if any
              // if the pointerId is NaN then the pointer is a local variable
              const locals = node?.parents as HeapTreeNode[]
              if (isNaN(pointerId) && locals) {
                for (let i = 0; i < locals.length; i++) {
                  const local = locals[i].element as LocalVar
                  const reference = (local.value && 'reference' in local.value) ? local.value.reference : -1
                  if (local.method === (pointer.parent as any).element.method && reference === currNode.id) {
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
          .attr('transform', d => `translate(${getPointerCoordinates(d, nodeToPointerDistance)})`)
          .attr('id', d => `${HTML.ids.prefixes.pointer}-${d.name}-${d.methodOrParentId}`)
        blendInAnimation(group)
        // normal pointer line, always visible
        group.append('line')
          .attr('id', HTML.ids.pointers.line)
          .attr('x1', d => getPointerLength(d))
          .attr('x2', 0)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('marker-start', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, only visible when not null
        group.append('line')
          .attr('id', HTML.ids.pointers.arrowLine)
          .attr('x1', d => getPointerLength(d))
          .attr('x2', 0)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedArrow : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.isNull ? '0' : '1')
        // pointer name
        group.append('foreignObject')
          .classed(HTML.classes.pointers.text, true)
          .attr('x', d => -getPointerTextXOffset(d) - getPointerTextWidth(d))
          .attr('y', -LAYOUT.pointers.distance / 2 + LAYOUT.pointers.verticalTextOffset)
          .attr('width', d => getPointerTextWidth(d))
          .attr('height', LAYOUT.pointers.distance)
          .append('xhtml:div')
          .classed(HTML.classes.pointers.name, true)
          .attr('height', LAYOUT.pointers.distance)
          .text(d => d.name)
          .attr('title', d => getPointerDescription(d))
        // null line, visible when null
        group.append('line')
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1', -LAYOUT.pointers.null.verticalLineLength / 2)
          .attr('y2', LAYOUT.pointers.null.verticalLineLength / 2)
          .style('opacity', d => d.isNull ? '1' : '0')
          .attr('id', HTML.ids.pointers.nullLine)
        return group
      },
      updated => {
        // update group position
        const toReturn = updated
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlighted(hoveredInfos, d))
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getPointerCoordinates(d, nodeToPointerDistance)})`)
          .selection()
        // reset marker for pointer line and update length
        updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : d.changed ? DEFINITIONS.urls.redDot : DEFINITIONS.urls.dot)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x1', d => getPointerLength(d))
        // update arrow line
        updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlighted(hoveredInfos, d) ? DEFINITIONS.urls.highlightedArrow : d.changed ? DEFINITIONS.urls.redArrow : DEFINITIONS.urls.arrow)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x1', d => getPointerLength(d))
          .style('opacity', d => d.isNull ? '0' : '1')
        // update null-line visibility
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => d.isNull ? '1' : '0')
        // update text position
        updated.select('foreignObject')
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', d => -getPointerTextXOffset(d) - getPointerTextWidth(d))
          .attr('width', d => getPointerTextWidth(d))
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}
