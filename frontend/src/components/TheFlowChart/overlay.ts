import { FullWidthManager } from './FullWidthManager'
import { FullHierarchyNode, OverlayVar } from './types'
import { findActiveStatement } from './meta-utils'
import { textWidth } from '@/components/TheFlowChart/Font'
import * as d3 from 'd3'
import { ELEMENT } from './Element'
import { AstElement } from '@/dto/AbstractSyntaxTree'

export const OVERLAY = {
  CHANGED_VAR_COLOR: 'red',
  UNCHANGED_VAR_COLOR: 'black',
  FILL: '#fff9e6',
  STROKE: '#ffc552',
  RADIUS: 3,
  LINE_DISTANCE: 14,
  MOVE_TIME: 500,
  RESIZE_TIME: 500,
  FADEIN_TIME: 300,
  STATEMENT_OVERLAY_SPACING: 5,
  CHANGED_VAR_FONT_WEIGHT: 'bold',
  UNCHANGED_VAR_FONT_WEIGHT: 'normal',
  EMPTY_BOX_WIDTH: 35,
  EMPTY_BOX_HEIGHT: 15,
  STACK: 'stackOverlay',
  STATICS: 'staticsOverlay',
  FILTER: 'drop-shadow(0 0 2px grey)'
}

/*
class that stores the previous active statement so that we can deduce the correct animations for the stack overlay (e.g. bend to the left when returning to the condition of a loop)
*/
export class StackOverlayManager {
  private previousActiveStmt: FullHierarchyNode<AstElement> | undefined = undefined
  private previousStateIndex: number = -1

  /**
 * attach a stack overlay to the given selection
 * @param overlays the overlay selection
 * @param showValues whether or not to show an overlay (if not, any existing overlay might need to be removed)
 * @param vars current stack variables with values
 * @param ast current ast
 * @param fullWidthManager current FullWidthManager
 * @param stateIndex the current state index
 */
  public renderStackOverlays (
    overlays: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    showValues: boolean,
    vars: OverlayVar[] | undefined,
    ast: FullHierarchyNode<AstElement>,
    fullWidthManager: FullWidthManager,
    stateIndex: number
  ) {
    let stackOverlay = overlays.select(`.${OVERLAY.STACK}`)
    if (showValues && vars) {
      if (stackOverlay.empty()) {
        stackOverlay = overlays.append('g').classed(OVERLAY.STACK, true) as any
        stackOverlay.append('rect')
          .style('fill', OVERLAY.FILL)
          .style('stroke', OVERLAY.STROKE)
          .style('rx', OVERLAY.RADIUS)
          .style('ry', OVERLAY.RADIUS)
          .style('filter', OVERLAY.FILTER)
        stackOverlay.append('text')
          .style('width', '100%')
          .style('height', '100%')
      }
      const activeStmt = findActiveStatement(ast)

      if (activeStmt) {
        const { x, y } = getOverlayCoordinates(activeStmt, fullWidthManager)

        if (this.previousActiveStmt) {
          const prev = getOverlayCoordinates(this.previousActiveStmt, fullWidthManager)
          const bendAmount = bend(this.previousActiveStmt, activeStmt, this.previousStateIndex < stateIndex)
          const tweenFn = (t: number) => `translate(${(1 - t) * prev.x - 4 * t * (1 - t) * bendAmount + t * x}, ${(1 - t) * prev.y + t * y})`
          stackOverlay.transition()
            .duration(bendAmount > 0 ? (2 * OVERLAY.MOVE_TIME) : OVERLAY.MOVE_TIME)
            .attrTween('transform', () => tweenFn)
        } else {
          stackOverlay.transition()
            .duration(OVERLAY.MOVE_TIME)
            .attr('transform', `translate(${x}, ${y})`)
        }

        joinVars(stackOverlay, vars)

        this.previousActiveStmt = activeStmt
        this.previousStateIndex = stateIndex
      } else {
        stackOverlay.remove()
      }
    } else {
      stackOverlay.remove()
    }
  }
}

function bend (previous: FullHierarchyNode<AstElement>, current: FullHierarchyNode<AstElement>, forward: boolean): number {
  if (!previous) {
    return 0
  }

  const from = forward ? previous : current
  const to = forward ? current : previous

  if (from.data.kind === 'Conditional' && from.data.type === 'DO_WHILE') {
    if (to.ancestors().find(d => d.data.uuid === from.data.uuid)) {
      return from.box.centerX
    }
  }

  if (to.data.kind === 'Conditional' && (to.data.type === 'FOR' || to.data.type === 'WHILE')) {
    if (from.ancestors().find(d => d.data.uuid === to.data.uuid)) {
      return to.box.centerX
    }
  }

  return 0
}

/**
 * attach an overlay containing the current statics to the selection
 * @param overlay the overlay selection
 * @param showValues whether or not to show the overlay
 * @param vars the static variable values
 */
export function renderStaticsOverlay (
  overlay: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
  showValues: boolean,
  vars: OverlayVar[] | undefined
) {
  let staticsOverlay = overlay.select(`.${OVERLAY.STATICS}`)
  if (showValues && vars) {
    if (staticsOverlay.empty()) {
      staticsOverlay = overlay.append('g').classed(OVERLAY.STATICS, true)
        .attr('transform', 'translate(40,20)') as any
      staticsOverlay.append('rect')
        .style('fill', OVERLAY.FILL)
        .style('stroke', OVERLAY.STROKE)
        .style('rx', OVERLAY.RADIUS)
        .style('ry', OVERLAY.RADIUS)
        .style('filter', OVERLAY.FILTER)

      staticsOverlay.append('text')
        .style('width', '100%')
        .style('height', '100%')
    }

    if (vars && vars.length > 0) {
      joinVars(staticsOverlay, vars)
    } else {
      staticsOverlay.remove()
    }
  } else {
    staticsOverlay.remove()
  }
}

function joinVars (overlay: d3.Selection<d3.BaseType, unknown, HTMLElement, any>, vars: OverlayVar[]) {
  overlay.select('text').selectAll('tspan')
    .data<OverlayVar>(vars, (v: any) => v?.name ?? 'undefined')
    .join(
      e => {
        return e.append('tspan')
          .attr('dy', OVERLAY.LINE_DISTANCE)
          .attr('x', 5)
          .text(d => varText(d))
          .style('fill', d => d.changed ? OVERLAY.CHANGED_VAR_COLOR : OVERLAY.UNCHANGED_VAR_COLOR)
          .style('font-weight', d => d.changed ? OVERLAY.CHANGED_VAR_FONT_WEIGHT : OVERLAY.UNCHANGED_VAR_FONT_WEIGHT)
          .style('opacity', 0)
      },
      u => {
        return u.text(d => varText(d))
          .style('fill', d => d.changed ? OVERLAY.CHANGED_VAR_COLOR : OVERLAY.UNCHANGED_VAR_COLOR)
          .style('font-weight', d => d.changed ? OVERLAY.CHANGED_VAR_FONT_WEIGHT : OVERLAY.UNCHANGED_VAR_FONT_WEIGHT)
      }
    )
    .transition()
    .delay(OVERLAY.RESIZE_TIME * 0.6)
    .duration(OVERLAY.FADEIN_TIME)
    .style('opacity', 1)

  const width = Math.max(...vars.map(v => textWidth(varText(v))))
  const height = vars.length * OVERLAY.LINE_DISTANCE
  overlay.select('rect').transition()
    .duration(OVERLAY.RESIZE_TIME)
    .attr('width', vars.length > 0 ? width + 10 : OVERLAY.EMPTY_BOX_WIDTH)
    .attr('height', vars.length > 0 ? height + 5 : OVERLAY.EMPTY_BOX_HEIGHT)
}

function varText (v: OverlayVar) {
  return `${v.name}: ${v.displayValue}`
}

/**
 * Compute the coordinates for the stack overlay
 * @param activeStmt the HierarchyNode associated with the currently active statement
 * @param fullWidthManager the current width manager
 * @returns appropriate coordinates of the stack overlay
 */
function getOverlayCoordinates (activeStmt: FullHierarchyNode<AstElement>, fullWidthManager: FullWidthManager): {x: number, y: number} {
  const data = activeStmt.data

  const O = OVERLAY

  let x = 0
  let y = activeStmt.pos.y

  switch (data.kind) {
    case 'IfStatement':
      x = activeStmt.pos.x +
      activeStmt.box.centerX +
      ELEMENT.IfStatement.header.width(data.condition, fullWidthManager.hasFullWidth(data.uuid)) / 2 +
      O.STATEMENT_OVERLAY_SPACING
      break
    case 'Statement':
      x = activeStmt.pos.x + activeStmt.box.width + O.STATEMENT_OVERLAY_SPACING
      break
    case 'Switch':
      x = activeStmt.pos.x + activeStmt.box.centerX + ELEMENT.Switch.header.width(data.selector) / 2 + O.STATEMENT_OVERLAY_SPACING
      break
    case 'CatchClause':
      x = activeStmt.pos.x + ELEMENT.CatchClause.header.minArrowWidth + ELEMENT.CatchClause.header.textPadding + textWidth(data.parameter) + O.STATEMENT_OVERLAY_SPACING
      break
    case 'Conditional':
      x = activeStmt.pos.x +
          activeStmt.box.centerX +
          ELEMENT.Conditional.header.width(data.condition, fullWidthManager.hasFullWidth(data.uuid)) / 2 +
          O.STATEMENT_OVERLAY_SPACING
      if (data.type === 'DO_WHILE') {
        y = activeStmt.pos.y + activeStmt.box.height - ELEMENT.Conditional.header.height.total
      }
      break
    case 'Method':
      x = activeStmt.pos.x + activeStmt.box.centerX + ELEMENT.Method.header.endpointArrow.width / 2 + O.STATEMENT_OVERLAY_SPACING
      y = activeStmt.pos.y + activeStmt.box.height - ELEMENT.Method.padding.xAxis / 2 - ELEMENT.Method.header.endpointArrow.height
      break
    case 'Block':
      x = activeStmt.pos.x + ELEMENT.Block.overlayBottomOffset + O.STATEMENT_OVERLAY_SPACING
      y = activeStmt.pos.y + activeStmt.box.height
  }
  return { x, y }
}
