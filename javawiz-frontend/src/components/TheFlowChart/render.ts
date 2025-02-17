import {
  Conditional,
  IfStatement,
  Method,
  Statement,
  AstElement,
  Block,
  SwitchEntry,
  Switch,
  TryCatchFinally,
  CatchClause
} from '@/dto/AbstractSyntaxTree'
import {
  fitText,
  textHeight,
  textSize,
  textWidth
} from '@/components/TheFlowChart/Font'
import * as d3 from 'd3'
import { ELEMENT } from './Element'
import { dockingPosition, Position } from './position'
import { EnterElement } from 'd3'
import { blockContinues } from './meta-utils'
import { FullWidthManager } from './FullWidthManager'
import { uuidToDomId } from './ast-utils'
import { FullHierarchyNode } from './types'

type Selection<T extends AstElement = AstElement> = d3.Selection<SVGGElement, FullHierarchyNode<T>, any, any>
type UpdateSelection<T extends AstElement = AstElement> = d3.Selection<d3.BaseType, FullHierarchyNode<T>, any, any>
type EnterSelection<T extends AstElement = AstElement> = d3.Selection<EnterElement, FullHierarchyNode<T>, any, any>

type BeforJoinSelection<T extends AstElement = AstElement> = d3.Selection<d3.BaseType, FullHierarchyNode<T>, SVGElement, FullHierarchyNode<AstElement>>

export type ToggleFn = (uuid: string) => void
export type CollapseFn = ToggleFn
export type FullWidthToggleFn = ToggleFn
export type InlineFn = (uuid: string, candidateUUIDs: string[]) => Promise<void>

const MAIN_LINE_STROKE_WIDTH = 0.5
const ACTIVE_COLOR = 'rgb(212,228,231)' // same as vscode plugin '#d4e4e7FF'
const METHOD_CALL_COLOR = '#0F0F0F12'

const line = d3.line()

const COLLAPSE_TRANSITION_DURATION = 1400

/**
 * Add an exit animation
 * @param e target exit node
 * @returns Transition of e
 */
function exitAnimation (e: d3.Selection<any, any, any, any>) {
  return e.transition()
    .duration(COLLAPSE_TRANSITION_DURATION / 5)
    .style('opacity', 0)
    .remove()
}

/**
 * ADd an enter Animation
 * @param e target entry node
 * @returns Transition of e
 */
function enterAnimation (e: d3.Selection<any, any, any, any>) {
  return e
  // .transition()
  // .duration(COLLAPSE_TRANSITION_DURATION)
  // .style('opacity', 0.5)
}

/**
 * This does one full rendering of a Flowchart
 * @param data full specified hierarchy
 * @param selection render start selection
 * @param collapse toggle collapse function
 * @param inline toggle inline method function
 * @param fullWidthManager FullWidthManager
 */
export async function renderChart (
  data: FullHierarchyNode<AstElement>[],
  selection: Selection,
  collapse: CollapseFn,
  inline: InlineFn,
  fullWidthManager: FullWidthManager
) {
  type MHN<T> = FullHierarchyNode<T>

  const keyFunction = (d: any) => d ? (d as MHN<AstElement>).data.uuid : 'undefined'

  const methods = joinMethods(selection.selectAll('g.method')
    .data<MHN<Method>>(data.filter(d => d.data.kind === 'Method') as MHN<Method>[], keyFunction))
  const blocks = joinBlocks(selection.selectAll('g.block')
    .data<MHN<Block>>(data.filter(d => d.data.kind === 'Block') as MHN<Block>[], keyFunction), collapse)
  const statements = joinStatements(selection.selectAll('g.statement')
    .data<MHN<Statement>>(data.filter(d => d.data.kind === 'Statement') as MHN<Statement>[], keyFunction),
  collapse,
  inline,
  fullWidthManager
  )
  const ifStatements = joinIfStatements(selection.selectAll('g.if-statement')
    .data<MHN<IfStatement>>(data.filter(d => d.data.kind === 'IfStatement') as MHN<IfStatement>[], keyFunction), collapse, inline, fullWidthManager
  )
  const conditionals = joinConditionals(selection.selectAll('g.conditional')
    .data<MHN<Conditional>>(data.filter(d => d.data.kind === 'Conditional') as MHN<Conditional>[], keyFunction), collapse, inline, fullWidthManager
  )
  const switchStmt = joinSwitch(selection.selectAll('g.switch')
    .data<MHN<Switch>>(data.filter(d => d.data.kind === 'Switch') as MHN<Switch>[], keyFunction), collapse
  )
  const switchEntries = joinSwitchEntries(selection.selectAll('g.switch-entry')
    .data<MHN<SwitchEntry>>(data.filter(d => d.data.kind === 'SwitchEntry') as MHN<SwitchEntry>[], keyFunction), collapse)
  const tryCatchFinallies = joinTryCatchFinallies(selection.selectAll('g.try-catch-finally')
    .data<MHN<TryCatchFinally>>(data.filter(d => d.data.kind === 'TryCatchFinally') as MHN<TryCatchFinally>[], keyFunction)
  )
  const catchClauses = joinCatchClauses(selection.selectAll('g.catch-clause')
    .data<MHN<CatchClause>>(data.filter(d => d.data.kind === 'CatchClause') as MHN<CatchClause>[], keyFunction), collapse
  )

  methods.lower().sort()

  // set general attributes of all elements
  // - id
  // - transform (for positioning)
  d3.selectAll([...statements,
    ...methods,
    ...ifStatements,
    ...conditionals,
    ...blocks,
    ...switchStmt,
    ...switchEntries,
    ...tryCatchFinallies,
    ...catchClauses
  ])
    .attr('id', (d: any) => uuidToDomId(d.data.uuid))
    .transition()
    .duration(COLLAPSE_TRANSITION_DURATION / 2)
    .attrTween('transform', function (d: any) {
      const prev = d3.select(this).attr('transform')
      let pos = [d.pos.x, d.pos.y]
      if (prev) {
        pos = prev.replace(/translate\(|\)/g, '').split(',')
          .map(x => Number.parseFloat(x))
      }
      const i = d3.interpolateString(`translate(${pos[0]},${pos[1]})`, `translate(${d.pos.x},${d.pos.y})`)
      return function (t) {
        if (d.data.kind === 'Method') return `translate(${d.pos.x},${d.pos.y})`
        return i(t)
      }
    })
}

/**
 * Render statements
 * @param selection Selection of statements
 * @param collapseFn toggle collapse function
 * @param inlineFn toggle inline method function
 * @param fullWidthManager Full width manager
 * @returns groups of statements
 */
function joinStatements (
  selection: BeforJoinSelection<Statement>,
  collapseFn: CollapseFn,
  inlineFn: InlineFn,
  fullWidthManager: FullWidthManager
) {
  const EL = ELEMENT.Statement
  const g = selection.join(e => {
    const stmtG = e.append('g')
      .classed('statement', true)
    enterAnimation(stmtG)
    return stmtG
  },
  u => u.interrupt().style('opacity', 1),
  e => exitAnimation(e))

  g.selectAll('rect')
    .data(d => [d])
    .join(e => e.append('rect')
      .attr('fill', d => d.meta.active ? ACTIVE_COLOR : 'none')
      .attr('x', 0)
      .attr('y', 1),
    u => {
      u.transition()
        .attrTween('fill', function (d) {
          return d3.interpolateRgb((this as any)?.getAttribute('fill') || 'rgba(0,0,0,0)', d.meta.active ? ACTIVE_COLOR : 'rgba(0,0,0,0)')
        })
      return u
    })
    .attr('width', (d) => textWidth(fitText((d.data).code, d.box.width)) + 3)
    .attr('height', (d) => textHeight(d.data.code))

  renderRichText<Statement>(g,
    (d) => d.data.code,
    fullWidthManager,
    undefined,
    collapseFn,
    inlineFn
  )

  addArrow(g.filter(d => d.data.endOfStatementList), (d) => {
    const dock = toRelative(d.pos, dockingPosition(d, 'bottom'))
    return [[d.box.centerX, dock[1] - EL.endOfStatementList.height], dock]
  })

  // Rendering for specific statement types

  renderDiamond(g.filter(d => d.data.type === 'CONTINUE') as any, () => ({
    color: 'black',
    height: EL.specialType.symbolHeight.CONTINUE,
    width: EL.specialType.symbolHeight.CONTINUE * 2,
    cornerWidth: EL.specialType.height.CONTINUE * 0.3
  })).attr('transform', d => `translate(${d.box.centerX - EL.specialType.symbolHeight.CONTINUE},${d.box.height - EL.specialType.symbolHeight.CONTINUE})`)

  g.filter(d => d.data.type === 'THROW').selectAll('path.throw-arrow')
    .data(d => [d])
    .join(e => e.append('path')
      .attr('stroke-width', MAIN_LINE_STROKE_WIDTH * 5)
      .attr('stroke', 'black')
      .attr('fill', 'none')
    )
    .attr('d', 'M 10 20 l 8 7  l 2 -5 l 9 9 m -7 -1 l 7 1 l -1 -7')

  g.filter(d => ['BREAK', 'YIELD'].includes(d.data.type) &&
    d.ancestors().some(a => (a.data as AstElement).kind !== 'Switch' && ['Conditional', 'IfStatement'].includes(a.data.kind)))
    .selectAll('circle.break-circle')
    .data(d => [d])
    .join(e => e.append('circle')
      .classed('break-circle', true)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', MAIN_LINE_STROKE_WIDTH)
      .attr('r', EL.specialType.symbolHeight.BREAK / 2)
    )
    .attr('cx', d => d.box.centerX)
    .attr('cy', d => d.box.height - EL.specialType.symbolHeight.BREAK / 2)

  g.filter(d => ['BREAK', 'YIELD'].includes(d.data.type) &&
    d.ancestors().some(a => (a.data as AstElement).kind === 'Switch' && !['Conditional', 'IfStatement'].includes(a.data.kind)))
    .selectAll('polygon.switch-break-yield')
    .data(d => [d])
    .join(e => {
      return e.append('polygon')
        .classed('switch-break-yield', true)
        .attr('fill', 'white')
        .attr('stroke', 'black')
    })
    .attr('points', d => {
      const height = EL.specialType.symbolHeight[d.data.type as 'BREAK' | 'YIELD']
      const width = height
      const left = d.box.centerX - width / 2
      const top = d.box.height - height
      return [
        [0, 0],
        [width, 0],
        [width, height * 2 / 3],
        [width / 2, height],
        [0, height * 2 / 3]
      ].map(p => [left + p[0], top + p[1]].join(',')).join(' ')
    })

  endpoint(
    g.filter(d => d.data.type === 'RETURN'),
    'return-statement-endpoint',
    (d: FullHierarchyNode<Statement>) => [d.box.centerX, d.box.height],
    undefined,
    d => d.meta.active
  )
  // _addDebugInformation(g)
  return g
}

/**
 * Render Blocks
 * @param selection Selection of blocks
 * @param collapse toggle collapse
 * @returns groups of blocks
 */
function joinBlocks (selection: BeforJoinSelection<Block>, collapse: CollapseFn) {
  const g = selection.join(
    e => e.append('g').classed('block', true))

  g.selectAll('text.collapsed-placeholder')
    .data(d => [d])
    .join(e => e.append('text')
      .classed('collapsed-placeholder', true)
      .text('{ … }')
      .attr('text-anchor', 'middle')
      .attr('fill', 'grey')
      .on('dblclick', (ev: MouseEvent, d) => {
        ev.preventDefault()
        ev.stopPropagation()
        collapse(d.data.uuid)
      })
      .classed('collapsible', true)
      .style('opacity', 0)
    )
    .attr('x', d => d.box.centerX)
    .attr('y', ELEMENT.Statement.fontSize * 2)
    .transition()
    .ease(d3.easeBackOut)
    .duration(COLLAPSE_TRANSITION_DURATION)
    .attr('y', d => d.box.height * (2 / 3))
    .style('opacity', d => d.meta.collapsed ? 1 : 0)
    // _addDebugInformation(g)
  return g
}

/**
 * Render Methods
 * @param selection Selection of methods
 * @returns groups of methods
 */
function joinMethods (selection: BeforJoinSelection<Method>) {
  const EL = ELEMENT.Method

  const g = selection.join(
    e => e.append('g').classed('method', true))

  g.filter(d => (d.parent?.data as AstElement | undefined)?.kind === 'Statement' ||
    (d.parent?.data as AstElement | undefined)?.kind === 'Conditional' ||
    (d.parent?.data as AstElement | undefined)?.kind === 'IfStatement').selectAll('rect')
    .data(d => [d])
    .join(e => e.append('rect')
      .attr('y', 0)
      .attr('x', 0)
      .attr('fill', 'white')
      .attr('rx', 3)
      .attr('ry', 3))
    .attr('height', d => d.box.height)
    .attr('width', d => d.box.width)
    .transition()
    .duration(COLLAPSE_TRANSITION_DURATION)
    .attrTween('filter', function () {
      const i = d3.interpolateString((this as any)?.getAttribute('filter') || 'drop-shadow( 0 0 1px grey)', 'drop-shadow( 0 0 4px grey)')
      return (t) => i(t)
    })
  g.selectAll('text.method-signature')
    .data(d => [d])
    .join(e => e.append('text')
      .classed('method-signature', true)
      .attr('fill', EL.color.primary)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 600)
      .attr('y', EL.header.signatureContainer.height / 2 + EL.padding.yAxis / 2))
    .attr('x', (d) => d.box.centerX)
    .text((d) => (d.data).signature)

  // method end symbol
  // top
  endpoint(g, 'method-top', (d) => {
    return [d.box.centerX, EL.header.height - EL.header.endpointArrow.height + EL.padding.yAxis / 2]
  })
  addArrow(g, d => {
    return [
      [d.box.centerX, EL.header.height - EL.header.endpointArrow.height + EL.padding.yAxis / 2],
      [d.box.centerX, EL.children.translation.y + EL.padding.yAxis / 2]
    ]
  }, 'method-top-arrow')
  // bottom
  endpoint(g.filter((d) => blockContinues(d.data.body)), 'method-bottom', d => {
    return [d.box.centerX, d.box.height - EL.padding.yAxis / 2]
  },
  undefined,
  d => d.meta.active
  )
  return g
}

/**
 * Render IfStatements
 * @param selection Selection of IfStatements
 * @param collapse toggle collapse
 * @param inlineFn toggle inline methods
 * @param fullWidthManager Full width manager
 * @returns groups of IfStatements
 */
function joinIfStatements (
  selection: BeforJoinSelection<IfStatement>,
  collapse: CollapseFn,
  inlineFn: InlineFn,
  fullWidthManager: FullWidthManager
) {
  const EL = ELEMENT.IfStatement

  const g = selection.join(
    e => {
      const ifs = e.append('g').classed('if-statement', true)
      enterAnimation(ifs)
      return ifs
    },
    u => u.interrupt().style('opacity', 1),
    e => exitAnimation(e))

  const conditions = g.selectAll('g.condition')
    .data(d => [d])
    .join(e => e.append('g').classed('condition', true)
      .on('dblclick', (ev: MouseEvent, d) => {
        ev.preventDefault()
        ev.stopPropagation()
        collapse(d.data.uuid)
      })
      .classed('collapsible', true))
    .attr('transform', d => `translate(${d.box.centerX},0)`)

  conditions.selectAll('rect')
    .data(d => [d])
    .join(e => e.append('rect')
      .attr('y', 0)
      .attr('height', EL.header.height))
    .attr('fill', d => d.meta.active ? ACTIVE_COLOR : 'none')
    .attr('width', d => EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)))
    .attr('x', d => -EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2)

  renderRichText<IfStatement>(
    conditions,
    d => d.data.condition,
    fullWidthManager,
    { center: true },
    undefined,
    inlineFn
  )

  g.selectAll('text.boolean')
    .data(d => [d, d])
    .join(e => e
      .append('text')
      .classed('boolean', true)
      .attr('y', EL.header.height * 0.4)
      .attr('fill', 'cornflowerblue')
      .attr('font-size', '0.6em'))
    .text((_d, idx) => {
      if (idx === 0) {
        return EL.trueCaseLeft ? 'true' : 'false'
      }
      return EL.trueCaseLeft ? 'false' : 'true'
    })
    .attr('x', (d, idx) => {
      if (idx === 0) { // left
        return d.box.centerX -
          EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2 -
          textWidth(EL.trueCaseLeft ? 'true' : 'false', '0.6em') -
          EL.header.caseTextSpacing
      } else {
        return d.box.centerX + EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2 + EL.header.caseTextSpacing
      }
    })

  // true-case lines
  // header to true case arrow
  addArrow(g, d => {
    const headerDock: [number, number] = [
      d.box.centerX + (EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) * (EL.trueCaseLeft ? -1 : 1)) / 2,
      EL.header.height / 2
    ]
    const trueCaseDock = toRelative(d.pos, dockingPosition((d.children && d.children[0]) || d, 'top'))
    return [
      headerDock,
      [trueCaseDock[0], headerDock[1]],
      trueCaseDock
    ]
  }, 'true-top')
  // true case to if end arrow
  addArrow(g, d => {
    const trueCaseDock = toRelative(d.pos, dockingPosition((d.children && d.children[0]) || d, 'bottom'))
    const bottomDock = dockingPosition(d, 'bottom')
    bottomDock[1] -= EL.footer.height / 2
    const end = toRelative(d.pos, bottomDock)
    return [
      blockContinues(d.data.trueCase) ? trueCaseDock : [trueCaseDock[0], trueCaseDock[1] + EL.footer.height / 3],
      [trueCaseDock[0], end[1]],
      end
    ]
  }, 'true-bottom', true)
    .attr('stroke-dasharray', d => blockContinues(d.data.trueCase) ? 'none' : '1 2')
  // END true-case lines

  // false-case lines
  // top line of false-case
  addArrow(g.filter(d => !!d.data.falseCase), d => {
    if (!d.data.falseCase) throw new Error('no false case provided')
    const start: [number, number] = [
      d.box.centerX + (EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) * (EL.trueCaseLeft ? 1 : -1)) / 2,
      EL.header.height / 2
    ]
    const end = toRelative(d.pos, dockingPosition((d.children && d.children[1]) || d, 'top'))
    return [
      start,
      [end[0], start[1]],
      end
    ]
  }, 'false-top')

  // bottom line of false-case
  addArrow(g.filter(d => !!d.data.falseCase),
    d => {
      if (!d.data.falseCase) throw new Error('no false case provided')
      const start = toRelative(d.pos, dockingPosition((d.children && d.children[1]) || d, 'bottom'))
      const end = toRelative(d.pos, dockingPosition(d, 'bottom'))
      end[1] -= EL.footer.height / 2
      return [blockContinues(d.data.falseCase) ? start : [start[0], start[1] + EL.footer.height / 3], [start[0], end[1]], end]
    }, 'false-bottom', true)
    .attr('stroke-dasharray', d => d.data.falseCase && blockContinues(d.data.falseCase) ? 'none' : '1 2')

  // no false-case line
  addArrow(g.filter((d) => !(d.data).falseCase), d => {
    const start: [number, number] = [
      d.box.centerX + ((EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) * (EL.trueCaseLeft ? 1 : -1)) / 2),
      EL.header.height / 2
    ]
    const connectionLineX = EL.trueCaseLeft ? d.box.width - EL.padding / 4 : EL.padding / 4
    const end = toRelative(d.pos, dockingPosition(d, 'bottom'))
    end[1] -= EL.footer.height / 2
    return [start, [connectionLineX, start[1]], [connectionLineX, end[1]], end]
  }, 'no-false', true)
  // END false-case lines

  addArrow(g.filter(d => blockContinues(d.data.trueCase) || !d.data.falseCase || blockContinues(d.data.falseCase)), d => {
    const start: [number, number] = [
      d.box.centerX,
      d.box.height - EL.footer.height / 2
    ]
    const end = toRelative(d.pos, dockingPosition(d, 'bottom'))
    return [start, end]
  }, 'exit-line')
  return g
}

/**
 * Render conditionals (while, for, do-while)
 * @param selection Selection of conditionals
 * @param collapse toggle collapse
 * @param inlineFn toggle inline methods
 * @param fullWidthManager Full width manager
 * @returns groups of conditionals
 */
function joinConditionals (selection: BeforJoinSelection<Conditional>,
  collapse: CollapseFn,
  inlineFn: InlineFn,
  fullWidthManager: FullWidthManager
) {
  const EL = ELEMENT.Conditional

  const g = selection.join(
    e => {
      const conG = e.append('g').classed('conditional',
        true)
      enterAnimation(conG)
      return conG
    },
    u => u.interrupt().style('opacity', 1),
    e => exitAnimation(e))

  const conditions = g.selectAll('g.condition')
    .data(d => [d])
    .join(e => e.append('g')
      .classed('condition', true)
      .on('dblclick', (ev: MouseEvent, d) => {
        ev.stopPropagation()
        ev.preventDefault()
        collapse(d.data.uuid)
      })
      .classed('collapsible', true)
    )
    .attr('transform', d => {
      if (d.data.type === 'DO_WHILE') {
        return `translate(${d.box.centerX},${(d.children?.at(0)?.box.height ?? 0) + EL.header.height.total})`
      } else {
        return `translate(${d.box.centerX},0)`
      }
    })

  renderDiamond(conditions, d => ({
    color: EL.header.color.container,
    backgroundColor: d.meta.active ? ACTIVE_COLOR : undefined,
    width: EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)),
    height: EL.header.height.condition
  }))

  renderRichText<Conditional>(conditions,
    d => d.data.condition,
    fullWidthManager,
    { center: true },
    undefined,
    inlineFn
  )

  // header to block arrow
  addArrow(g, d => {
    let startY = 0
    if (d.data.type === 'DO_WHILE') {
      startY = (d.children && d.children[0].box.height + EL.footer.height) || 0
    }
    return [
      [d.box.centerX, startY + EL.header.height.condition],
      [d.box.centerX, startY + EL.header.height.total]
    ]
  }, 'header-arrow')

  // conditional repeat line
  addArrow(g, d => {
    let blockAlignmentX = EL.repeatLine.padding // repeat line x

    if (d.data.type === 'DO_WHILE') {
      blockAlignmentX = d.box.centerX -
        Math.max(
          d.children!!.at(0)!!.box.centerX,
          EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2 +
          EL.repeatLine.minWidth * 2 +
          EL.padding / 2 +
          -30
        )
      const start: [number, number] = [
        d.box.centerX - EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2,
        (d.children?.at(0)?.box.height ?? 0) + EL.footer.height + EL.footer.connectionCircleRadius + 2
      ]

      const end: [number, number] = [
        d.box.centerX - EL.footer.connectionCircleRadius,
        EL.header.height.condition / 2 + EL.footer.connectionCircleRadius / 2
      ]
      return [start,
        [blockAlignmentX, start[1]],
        [blockAlignmentX, end[1]],
        end]
    } else {
      const start = toRelative(d.pos, dockingPosition((d.children && d.children[0]) || d, 'bottom'))
      const bottom = toRelative(d.pos, dockingPosition(d, 'bottom'))
      const end: [number, number] = [
        d.box.centerX - EL.header.width(d.data.condition, fullWidthManager.hasFullWidth(d.data.uuid)) / 2,
        EL.header.height.condition / 2
      ]
      return [
        start,
        [start[0], bottom[1] - 2 * EL.footer.height / 3],
        [blockAlignmentX, bottom[1] - 2 * EL.footer.height / 3],
        [blockAlignmentX, end[1]],
        end
      ]
    }
  }, 'repeat-line', false)

  // conditional exit line
  addArrow(g, d => {
    let start: [number, number] = [d.box.centerX, 0]
    let end: [number, number] = [d.box.centerX, EL.footer.height]

    if (d.data.type !== 'DO_WHILE') {
      start = toRelative(d.pos, dockingPosition((d.children && d.children[0]) || d, 'bottom'))
      end = [d.box.centerX, d.box.height]
    }

    return [
      start,
      end
    ]
  }, 'exit-line')
  // END false-case lines

  g.selectAll('circle.connection-circle')
    .data(d => [d])
    .join(e => e.append('circle')
      .classed('connection-circle', true)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', MAIN_LINE_STROKE_WIDTH)
      .attr('r', EL.footer.connectionCircleRadius)
    )
    .attr('cx', d => d.box.centerX)
    .attr('cy', d => (d.data.type === 'DO_WHILE' ? EL.footer.height : d.box.height) - (EL.footer.height * 2 / 3))
  return g
}

/**
 * Render switch statements
 * @param selection selection of switches
 * @param collapse toggle collapse
 * @returns groups of switches
 */
function joinSwitch (selection: BeforJoinSelection<Switch>, collapse: CollapseFn) {
  const g = selection.join(e => {
    const stmtG = e.append('g')
      .classed('switch', true)
      .on('dblclick', (ev, d) => {
        ev.preventDefault()
        ev.stopPropagation()
        collapse(d.data.uuid)
      })
      .classed('collapsible', true)
    enterAnimation(stmtG)
    return stmtG
  })

  g.selectAll('polygon.selector-polygon')
    .data(d => [d])
    .join(e => {
      return e.append('polygon')
        .classed('selector-polygon', true)
        .attr('stroke', 'black')
    })
    .attr('fill', d => d.meta.active ? ACTIVE_COLOR : 'white')
    .attr('points', d => {
      const width = ELEMENT.Switch.header.width(d.data.selector)
      const left = d.box.centerX - width / 2
      return [
        [0, 0],
        [width, 0],
        [width, ELEMENT.Switch.header.height * 2 / 3],
        [width / 2, ELEMENT.Switch.header.height],
        [0, ELEMENT.Switch.header.height * 2 / 3]
      ].map(p => [left + p[0], ELEMENT.Switch.padding / 2 + p[1]].join(',')).join(' ')
    })

  g.selectAll('text').data(d => [d])
    .join(e => {
      return e.append('text')
        .text(d => d.data.selector)
        .attr('text-anchor', 'middle')
        .attr('x', d => d.box.centerX)
        .attr('y', ELEMENT.Switch.header.height * 0.6)
    })

  addArrow(g, d => {
    return [
      [d.box.centerX, d.box.height - ELEMENT.Switch.footer.height / 2],
      [d.box.centerX, d.box.height]
    ]
  }, 'switch-endpoint-arrow')

  g.selectAll('polygon.switch-endpoint')
    .data(d => [d])
    .join(e => {
      return e.append('polygon')
        .classed('switch-endpoint', true)
        .attr('fill', 'white')
        .attr('stroke', 'black')
    })
    .attr('points', d => {
      const height = ELEMENT.Switch.footer.height / 2
      const width = height
      const left = d.box.centerX - width / 2
      const top = d.box.height - height * 2
      return [
        [0, 0],
        [width, 0],
        [width, height * 2 / 3],
        [width / 2, height],
        [0, height * 2 / 3]
      ].map(p => [left + p[0], top + p[1]].join(',')).join(' ')
    })

  return g
}

/**
 * Render switch entries
 * @param selection Selection of switch entries
 * @param collapse toggle collapse
 * @returns groups of switch entries
 */
function joinSwitchEntries (selection: BeforJoinSelection<SwitchEntry>, collapse: CollapseFn) {
  const g = selection.join(e => {
    const stmtG = e.append('g')
      .classed('switch-entry', true)
    enterAnimation(stmtG)
    return stmtG
  },
  u => u.interrupt().style('opacity', 1),
  e => exitAnimation(e))

  g.selectAll('text').data(d => [d])
    .join(e => {
      return e.append('text').text(d => d.data.labels.join(', '))
        .attr('x', d => d.data.isDefault ? d.box.centerX : 0)
        .attr('text-anchor', d => d.data.isDefault ? 'middle' : 'start')
        .attr('y', d => textHeight(d.data.labels[0]))
        .on('dblclick', (ev, d) => {
          ev.preventDefault()
          ev.stopPropagation()
          collapse(d.data.block.uuid)
        })
        .classed('collapsible', true)
    })

  addArrow(g.filter(s => !!s.children), d => {
    if (!d.children) throw new Error('no children in switchEntry')
    const text = textSize(d.data.labels.join(', '))
    const start = [text.width + 1, text.height * 2 / 3] as [number, number]
    const end = toRelative(d.pos, [d.children[0].pos.x + d.children[0].box.centerX, d.children[0].pos.y])
    return [
      start,
      [end[0], start[1]] as [number, number],
      end
    ]
  }, 'to-statements')

  addArrow(g.filter(s => !!s.children && !s.data.isDefault), d => {
    if (!d.children) throw new Error('no children in switchEntry')
    const start = [d.box.centerX, textHeight(d.data.labels[0]) + ELEMENT.SwitchEntry.arrowSpacing] as [number, number]
    const end = [d.box.centerX, d.box.height] as [number, number]
    return [
      start,
      end
    ]
  }, 'other-cases')

  addArrow(g.filter(s => !!s.children && s.data.isDefault), d => {
    if (!d.children) throw new Error('no children in switchEntry')
    const start = [d.box.centerX, textHeight(d.data.labels[0]) + ELEMENT.SwitchEntry.arrowSpacing] as [number, number]
    const end = [d.box.centerX, d.box.height] as [number, number]
    return [
      start,
      end
    ]
  }, 'default-case', true)

  addArrow(g.filter(s => blockContinues(s.data.block)), d => {
    if (!d.children) return []
    const block = d.children[0]
    const start = toRelative(d.pos, [block.pos.x + block.box.centerX, block.pos.y + block.box.height + ELEMENT.SwitchEntry.blockFooter.height / 4])
    const childIdx = d.parent?.children?.findIndex(c => c.data.uuid === d.data.uuid)
    if (childIdx === undefined) {
      throw new Error('Element is not a child of its parent')
    }
    const next = d.parent?.children?.at(1 + childIdx)
    let end
    if (next) { // we are not in the last case of this switch statement => fallthrough arrow
      const nextBlock = next.children?.at(0)
      if (!nextBlock) {
        throw new Error('Case does not have a block')
      }
      const nextCornerX = d.box.centerX + ELEMENT.SwitchEntry.spacing + next.box.centerX + nextBlock.box.centerX
      end = [nextCornerX, d.box.height]
    } else {
      end = [d.box.centerX, d.box.height]
    }

    return [start,
      [start[0], start[1] + ELEMENT.SwitchEntry.blockFooter.height / 4],
      [end[0], start[1] + ELEMENT.SwitchEntry.blockFooter.height / 4],
      end
    ] as [number, number][]
  }, 'switch-entry-return-from-block')

  return g
}

/**
 * Render TryCatchFinally
 * @param selection Selection of TryCatchFinally
 * @returns groups of TryCatchFinally
 */
function joinTryCatchFinallies (selection: BeforJoinSelection<TryCatchFinally>) {
  const EL = ELEMENT.TryCatchFinally
  const g = selection.join(e => {
    const stmtG = e.append('g')
      .classed('try-catch-finally', true)
    enterAnimation(stmtG)
    return stmtG
  },
  u => u.interrupt().style('opacity', 1),
  e => exitAnimation(e))

  addArrow(g,
    d => [
      [0, 0],
      [d.box.width, 0]
    ],
    'top-divider', true
  ).attr('stroke-width', MAIN_LINE_STROKE_WIDTH / 6)

  addArrow(g,
    d => {
      if (!d.children) return []
      const x = d.children[0].box.width + EL.description.width + EL.spacing
      const finallyBlockHeight = d.data.finallyBlock ? (d.children && d.children.at(-1)?.box.height) : 0
      return [
        [x, 0],
        [x, d.box.height - (finallyBlockHeight ? EL.finallyBlock.totalHeight(finallyBlockHeight) : 0)]
      ]
    },
    'divider',
    true
  ).attr('stroke-width', MAIN_LINE_STROKE_WIDTH * 2)

  addArrow(g.filter(d => !!d.data.finallyBlock),
    d => {
      const height = EL.finallyBlock.totalHeight((d.children && d.children.at(-1)?.box.height) || 0)
      return [
        [0, d.box.height - height],
        [d.box.width, d.box.height - height]
      ]
    },
    'divider-finally',
    true
  ).attr('stroke-width', MAIN_LINE_STROKE_WIDTH / 6)

  g.selectAll('text.try')
    .data(d => [d])
    .join(e => e
      .append('text')
      .classed('try', true)
      .attr('x', 0)
      .attr('y', 2)
      .attr('fill', 'cornflowerblue')
      .attr('font-size', '0.6em')
      .attr('dominant-baseline', 'hanging')
      .text('try'))

  addArrow(g, d => [[d.box.centerX, 0], [d.box.centerX, EL.tryBlock.headerHeight]], 'try-top-arrow')
  addArrow(g.filter(s => blockContinues(s.data.tryBlock)),
    d => {
      const tryBlockHeight = d.children?.at(0)?.box.height || 0
      let finallyHeight = 0

      if (d.data.finallyBlock) {
        finallyHeight = EL.finallyBlock.totalHeight((d.children?.at(-1)?.box.height) || 0)
      }
      return [
        [d.box.centerX, EL.tryBlock.headerHeight + tryBlockHeight],
        [d.box.centerX, (d.box.height ?? 0) - finallyHeight]
      ]
    }, 'try-bottom-arrow')

  g.filter(s => !!s.data.finallyBlock)
    .selectAll('text.finally')
    .data(d => [d])
    .join(e => e
      .append('text')
      .classed('finally', true)
      .attr('x', 0)
      .attr('fill', 'cornflowerblue')
      .attr('font-size', '0.6em')
      .attr('dominant-baseline', 'hanging')
      .text('finally'))
    .attr('y', d => {
      return 2 + d.box.height - ((d.children && d.children.at(-1)?.box.height) || 0) -
        EL.finallyBlock.headerHeight - EL.finallyBlock.footerHeight
    })

  g.selectAll('text.catch')
    .data(d => [d])
    .join(e => e
      .append('text')
      .classed('catch', true)
      .attr('y', 2)
      .attr('fill', 'cornflowerblue')
      .attr('font-size', '0.6em')
      .attr('dominant-baseline', 'hanging')
      .text('catch'))
    .attr('x', d => 2 + EL.description.width + EL.spacing + ((d.children && d.children.at(0)?.box.width) || 0))

  addArrow(g.filter(s => !!s.data.finallyBlock), d => {
    const finallyBlockHeight = d.children?.at(-1)?.box.height || 0
    return [[d.box.centerX, d.box.height - EL.finallyBlock.totalHeight(finallyBlockHeight)],
      [d.box.centerX, d.box.height - finallyBlockHeight - EL.finallyBlock.footerHeight]
    ]
  }, 'finallyBlock-top-arrow')
  addArrow(g.filter(s => !!s.data.finallyBlock && blockContinues(s.data.finallyBlock)), d => [
    [d.box.centerX, d.box.height - EL.finallyBlock.footerHeight],
    [d.box.centerX, d.box.height]
  ], 'finallyBlock-bottom-arrow')

  addArrow(g,
    d => [
      [0, d.box.height],
      [d.box.width, d.box.height]
    ],

    'bottom-divider',
    true
  ).attr('stroke-width', MAIN_LINE_STROKE_WIDTH / 6)

  addArrow(g,
    d => {
      const start = (d.children?.at(0)?.box.width || 0) + EL.description.width + EL.spacing
      const end = start + EL.description.width
      return [[start, ELEMENT.CatchClause.header.height / 2], [end, ELEMENT.CatchClause.header.height / 2]] as [number, number][]
    },
    'to-catch-body',
    true
  )
  return g
}

/**
 * Render CatchClauses
 * @param selection Selection of CatchClauses
 * @param collapse toggle collapse
 * @returns groups of CatchClauses
 */
function joinCatchClauses (selection: BeforJoinSelection<CatchClause>, collapse: CollapseFn) {
  const EL = ELEMENT.CatchClause
  const g = selection.join(e => {
    const stmtG = e.append('g')
      .classed('catch-clause', true)
    enterAnimation(stmtG)
    return stmtG
  },
  u => u.interrupt().style('opacity', 1),
  e => exitAnimation(e))

  g.selectAll('rect')
    .data(d => [d])
    .join(e => e.append('rect')
      .attr('fill', d => d.meta.active ? ACTIVE_COLOR : 'none')
      .attr('x', EL.header.minArrowWidth + EL.header.textPadding)
      .attr('y', 1),
    u => {
      u.transition()
        .attrTween('fill', function (d) {
          return d3.interpolateRgb('rgba(0,0,0,0)', d.meta.active ? ACTIVE_COLOR : 'rgba(0,0,0,0)')
        })
      return u
    })
    .attr('width', (d) => textWidth(d.data.parameter))
    .attr('height', (d) => textHeight(d.data.parameter))

  g.selectAll('text').data(d => [d])
    .join(e => e.append('text')
      .attr('y', d => textHeight(d.data.parameter))
      .attr('text-anchor', 'middle')
      .on('dblclick', (ev, d) => {
        ev.preventDefault()
        ev.stopPropagation()
        collapse(d.data.uuid)
      })
    )
    .attr('x', d => d.box.centerX)
    .attr('fill', d => d.meta.collapsed ? 'grey' : 'black')
    .text(d => d.meta.collapsed ? '{…}' : d.data.parameter)

  addArrow(g, d => {
    const idx = d.parent?.children?.findIndex(p => p.data.uuid === d.data.uuid)
    let delta = 0
    if (idx && idx > 0 && d.parent?.children && d.parent.children[idx - 1].data.kind === 'CatchClause') {
      const prev = d.parent.children[idx - 1]
      if (prev.meta.collapsed === false) {
        delta = -(prev.box.width - prev.box.centerX - textWidth(prev.data.parameter) / 2 - EL.header.textPadding)
      }
    }
    return [
      [delta, EL.header.height / 2],
      [EL.header.minArrowWidth, EL.header.height / 2]
    ]
  }, 'to-clause')

  addArrow(g, d => [
    [d.box.centerX, EL.header.height],
    [d.box.centerX, EL.header.height + EL.arrowHeight]
  ], 'top-arrow')
  addArrow(g.filter(s => blockContinues(s.data.body)), d => {
    let bottom = d.box.height
    if (!d.meta.collapsed) {
      let finallyHeight = 0
      if ((d.parent?.data as any as TryCatchFinally).finallyBlock) {
        finallyHeight = ELEMENT.TryCatchFinally.finallyBlock.totalHeight((d.parent?.children?.at(-1)?.box.height) || 0)
      }
      bottom = d.parent!!.box.height - finallyHeight
    }
    return [
      [d.box.centerX, d.box.height - EL.arrowHeight],
      [d.box.centerX, bottom]
    ]
  }, 'bottom-arrow')
  return g
}

/**
 * Calculates the vector AB
 * @param vector A
 * @param vector B
 * @returns vector AB
 */
function vectorAdd ([ax, ay]: [number, number], [bx, by]: [number, number]): [number, number] {
  const arr = [bx - ax, by - ay] as any
  console.assert(Number.isNaN(arr[0]) === false, arr, ax, ay, bx, by)
  return arr
}

/**
 * Rotate a vector by a given angle in degrees
 * @param vec vector
 * @param angle angle in degrees
 * @returns rotated vector
 */
function rotateVector (vec: [number, number], angle: number): [number, number] {
  angle = -angle * (Math.PI / 180)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    Math.round((vec[0] * cos - vec[1] * sin)),
    Math.round((vec[0] * sin + vec[1] * cos))
  ]
}

/**
 * Normalizes the vector
 * @param vector [x, y]
 * @returns normalized vector
 */
function normalize ([x, y]: [number, number]): [number, number] {
  const length = Math.sqrt(x * x + y * y) // calculating length
  if (length === 0) return [0, 0]
  return [x / length, y / length]
}

/**
 * create a d3.line with an arrow head
 * @param points body points of arrow
 * @returns full arrow
 */
function arrow (points: [number, number][]) {
  const ANGLE = 30
  const LENGTH = 6

  // ---o----o
  // ---A----B
  // -------->

  const A = points[points.length - 2]
  const B = points[points.length - 1]
  if (!A || !B) return line(points)
  const v = normalize(vectorAdd(A, B)).map(p => p * LENGTH) as [number, number]
  const rotatedRight = rotateVector(v, ANGLE)
  const rotatedLeft = rotateVector(v, -ANGLE)
  console.assert(Number.isNaN(rotatedRight[0]) === false, { rotatedRight, v, A, B })
  console.assert(Number.isNaN(rotatedLeft[0]) === false, { rotatedLeft, v, A, B })

  return line([...points, vectorAdd(rotatedRight, B), B, vectorAdd(rotatedLeft, B)])
}

/**
 * Adds an arrow by joining it to the selection
 * @param selection d3.js selection
 * @param pointsFn points of the arrow
 * @param className class name to identify the arrow
 * @param noHead if you dont want to use the head
 * @param stroke color of the arrow
 * @returns an arrow
 */
function addArrow<T extends AstElement> (
  selection: d3.Selection<SVGGElement | d3.BaseType, FullHierarchyNode<T>, SVGElement, FullHierarchyNode<AstElement>>,
  pointsFn: (d: FullHierarchyNode<T>) => [number, number][],
  className = 'arrow',
  noHead = false,
  stroke = 'black') {
  return selection.selectAll(`path.${className}`)
    .data(d => [d])
    .join(e => {
      return e.append('path').classed(className, true)
        .attr('stroke', stroke)
        .attr('fill', 'none')
        .attr('stroke-width', MAIN_LINE_STROKE_WIDTH)
        .classed('arrow', true)
    })
    .transition()
    .duration(COLLAPSE_TRANSITION_DURATION)
    .ease(d3.easeExpOut)
    .attrTween('d', function (d) {
      const nextPoints = pointsFn(d)

      const prevD = (this as any)?.getAttribute('d')

      let prevPath: string
      let isSame = false
      if (prevD) {
        const currentPoints: [number, number][] = dToPoints(prevD).slice(0, noHead ? undefined : -3)

        const transformedCurrentPoints = currentPoints.map((p, _idx) => ([
          p[0],
          (nextPoints[_idx] && nextPoints[_idx][1]) || p[1]
        ] as [number, number]))
        const ctp = [
          nextPoints[0],
          ...transformedCurrentPoints.slice(1, -1),
          nextPoints[nextPoints.length - 1]
        ] as [number, number][]
        prevPath = (noHead ? line(transformedCurrentPoints) : arrow(transformedCurrentPoints)) ?? ''

        isSame = nextPoints.every((np, idx) => ctp[idx] && np[0] === ctp[idx][0]) // x coordinate keeps the same
      } else {
        prevPath = prevD
      }

      const nextPath = (noHead ? line(nextPoints) : arrow(nextPoints)) ?? ''

      return function (t) {
        if (isSame) return nextPath
        return d3.interpolateString(prevPath, nextPath)(t)
      }
    })
}

/**
 * add triangles symbolizing the end of methods
 * @param selection the selection
 * @param name the class name for which to subselect
 * @param position the function for calculating the position
 * @param transition function for calculating the relevant transition
 * @param active function for finding out whether or not to highlight the triangle as active
 */
function endpoint<T extends AstElement> (
  selection: EnterSelection<T> | UpdateSelection<T>,
  name: string,
  position: ((d: FullHierarchyNode<T>) => [number, number]),
  transition: { delay: number, duration: number } = { delay: 0, duration: 0 },
  active: ((d: FullHierarchyNode<T>) => boolean) = _d => false) {
  (selection as EnterSelection<T>).selectAll(`polygon.${name}`)
    .data(d => [d])
    .join(enter =>
      enter.append('polygon')
        .classed(name, true)
        .attr('fill', d => active(d) ? ACTIVE_COLOR : 'white')
        .attr('stroke', 'black'),
    update => update.attr('fill', d => active(d) ? ACTIVE_COLOR : 'white')
    )
    .transition()
    .ease(d3.easeCircleIn)
    .delay(transition.delay)
    .duration(transition.duration)
    .attr('points', d => {
      const [x, y] = position(d)
      const width = ELEMENT.Method.header.endpointArrow.width
      const height = ELEMENT.Method.header.endpointArrow.height
      return [[x - width / 2, y - height], [x + width / 2, y - height], [x, y]]
        .map(p => p.join(','))
        .join(' ')
    })
}

/**
 * Calculates the vector relative to an position
 * @param a Position
 * @param vector [x, y] position vector
 * @returns relative position vector
 */
function toRelative (a: Position, [x, y]: [number, number]): [number, number] {
  return [x - a.x, y - a.y]
}

/**
 * Render a Diamond used in conditionals
 * @param selection d3.js selection
 * @param optionsFn options of the diamond
 * @returns diamond polygon
 */
function renderDiamond<T extends AstElement> (
  selection: d3.Selection<SVGGElement | d3.BaseType, FullHierarchyNode<T>, SVGGElement | d3.BaseType, FullHierarchyNode<T>>,
  optionsFn: (d: FullHierarchyNode<T>) => { color: string, width: number, height: number, backgroundColor?: string, cornerWidth?: number, cornerHeight?: number }) {
  return selection.selectAll('polygon.diamond')
    .data(d => [d])
    .join(e => e
      .append('polygon')
      .classed('diamond', true)
      .attr('stroke-width', MAIN_LINE_STROKE_WIDTH))
    .attr('stroke', d => optionsFn(d).color)
    .attr('fill', d => optionsFn(d).backgroundColor || 'white')
    .attr('transform', d => `translate(${-optionsFn(d).width / 2},${MAIN_LINE_STROKE_WIDTH})`)
    .attr('points', d => {
      //   /2------3\
      //  1          4
      //   \6------5/
      const options = optionsFn(d)
      const cornerWidth = options.cornerWidth || 15
      return [
        [0, options.height / 2],
        [cornerWidth, 0],
        [options.width - cornerWidth, 0],
        [options.width, options.height / 2],
        [options.width - cornerWidth, options.height],
        [cornerWidth, options.height]
      ].map(p => p.join(',')).join(' ')
    })
}

/**
 * parses the d attribute string
 * @param d only M and L commands supported
 * @returns parsed points
 */
function dToPoints (d: string): [number, number][] {
  return d.split(/M|L/).filter(x => x.length > 0)
    .map(str => str.split(',').map(x => Number.parseFloat(x)) as [number, number])
}

/**
 * Render a rich text (method call expressions, width limit)
 * @param selection target d3.js selection
 * @param fullTextFn function returning full text
 * @param fullWidthManager Full width manager
 * @param options text options
 * @param collapseFn toggle collapse
 * @param inlineFn toggle inline methods
 */
function renderRichText<T extends Conditional | Statement> (
  selection: d3.Selection<any, FullHierarchyNode<T>, any, any>,
  fullTextFn: (d: FullHierarchyNode<T>) => string,
  fullWidthManager: FullWidthManager,
  options: Partial<{
    fontSize: number,
    padding: number,
    center: boolean
  }> = {},
  collapseFn?: CollapseFn,
  inlineFn?: InlineFn
) {
  const singleCharWidth = textWidth('X')
  const fullOptions = {
    fontSize: ELEMENT.Statement.fontSize,
    padding: ELEMENT.Statement.padding,
    center: false,
    ...options
  }
  const g = selection.selectAll('g')
    .data(d => [d])
    .join(e => e.append('g'))
    .attr('transform', d => {
      if (fullOptions.center) {
        const width = fullWidthManager.hasFullWidth(d.data.uuid) ? textWidth(fullTextFn(d)) : Math.min(textWidth(fullTextFn(d)), ELEMENT.Statement.maxWidth)
        return 'translate(' + -width / 2 + ',0)'
      }
      return 'translate(0,0)'
    })

  g.selectAll('text')
    .data(d => [d])
    .join(e => {
      const el = e.append('text')
        .attr('fill', 'black')
        .attr('x', fullOptions.padding / 2)
        .attr('y', fullOptions.padding / 2 + fullOptions.fontSize - 1)
      if (collapseFn) {
        el.on('dblclick', (ev: MouseEvent, d) => {
          ev.stopPropagation()
          ev.preventDefault()
          collapseFn(d.data.uuid)
        })
          .classed('collapsible', true)
      }
      return el
    })
    .text(d => {
      if (fullWidthManager.hasFullWidth(d.data.uuid)) {
        return fullTextFn(d)
      } else {
        return fitText(fullTextFn(d), ELEMENT.Statement.maxWidth, '…')
      }
    })

  if (ELEMENT.Statement.maxWidth !== Number.MAX_VALUE) {
    g.append('title')
      .text(fullTextFn)
  }

  g.selectAll('rect.method-calls')
    .data(d => {
      if (fullWidthManager.hasFullWidth(d.data.uuid)) {
        return d.data.methodCallExpressions.filter(c => c.candidates.length > 0).map(c => ({ mce: c, fullWidth: true }))
      } else {
        // at least one char has to be visible
        return d.data.methodCallExpressions
          .filter(c => c.candidates.length > 0)
          .filter(c => (c.deltaBegin + 1) * singleCharWidth < ELEMENT.Statement.maxWidth)
          .map(c => ({ mce: c, fullWidth: false }))
      }
    })
    .join(e => {
      const el = e.append('rect')
        .classed('method-calls', true)
        .attr('fill', METHOD_CALL_COLOR)
        .attr('x', d => fullOptions.padding / 2 + singleCharWidth * d.mce.deltaBegin)
        .attr('y', 0)
        .attr('height', fullOptions.fontSize + fullOptions.padding)
      if (inlineFn) {
        el.on('dblclick', async (ev: MouseEvent, d) => {
          ev.preventDefault()
          ev.stopPropagation()
          await inlineFn(d.mce.uuid, d.mce.candidates)
        })
          .classed('collapsible', true)
      }
      return el
    })
    .attr('width', d => {
      if (d.fullWidth) return textWidth(d.mce.name)
      return Math.min(ELEMENT.Statement.maxWidth - d.mce.deltaBegin * singleCharWidth, textWidth(d.mce.name))
    })

  g.filter(d => textWidth(fullTextFn(d)) > ELEMENT.Statement.maxWidth)
    .selectAll('text.cap')
    .data(d => [d])
    .join(e => e.append('text')
      .classed('cap', true)
      .attr('fill', 'grey')
      .attr('x', d => {
        const width = textWidth(fullTextFn(d))
        if (width > ELEMENT.Statement.maxWidth && fullWidthManager.hasFullWidth(d.data.uuid) === false) {
          return fullOptions.padding / 2 + ELEMENT.Statement.maxWidth - singleCharWidth
        } else {
          return fullOptions.padding / 2 + width
        }
      })
      .attr('y', fullOptions.padding / 2 + fullOptions.fontSize - 1)
      .text(d => textWidth(fullTextFn(d)) > ELEMENT.Statement.maxWidth && fullWidthManager.hasFullWidth(d.data.uuid) === false ? '…' : '⊟')
      .on('dblclick', (ev: MouseEvent, d) => {
        ev.stopPropagation()
        ev.preventDefault()
        fullWidthManager.toggle(d.data.uuid)
      })
      .on('click', (ev: MouseEvent, d) => {
        if ((textWidth(fullTextFn(d)) > ELEMENT.Statement.maxWidth && fullWidthManager.hasFullWidth(d.data.uuid) === false) === false) {
          ev.stopPropagation()
          ev.preventDefault()
          fullWidthManager.toggle(d.data.uuid)
        }
      })
      .classed('collapsible', true))
}

/**
 * Show the BoundingBox of a selection
 * @param selection target selection
 */
function _addDebugInformation<T extends AstElement> (selection: BeforJoinSelection<T>) {
  const debug = selection.selectAll('g.debug')
    .data(d => [d])
    .join(e => e.append('g')
      .classed('debug', true))

  debug.selectAll('rect')
    .data(d => [d])
    .join(e => e.append('rect')
      .attr('stroke', `rgb(${Math.round(Math.random() * 200) + 50},${Math.round(Math.random() * 200) + 50},${Math.round(Math.random() * 200) + 50})`)
      .attr('fill', 'rgba(0,0,0,0.2)')
      .attr('x', 0)
      .attr('y', 0))
    .attr('width', d => d.box.width)
    .attr('height', d => d.box.height)

  addArrow(debug as any, d => {
    return [toRelative(d.pos, [d.pos.x + d.box.centerX, d.pos.y]),
      toRelative(d.pos, [d.pos.x + d.box.centerX, d.pos.y + d.box.height])
    ]
  }).attr('stroke', `rgba(${Math.round(Math.random() * 200) + 50},${Math.round(Math.random() * 200) + 50},${Math.round(Math.random() * 200) + 50}, 0.6)`)
    .attr('stroke-width', 2)
}
