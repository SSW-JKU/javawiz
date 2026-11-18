import { BaseType, Selection } from 'd3-selection'
import { ChildFieldPointer, TreeNodeBox, VariableToTreeNodePointer } from './types'
import { HTML, LAYOUT } from './constants'
import { HeapObject } from '@/dto/TraceState'
import { getTreeNodeBoxCoordinates, joinFieldTexts } from './node-utils'
import { childLineAttributes, getChildFieldPointerCoordinates, updateChildFieldPointerAttributes } from './child-field-pointer-utils'
import { getPointerCoordinates, getPointerLength, getPointerTextWidth, getPointerTextXOffset } from './pointer-utils'
import { DEFINITIONS } from '@/helpers/SvgDefinitions'
import { SVG } from '../constants'
import { blendInAnimation, blendOutAnimation } from '../animations'
import { getPointerDescription } from '../description-utils'
import { isFieldChanged } from '../data-structure-graph-node-utils'
import { HoverSynchronizer } from '@/hover/HoverSynchronizer'
import { HoverHeapObject, HoverInfo } from '@/hover/types'
import { createHoverField } from '@/hover/hoverinfo-builder'
import { createRootVariableHover, idOfOwningHeapObject, isField } from '../pointer-hover'
import { getTreeNodeHoverInfo, isHighlighted, isHighlightedChildFieldPointer, isHighlightedRef, onHover } from './hover'
import { TRANSFORMATION } from '@/helpers/constants'
import { heapItemIdentifier } from '@/identifiers/trace-identifiers'

// appends a rectangle and lines for fields
export function appendTreeNodeBoxFieldRects (
  group: Selection<SVGGElement, TreeNodeBox, BaseType, unknown>,
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
    .data(d => d.dataStructureGraphNode ? d.dataStructureGraphNode.childDataStructureGraphNodes : [])
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
    .classed(HTML.classes.changed, d => isFieldChanged(d.dataStructureGraphNode, -2))
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
    .classed(HTML.classes.changed, d => isFieldChanged(d.dataStructureGraphNode, -1))
    .classed(HTML.classes.fieldText, true)
    .text(component.rightName)
    .attr('title', component.rightName)

  textGroup.selectAll(`.${HTML.classes.nodes.field}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo((d as any).traceElement as HeapObject, 0)
      HoverSynchronizer.hover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  // Typing the selection lets D3 type `d` as the tree node box the field belongs to.
  textGroup.selectAll<SVGForeignObjectElement, TreeNodeBox>(`#${HTML.ids.nodes.leftField}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo(d.dataStructureGraphNode!.traceElement as HeapObject, 1)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())

  textGroup.selectAll<SVGForeignObjectElement, TreeNodeBox>(`#${HTML.ids.nodes.rightField}`)
    .on('mouseenter', (_event, d) => {
      const hoverInfos = getTreeNodeHoverInfo(d.dataStructureGraphNode!.traceElement as HeapObject, 2)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
}

export function drawTreeNodeBoxes (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  treeNodeBoxes: TreeNodeBox[],
  component: { leftName: string, rightName: string },
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.treeNodes}`)
    // Typing the selection lets D3 type `d` in the key function and all callbacks below as TreeNodeBox.
    .selectAll<SVGGElement, TreeNodeBox>(`.${HTML.classes.nodes.group}`)
    .data(treeNodeBoxes, d => (d.dataStructureGraphNode!.traceElement as HeapObject).id)
    .join(
      entered => {
        const group = entered
          .append('g')
          .attr('id', d => `${HTML.ids.prefixes.nodes}-${heapItemIdentifier(d.dataStructureGraphNode?.traceElement as HeapObject)}`)
          .attr('transform', d => `translate(${getTreeNodeBoxCoordinates(d)})`)
          .classed(HTML.classes.nodes.group, true)
          .classed(HTML.classes.changed, true)
        blendInAnimation(group)
        appendTreeNodeBoxFieldRects(group, component)
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
          .attr('transform', d => `translate(${getTreeNodeBoxCoordinates(d)})`)
          .selection()
        // update fields
        joinFieldTexts(updated.select(`.${HTML.classes.nodes.textGroup}`), component)
        updated.selectAll('rect')
          .classed(HTML.classes.highlighted.field, (d, index) => isHighlighted(hoveredInfos, d as any, index))
        // update left and right
        updated.select(`#${HTML.ids.nodes.leftField}`)
          .select('div')
          .classed(HTML.classes.changed, d => isFieldChanged(d.dataStructureGraphNode, -2))
          .text(component.leftName)
          .attr('title', component.leftName)
        updated.select(`#${HTML.ids.nodes.rightField}`)
          .select('div')
          .classed(HTML.classes.changed, d => isFieldChanged(d.dataStructureGraphNode, -1))
          .text(component.rightName)
          .attr('title', component.rightName)
        return updated
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawChildFieldPointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  childFieldPointers: ChildFieldPointer[],
  hoveredInfos: HoverInfo[]
) {
  svg.select(`#${HTML.ids.childPointers}`)
    // Typing the selection lets D3 type `pointer` and `d` in the key function and all callbacks below as ChildFieldPointer.
    .selectAll<SVGGElement, ChildFieldPointer>('g')
    .data(childFieldPointers, pointer =>
      (pointer.sourceTreeNodeBox.dataStructureGraphNode!.traceElement as HeapObject).id * (pointer.side === 'left' ? -1 : 1))
    .on('mouseenter', (_event, pointer) => {
      const hoverInfos = getTreeNodeHoverInfo(pointer.sourceTreeNodeBox.dataStructureGraphNode!.traceElement as HeapObject, pointer.side === 'left' ? 1 : 2)
      onHover(hoverInfos)
    })
    .on('mouseleave', () => HoverSynchronizer.clear())
    .join(
      entered => {
        const group = entered.append('g')
          // Not an object field identifier: a child field pointer only knows its side (`left`/`right`), not the field name.
          .attr('id', d => `${HTML.ids.prefixes.child}-${(d.sourceTreeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id}-${d.side}`)
          .classed(HTML.classes.changed, true)
          .attr('transform', d => `translate(${getChildFieldPointerCoordinates(d)})`)
        blendInAnimation(group)
        // normal pointer line, always visible
        const line = group.append('line')
        childLineAttributes(line)
        line.attr('id', HTML.ids.pointers.line)
          .attr('marker-start', d => isHighlightedChildFieldPointer(hoveredInfos, d) ? DEFINITIONS.urls.highlightedDot : DEFINITIONS.urls.redDot)
        // arrow line, only visible when not null
        const arrowLine = group.append('line')
        childLineAttributes(arrowLine)
        arrowLine.attr('id', HTML.ids.pointers.arrowLine)
          .attr('marker-end', d => isHighlightedChildFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : DEFINITIONS.urls.redArrow)
          .style('opacity', d => d.targetTreeNodeBox.dataStructureGraphNode ? '1' : '0')
        // null line, only visible when null
        group.append('line')
          .attr('id', HTML.ids.pointers.nullLine)
          .attr('x1', -LAYOUT.childPointers.null.lineLength / 2)
          .attr('x2', LAYOUT.childPointers.null.lineLength / 2)
          .attr('y1', 0)
          .attr('y2', 0)
          .style('opacity', d => d.targetTreeNodeBox.dataStructureGraphNode ? '0' : '1')
        return group
      },
      updated => {
        // update group position
        const toReturn = updated
          .classed(HTML.classes.changed, d => d.changed)
          .classed(HTML.classes.highlighted.pointer, d => isHighlightedChildFieldPointer(hoveredInfos, d))
          .style('opacity', '1')
          .interrupt()
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('transform', d => `translate(${getChildFieldPointerCoordinates(d)})`)
          .selection()
        // update pointer line
        const pointerLine = updated.select(`#${HTML.ids.pointers.line}`)
          .attr('marker-start', d => isHighlightedChildFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedDot
            : d.changed
              ? DEFINITIONS.urls.redDot
              : DEFINITIONS.urls.dot)
        updateChildFieldPointerAttributes(pointerLine)
        // update arrow line
        const arrowLine = updated.select(`#${HTML.ids.pointers.arrowLine}`)
          .attr('marker-end', d => isHighlightedChildFieldPointer(hoveredInfos, d)
            ? DEFINITIONS.urls.highlightedArrow
            : d.changed
              ? DEFINITIONS.urls.redArrow
              : DEFINITIONS.urls.arrow)
        updateChildFieldPointerAttributes(arrowLine)
          .style('opacity', d => d.targetTreeNodeBox.dataStructureGraphNode ? '1' : '0')
        // update null line
        updated.select(`#${HTML.ids.pointers.nullLine}`)
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .style('opacity', d => d.targetTreeNodeBox.dataStructureGraphNode ? '0' : '1')
        return toReturn
      },
      removed => blendOutAnimation(removed)
    )
}

export function drawVariablePointers (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  variableToTreeNodePointers: VariableToTreeNodePointer[],
  hoveredInfos: HoverInfo[]
) {
  // count how many pointers point to each node
  const pointerSpacingByTargetTreeNodeBox = new Map<TreeNodeBox, { count: number, distance: number }>()
  variableToTreeNodePointers.forEach(pointer => {
    if (pointer.targetTreeNodeBox) {
      if (pointerSpacingByTargetTreeNodeBox.has(pointer.targetTreeNodeBox)) {
        pointerSpacingByTargetTreeNodeBox.get(pointer.targetTreeNodeBox)!.count++
      } else {
        pointerSpacingByTargetTreeNodeBox.set(pointer.targetTreeNodeBox, { count: 1, distance: LAYOUT.pointers.distance })
      }
    }
  })
  // calculate pointer distances, if there are too many
  pointerSpacingByTargetTreeNodeBox.forEach((value, key) => {
    if ((value.count - 1) * value.distance > key.height - 2 * LAYOUT.pointers.yOffset) {
      value.distance = (key.height - 2 * LAYOUT.pointers.yOffset) / (value.count - 1)
    }
  })
  svg.select(`#${HTML.ids.nodePointers}`)
    // Typing the selection lets D3 type `d` in the key function and all callbacks below as VariableToTreeNodePointer.
    .selectAll<SVGGElement, VariableToTreeNodePointer>('g')
    .data(variableToTreeNodePointers, d => d.sourceVariableIdentifier)
    .join(
      entered => {
        const group = entered.append('g')
          .on('mouseenter', (_event, pointer) => {
            const node = pointer.targetTreeNodeBox?.dataStructureGraphNode
            const currNode = node?.traceElement as HeapObject

            const hoverInfos = getTreeNodeHoverInfo(currNode)

            if (currNode) {
              // add the hovered pointer: a field of the tree object or a variable
              hoverInfos.push(isField(pointer.sourceDataStructureGraphNode)
                ? createHoverField(idOfOwningHeapObject(pointer.sourceDataStructureGraphNode), pointer.name, currNode.id)
                : createRootVariableHover(pointer.sourceDataStructureGraphNode, currNode.id))
            }

            onHover(hoverInfos)
          })
          .on('mouseleave', () => HoverSynchronizer.clear())
          .classed(HTML.classes.changed, true)
          .attr('transform', d => `translate(${getPointerCoordinates(d, pointerSpacingByTargetTreeNodeBox)})`)
          .attr('id', d => `${HTML.ids.prefixes.pointer}-${d.sourceVariableIdentifier}`)
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
          .attr('transform', d => `translate(${getPointerCoordinates(d, pointerSpacingByTargetTreeNodeBox)})`)
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
