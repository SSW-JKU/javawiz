import {
  DockingPosition,
  PositionedSizedHierarchyNode,
  isPositionedSizedHierarchyNode,
  SizedHierarchyNode,
  FullHierarchyNode
} from './types'

import { ELEMENT } from './Element'
import { textHeight, textWidth } from '@/components/TheFlowChart/Font'
import { BoundingBoxContext } from './size'
import { FullWidthManager } from './FullWidthManager'
import { AstElement, Block, Method } from '@/dto/AbstractSyntaxTree'

export interface Position {
  x: number;
  y: number;
}

/**
 * Find the index of a node in the list of children of the parent
 * @param d HierarchyNode
 * @returns index of node
 */
function findIdxInParent (d: d3.HierarchyNode<AstElement>): number {
  if (d.parent && d.parent.children && (d.parent.children?.length || 0) > 1) {
    // calculate idx if node has siblings
    return d.parent.children.findIndex(p => p.data.uuid === d.data.uuid)
  }
  return 0
}

/**
 * Return a position for a node by moving it relative to its parent
 * @param d target node
 * @param deltaX move on x-axis relative to parent
 * @param deltaY move on y-axis relative to parent
 * @param options extra options
 * @returns Position
 */
function set (d: SizedHierarchyNode<AstElement>, deltaX: number, deltaY: number, options?: { ignoreSiblings: boolean, horizontal: boolean }): Position {
  const vertical = options ? !options.horizontal : true
  const ignoreSiblings = (options && options.ignoreSiblings) || false

  // find anchor position
  const anchor = d.parent || d
  const anchorX = isPositionedSizedHierarchyNode(anchor) ? anchor.pos.x : 0
  const anchorY = isPositionedSizedHierarchyNode(anchor) ? anchor.pos.y : 0

  let offsetX = 0
  let offsetY = 0

  // calculation inside of parent
  if (!ignoreSiblings && d.parent && d.parent.children) {
    const idxInParent = findIdxInParent(d)
    for (let siblingIdx = 0; siblingIdx < idxInParent; siblingIdx++) {
      const sibling = d.parent.children[siblingIdx]
      const { height, width } = sibling.box

      if (vertical) {
        offsetY += height
      } else {
        offsetX += width
      }
    }
  }
  // END calculation inside of parent

  return {
    x: anchorX + Math.max(offsetX + deltaX, 0),
    y: anchorY + Math.max(offsetY + deltaY, 0)
  }
}

export class PositionContext {
  constructor (
    private readonly boundingBoxContext: BoundingBoxContext,
    private readonly fullWidthManager: FullWidthManager
  ) { }

  /**
   * Calculate the position of an HierarchyNode
   * @param d target node
   * @param moveTo absolute movement
   * @returns Position
   */
  calculatePosition (d: SizedHierarchyNode<AstElement>, moveTo: Partial<{ posX: number, posY: number }>): Position {
    // no parent means 0,0 position

    if (!d.parent) {
      return set(d, moveTo.posX || 0, moveTo.posY || 0, { ignoreSiblings: true, horizontal: true })
    }

    switch (d.parent.data.kind) {
      case 'Block':
        return set(d,
          d.parent.box.centerX - d.box.centerX,
          ELEMENT.Block.children.translation.y)
      case 'Method':
        return set(d,
          d.parent.box.centerX - d.box.centerX,
          ELEMENT.Method.children.translation.y + ELEMENT.Method.padding.yAxis / 2)
      case 'IfStatement': {
        if (!d.parent.children) throw new Error('No true case provided')
        const EL = ELEMENT.IfStatement
        const ifStmt = d.parent.data

        let rightBox = ELEMENT.empty
        if (EL.trueCaseLeft && d.parent.children[1] && d.parent.children[1].data.kind === 'Block') {
          rightBox = d.parent.children[1].box
        } else if (!EL.trueCaseLeft) {
          rightBox = d.parent.children[0].box
        }

        const data = d.data

        if (data.kind === 'Method') {
          // this should be a inlined method
          // d.parent.children doesnt contain the inlined methods here!
          const exprIdx = d.parent.data.methodCallExpressions.findIndex(m => m.name === data.name)
          if (exprIdx < 0) throw new Error('Expression not found ' + data.name)

          return set(d,
            EL.padding / 2 - rightBox.width + this.boundingBoxContext.INLINED_METHOD_SPACING * (exprIdx + 1),
            EL.header.height + this.boundingBoxContext.INLINED_METHOD_SPACING / 2, { ignoreSiblings: false, horizontal: true })
        }
        if (
          (ifStmt.trueCase === d.data && EL.trueCaseLeft) ||
          (!EL.trueCaseLeft && ifStmt.trueCase !== d.data)
        ) {
          // left side
          return set(d, EL.padding, EL.header.height, { ignoreSiblings: true, horizontal: false })
        } else {
          // right side
          const rightDeltaX = Math.max(
            d.parent.box.centerX + EL.padding,
            d.parent.box.width - EL.padding - d.box.width
          )
          return set(d,
            rightDeltaX,
            EL.header.height,
            {
              ignoreSiblings: true,
              horizontal: false
            })
        }
      }
      case 'Conditional': {
        const EL = ELEMENT.Conditional
        const data = d.data

        let offsetMethodCall = 0
        let offsetStatements = 0
        if (d.parent.data.type === 'DO_WHILE') {
          const doWhile = d.parent.data
          const blockHeight = d.parent?.children?.at(0)?.box?.height ?? 0
          const conditionSize = this.boundingBoxContext.getConditionSize(textWidth(doWhile.condition), doWhile.methodCallExpressions, textHeight(doWhile.condition)).height
          offsetMethodCall = blockHeight + EL.header.height.total + EL.footer.connectionCircleRadius
          offsetStatements = textHeight(doWhile.condition) - conditionSize
        }

        if (data.kind === 'Method') {
          const blockWidth = (d.parent.children && d.parent.children[0].box.width) || 0
          // this should be a inlined method
          // d.parent.children doesnt contain the inlined methods here!
          const exprIdx = d.parent.data.methodCallExpressions.findIndex(m => m.name === data.name)
          if (exprIdx < 0) throw new Error('Expression not found ' + data.name)

          return set(d,
            EL.padding / 2 + this.boundingBoxContext.INLINED_METHOD_SPACING * (exprIdx + 1) - blockWidth,
            EL.header.height.total + offsetMethodCall, { ignoreSiblings: false, horizontal: true })
        }
        return set(d,
          d.parent.box.centerX - d.box.centerX,
          d.parent.box.height - d.box.height - EL.footer.height + offsetStatements
        )
      }
      case 'Class': {
        return set(d, d.parent.box.centerX - d.box.centerX, ELEMENT.Class.methodSpacing / 2 + ELEMENT.Class.methodSpacing * findIdxInParent(d))
      }
      case 'Statement': {
        // this should be a inlined method
        const data = d.data as Method
        const exprIdx = d.parent.data.methodCallExpressions.findIndex(m => m.name === data.name)
        if (exprIdx < 0) {
          throw new Error('Expression not found ' + data.name)
        }

        return set(d,
          this.boundingBoxContext.INLINED_METHOD_SPACING * exprIdx,
          ELEMENT.Statement.fontSize + this.boundingBoxContext.INLINED_METHOD_SPACING, { ignoreSiblings: false, horizontal: true })
      }
      case 'Switch': {
        return set(d, d.parent.box.centerX - d.box.centerX, ELEMENT.Switch.header.height + ELEMENT.Switch.padding / 2)
      }
      case 'SwitchEntry': {
        return set(d, textWidth(d.parent.data.labels.join(', ')) + ELEMENT.SwitchEntry.spacing, ELEMENT.SwitchEntry.header.height('X'))
      }
      case 'TryCatchFinally': {
        if (!d.parent.children) throw new Error('No children found')
        const EL = ELEMENT.TryCatchFinally

        const tryBlock = d.parent.children[0] as FullHierarchyNode<Block>

        if (d.data.kind === 'Block') {
          if (d.data.uuid === tryBlock.data.uuid) {
            // is a try block
            return set(d, d.parent.box.centerX - tryBlock.box.centerX, EL.tryBlock.headerHeight)
          } else {
            const finallyBox = d.parent.children.at(-1)?.box || ELEMENT.empty
            return set(d,
              d.parent.box.centerX - finallyBox.centerX,
              d.parent.box.height - finallyBox.height - EL.finallyBlock.headerHeight,
              { ignoreSiblings: true, horizontal: false }
            )
          }
        } else {
          return set(d, EL.spacing + EL.description.width * 2,
            0,
            { horizontal: true, ignoreSiblings: false }
          )
        }
      }
      case 'CatchClause':
        return set(d,
          d.parent.box.centerX - d.box.centerX, ELEMENT.CatchClause.header.height + ELEMENT.CatchClause.arrowHeight
        )
      default:
        return set(d, 0, 0)
    }
  }
}

/**
 * This function can provide docking positions for arrows
 * It would be possible to handle custom edge cases but for now it is not needed.
 * @param d target node
 * @param position docking position
 * @returns [x, y] coordinates
 */
export function dockingPosition<T extends AstElement> (d: PositionedSizedHierarchyNode<T>, position: DockingPosition): [number, number] {
  switch (position) {
    case 'top': {
      return [d.pos.x + d.box.centerX, d.pos.y]
    }
    case 'bottom': {
      return [d.pos.x + d.box.centerX, d.pos.y + d.box.height]
    }
    default: throw new Error('Invalid position')
  }
}
