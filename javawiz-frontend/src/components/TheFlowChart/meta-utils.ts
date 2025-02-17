import { HierarchyNode } from 'd3'
import { FullHierarchyNode, CallSite } from './types'
import { AstElement, Block, SwitchEntry } from '@/dto/AbstractSyntaxTree'

/**
 * Opens collapsed elements that need to be expanded
 * @param stackFrameMethods locations within the current stack
 * @param ast AST
 * @param collapsed set of collapsed elements
 * @returns set of temporary collapsed elements
 */
export function openCollapsedUntilHighlight (
  stackFrameMethods: CallSite[],
  ast: HierarchyNode<AstElement>,
  collapsed: Set<string>) {
  const result = new Set([...collapsed])
  const activeLine = stackFrameMethods[0].line
  const activeNode = ast.descendants().find(node => hasActiveLine(activeLine, node, stackFrameMethods))
  if (!activeNode) {
    return result // typically happens when we are at the end of the program
  }

  activeNode.ancestors().forEach(node => {
    if (node.data) {
      result.delete(node.data.uuid)
    }
  })

  return result
}

/**
 * add all newly created catch clauses to the set of collapsed elements
 * @param ast current ast
 * @param collapsed the set of uuids of collapsed elements
 * @param everCollapsed the set of uuids of elements that have been collapsed at some point in the past
 */
export function addCatchClausesToCollapsed (ast: HierarchyNode<AstElement>, collapsed: Set<string>, everCollapsed: Set<string>) {
  ast.descendants()
    .filter(n => n.data && n.data.kind === 'CatchClause' && !everCollapsed.has(n.data.uuid))
    .forEach(n => collapsed.add(n.data.uuid))
}

/**
 * Check if element is active
 * @param activeLine active line of code
 * @param node target element
 * @param stackFrameLocations method names of call stack
 * @returns true if element is active (an active children doesnt count) A method is considered active if we are in its last line
 */
export function hasActiveLine (activeLine: number, node: d3.HierarchyNode<AstElement>, stackFrameLocations: CallSite[]): boolean {
  { // make sure that we are in the correct call in the correct inlined method
    const ancestors = node.ancestors()
    let j = 0
    for (let i = 0; i < ancestors.length; i++) {
      const data = ancestors[i].data
      if (data.kind !== 'Method') continue
      j++
      if (i < ancestors.length - 1 &&
        j < stackFrameLocations.length &&
        (stackFrameLocations[j].line < ancestors[i + 1].data.begin || ancestors[i + 1].data.end < stackFrameLocations[j].line)) {
        if (ancestors[i + 1].data.end) {
          return false // wrong call site (identified only by line number rather than code point as an approximation)
        }
      }
    }
    if (j < stackFrameLocations.length) {
      return false // ran out of ancestors before running out of stack
    }
  }

  switch (node.data.kind) {
    case 'CatchClause':
      return node.data.beginParameter <= activeLine && activeLine <= node.data.endParameter
    case 'Conditional':
    case 'IfStatement':
      return node.data.beginCondition <= activeLine && activeLine <= node.data.endCondition
    case 'Switch':
      return node.data.begin === activeLine // highlight selector in switch
    case 'Method':
      return node.data.end === activeLine // highlight end in method
    case 'TryCatchFinally': case 'SwitchEntry':
      return false
    case 'Block': {
      const parent = node.parent?.data
      if (parent && parent.kind === 'Conditional' && parent.type === 'WHILE') {
        return parent.end === activeLine && (parent.trueCase.statements.at(-1)?.end ?? -1) < parent.end
      }
      return false
    }
    default: {
      const parent = node.parent
      if (parent?.parent &&
        (parent.parent.data.kind === 'IfStatement' || parent.parent.data.kind === 'Conditional') &&
        parent.parent.data.beginCondition === node.data.begin) {
        // conditional oneliner workaround
        return false
      }
      return node.data.begin <= activeLine && activeLine <= node.data.end
    }
  }
}

/**
 * Check if a block continues or if all branches end beforehand
 * @param block block to check
 * @returns if the flow in this block continues
 */
export function blockContinues (block: Block): boolean {
  const lastStatement = block.statements.at(-1)
  if (lastStatement && lastStatement.kind === 'IfStatement') {
    const elseBlock = lastStatement.falseCase
    return blockContinues(lastStatement.trueCase) || !elseBlock || blockContinues(elseBlock)
  } else if (lastStatement && lastStatement.kind === 'TryCatchFinally') {
    if (lastStatement.finallyBlock) return blockContinues(lastStatement.finallyBlock)
    return blockContinues(lastStatement.tryBlock) || lastStatement.catchClauses.some(cl => blockContinues(cl.body))
  } else if (lastStatement?.kind === 'Block') {
    return blockContinues(lastStatement)
  }
  return !lastStatement || lastStatement.kind !== 'Statement' || lastStatement.type === 'OTHER'
}

/**
 * Creates a toggle function for collapsing.
 * @param ast AST
 * @param collapsed set of collapsed node uuids
 * @returns function to collapse/expand an element by uuid
 */
export function createCollapseToggleFn (ast: FullHierarchyNode<AstElement>, collapsed: Set<string>) {
  return (uuid: string) => {
    const node = ast.find(n => n.data.uuid === uuid)
    if (!node) { throw new Error('Node with uuid ' + uuid + ' not found') }
    let blocks: string[] = []
    switch (node.data.kind) {
      case 'Block':
        blocks.push(node.data.uuid)
        break
      case 'IfStatement':
      case 'Conditional': {
        const uuids = node.children?.map(c => c.data.uuid)
        if (uuids) { blocks = uuids }
        break
      }
      case 'Switch': {
        const uuids = node.children?.map(c => (c.data as SwitchEntry).block.uuid)
        if (uuids) { blocks = uuids }
        break
      }
      case 'CatchClause': {
        blocks = [node.data.uuid]
        break
      }
      default: {
        const block = node.ancestors().find(d => d.data.kind === 'Block')
        if (block) { blocks.push(block.data.uuid) }
        break
      }
    }
    if (blocks.reduce((acc, cur) => {
      return acc + (collapsed.has(cur) ? 1 : -1)
    }, 0) > 0) {
      // most are currently collapsed
      // uncollapse blocks
      blocks.forEach(block => collapsed.delete(block))
    } else {
      // most are currently NOT collapsed
      // collapse blocks
      blocks.forEach(block => collapsed.add(block))
    }
  }
}

/**
 * Find the first active statement within the current ast
 * @param ast The ast where the statement is searched
 * @returns The FullHierarchyNode of the active statement, or undefined if no such statement is found
 */
export function findActiveStatement (ast: FullHierarchyNode<AstElement>) {
  return ast.descendants().filter(d =>
    d.data &&
    (d.data.kind === 'Statement' ||
    d.data.kind === 'IfStatement' ||
    d.data.kind === 'Conditional' ||
    d.data.kind === 'Switch' ||
    d.data.kind === 'CatchClause' ||
    d.data.kind === 'Method' ||
    d.data.kind === 'Block'))
    .find(d => d.meta.active)
}

/**
 * Calculate the focus coordinates of the given hierarchy node, relative to the chart root.
 * The focus coordinates are the coordinates around which the flowchart is centered.
 * @param node the node
 * @returns the coordinates
 */
export function getFocusCoordinates (node: FullHierarchyNode<AstElement>): {x: number, y: number} {
  const x = node.pos.x + node.box.centerX
  let y = node.pos.y

  switch (node.data.kind) {
    case 'Method':
      y = node.pos.y + node.box.height
      break
    case 'Conditional':
      if (node.data.type === 'DO_WHILE') {
        y = node.pos.y + node.box.height
      }
  }
  return { x, y }
}
