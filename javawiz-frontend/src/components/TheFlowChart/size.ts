import { InlinedFnMap } from '@/components/TheFlowChart/types'
import { textSize, textWidth } from '@/components/TheFlowChart/Font'
import { blockContinues } from './meta-utils'
import { shadow } from './ast-utils'
import { ELEMENT } from './Element'
import { FullWidthManager } from './FullWidthManager'
import { AstElement, MethodCallExpr } from '@/dto/AbstractSyntaxTree'

export interface BoundingBox {
  width: number;
  height: number;
  centerX: number;
}

/**
 * Combine to bounding box (default in stacked order)
 * @description calculate biggest left and right side of both boxes and use this maximas as new box
 * @param a bounding box
 * @param b bounding box
 * @returns combined bounding box
 */
function combineBoxes (a: BoundingBox, b: BoundingBox, stackHorizontal = false): BoundingBox {
  if (stackHorizontal) {
    return {
      width: a.width + b.width,
      height: Math.max(a.height, b.height),
      centerX: a.centerX
    }
  }
  const left = Math.max(a.centerX, b.centerX)
  const right = Math.max(a.width - a.centerX, b.width - b.centerX)

  return {
    width: left + right,
    height: a.height + b.height,
    centerX: left
  }
}

export class BoundingBoxContext {
  public readonly INLINED_METHOD_SPACING = 10 // spacing between inlined methods

  cache = new Map<string, BoundingBox>()
  collapsedCache = new Map<string, BoundingBox>()

  constructor (
    private readonly collapsedElements: Set<string>,
    private readonly inlinedMethods: InlinedFnMap,
    private readonly fullWidthManager: FullWidthManager
  ) { }

  /**
   * Public facing method for retrieving the BoundingBox
   * @param el AstElement
   * @returns BoundingBox
   */
  public getBoundingBox (el: AstElement): BoundingBox {
    return this.cachedBoundingBox(el)
  }

  /**
   * Reset the caches
   */
  public reset () {
    this.cache.clear()
    this.collapsedCache.clear()
  }

  /**
   * Returns the BoundingBox from cache or calculates it and stores in cache.
   * @param el target AstElement
   * @returns BoundingBox
   */
  private cachedBoundingBox (el: AstElement): BoundingBox {
    let box

    box = this.collapsedCache.get(el.uuid)
    if (!box) {
      if (this.isCollapsed(el)) {
        if (el.kind === 'CatchClause') {
          box = ELEMENT.CatchClause.collapsedBox
        } else {
          box = ELEMENT.Block.collapsedBox
        }
      } else {
        box = this.calculateBoundingBox(el)
      }
      box = this.combineWithInlinedFnBox(el, box)
      this.collapsedCache.set(el.uuid, box)
    }
    return box
  }

  /**
   * Check if an AstElement is collapsed
   * @param element target AstElement
   * @returns true if it is collapsed
   */
  private isCollapsed (element: AstElement): boolean {
    return this.collapsedElements.has(element.uuid)
  }

  /**
   * Add the size of the inlined methods to the bounding box of a statement
   * @param el target AstElement
   * @param box current bounding box of AstElement
   * @returns Modified BoundingBox
   */
  private combineWithInlinedFnBox (el: AstElement, box: BoundingBox): BoundingBox {
    if (el.kind !== 'Statement' || el.methodCallExpressions.length === 0) return box
    const callUuids = el.methodCallExpressions.map(mce => mce.uuid)

    let height = 0
    let width = 0
    for (const id of callUuids) {
      const method = this.inlinedMethods.get(id)
      if (!method) continue
      const methodBox = this.cachedBoundingBox(shadow(method, id))
      width += methodBox.width + this.INLINED_METHOD_SPACING
      height = Math.max(height, methodBox.height) + (height > 0 ? 0 : this.INLINED_METHOD_SPACING)
    }

    box.width = Math.max(box.width, width)
    box.height += height
    return box
  }

  /**
   * Calculates the full size of a condition including dynamic features like inline methods
   * @param conditionWidth width of the condition text
   * @param methodCallExpressions list of all method call expressions
   * @param conditionHeight current height of the condition text
   * @returns height and width of the full condition
   */
  getConditionSize (conditionWidth: number, methodCallExpressions: MethodCallExpr[], conditionHeight: number) {
    let inlinedHeight = 0
    let inlinedWidth = 0
    for (const methodCallExpression of methodCallExpressions) {
      const method = this.inlinedMethods.get(methodCallExpression.uuid)
      if (!method) continue

      const box = this.cachedBoundingBox(shadow(method, methodCallExpression.uuid))
      inlinedWidth += box.width
      inlinedHeight = Math.max(box.height, inlinedHeight)
    }
    /*
    this.inlinedMethods.forEach(({ uuidsToMethodAst }) => {
      methodCallExpressions.forEach(mce => {
        if (uuidsToMethodAst.has(mce.uuid)) {
          const box = this.cachedBoundingBox(shadow(uuidsToMethodAst.get(mce.uuid)!!, mce.uuid))
          inlinedWidth += box.width
          inlinedHeight = Math.max(box.height, inlinedHeight)
        }
      })
    })
      */
    return {
      height: conditionHeight + (inlinedHeight === 0 ? 0 : inlinedHeight + this.INLINED_METHOD_SPACING),
      width: Math.max(conditionWidth, inlinedWidth + this.INLINED_METHOD_SPACING)
    }
  }

  /**
   * Calculate the bounding box of a given element
   * @param el AstELement
   * @returns BoundingBox of el
   */
  private calculateBoundingBox (el: AstElement): BoundingBox {
    switch (el.kind) {
      case 'Statement': {
        const EL = ELEMENT.Statement
        const textBox = textSize(el.code)

        let height = textBox.height

        if (el.endOfStatementList) height += EL.endOfStatementList.height

        if (el.type !== 'OTHER') height += EL.specialType.height[el.type]

        return {
          width: (this.fullWidthManager.hasFullWidth(el.uuid) ? textBox.width : Math.min(textBox.width, EL.maxWidth)) + EL.padding,
          height,
          centerX: EL.translation.x
        }
      }
      case 'Block': {
        const stmts = el.statements.reduce((act, cur) => {
          const box = this.cachedBoundingBox(cur)
          if (!act) return box
          const result = combineBoxes(act, box)
          return result
        }, ELEMENT.empty)

        const result = {
          width: stmts.width + ELEMENT.Block.padding.xAxis,
          height: stmts.height + ELEMENT.Block.padding.yAxis,
          centerX: stmts.centerX
        }

        return result
      }
      case 'Conditional': {
        const EL = ELEMENT.Conditional
        const headerBox = this.getConditionSize(EL.header.width(el.condition, this.fullWidthManager.hasFullWidth(el.uuid)), el.methodCallExpressions, EL.header.height.total)
        const trueBox = this.cachedBoundingBox(el.trueCase)
        const left = Math.max(headerBox.width / 2 + EL.repeatLine.minWidth, trueBox.centerX + EL.repeatLine.blockWidth)
        const right = Math.max(headerBox.width / 2, trueBox.width - trueBox.centerX)

        return {
          height: trueBox.height + headerBox.height + EL.footer.height,
          width: EL.padding + left + right,
          centerX: left + EL.padding / 2
        }
      }
      case 'IfStatement': {
        const EL = ELEMENT.IfStatement
        const stmt = el
        const headerSize = this.getConditionSize(EL.header.width(stmt.condition, this.fullWidthManager.hasFullWidth(el.uuid)), el.methodCallExpressions, EL.header.height)

        const trueBox = this.cachedBoundingBox(el.trueCase)
        const falseBox = (stmt.falseCase && this.cachedBoundingBox(stmt.falseCase)) || EL.emptyBlock

        const leftBox = EL.trueCaseLeft ? trueBox : falseBox
        const rightBox = EL.trueCaseLeft ? falseBox : trueBox

        const minSpace = EL.padding // minimal horizontal space between center of box and border of header
        let leftWidth = EL.padding + Math.max(leftBox.width + minSpace, headerSize.width / 2 + minSpace + leftBox.centerX)
        let rightWidth = EL.padding + Math.max(rightBox.width + minSpace, headerSize.width / 2 + minSpace + rightBox.width - rightBox.centerX)
        if (stmt.methodCallExpressions.find(mce => this.inlinedMethods.has(mce.uuid))) { // make space for inlined methods in condition
          leftWidth = EL.padding + leftBox.width + headerSize.width / 2
          rightWidth = headerSize.width / 2 + rightBox.width + EL.padding
        }
        const width = leftWidth + rightWidth

        let height = headerSize.height + Math.max(trueBox.height, falseBox.height) + EL.footer.height
        if (headerSize.height > EL.header.height + Math.max(trueBox.height, falseBox.height)) {
          // inlined method is higher than the bodys of all branches
          height = headerSize.height + EL.footer.height
        }

        return {
          height,
          width,
          centerX: leftWidth
        }
      }
      case 'Switch': {
        const EL = ELEMENT.Switch

        const entriesIncludingDefault = el.defaultEntry ? [el.defaultEntry, ...el.entries] : el.entries
        const entriesIncludingDefaultBox = entriesIncludingDefault.reduce((acc, entry) => combineBoxes(acc, this.cachedBoundingBox(entry)), ELEMENT.empty)

        return {
          centerX: entriesIncludingDefaultBox.centerX,
          width: Math.max(
            EL.header.width(el.selector),
            entriesIncludingDefaultBox.width
          ) + EL.padding,
          height: EL.header.height + entriesIncludingDefaultBox.height + EL.padding + EL.footer.height
        }
      }
      case 'SwitchEntry': {
        const blockBox = this.cachedBoundingBox(el.block)
        const labelBox = textSize(el.labels.join(', '))

        return {
          centerX: labelBox.width / 2,
          height: blockBox.height + ELEMENT.SwitchEntry.header.height(el.labels[0]) + ELEMENT.SwitchEntry.blockFooter.height,
          width: labelBox.width + ELEMENT.SwitchEntry.spacing + blockBox.width
        }
      }
      case 'TryCatchFinally': {
        const EL = ELEMENT.TryCatchFinally
        const tryBox = this.cachedBoundingBox(el.tryBlock)
        const catchesBox = el.catchClauses.reduce((act, cur) => combineBoxes(act, this.cachedBoundingBox(cur), true), ELEMENT.empty)
        const finallyBlock = el.finallyBlock ? this.cachedBoundingBox(el.finallyBlock) : ELEMENT.empty

        const width = Math.max(
          tryBox.width + catchesBox.width + EL.description.width * 2 + EL.spacing,
          finallyBlock.width
        )

        return {
          width,
          height: Math.max(EL.tryBlock.totalHeight(tryBox.height), catchesBox.height) +
            (finallyBlock.height > 0 ? EL.finallyBlock.totalHeight(finallyBlock.height) : 0),
          centerX: Math.max(tryBox.centerX, finallyBlock.centerX) + EL.description.width
        }
      }
      case 'CatchClause': {
        const textBox = textSize(el.parameter)
        const bodyBox = this.cachedBoundingBox(el.body)
        const centerX = Math.max(bodyBox.centerX,
          ELEMENT.CatchClause.header.minArrowWidth + ELEMENT.CatchClause.header.textPadding + textBox.width / 2
        )
        return {
          width: centerX + Math.max(ELEMENT.CatchClause.header.textPadding + textBox.width / 2, bodyBox.width - bodyBox.centerX),
          height: ELEMENT.CatchClause.header.height + bodyBox.height + ELEMENT.CatchClause.arrowHeight * (blockContinues(el.body) ? 2 : 1),
          centerX
        }
      }
      case 'Method': {
        const EL = ELEMENT.Method
        const blockBox = this.cachedBoundingBox(el.body)

        const headerWidth = Math.max(textWidth(el.signature), EL.header.endpointArrow.width)
        const centerX = EL.padding.xAxis / 2 + Math.max(blockBox.centerX, headerWidth / 2)
        const width = centerX + Math.max(headerWidth / 2, blockBox.width - blockBox.centerX) + EL.padding.xAxis / 2
        const height = blockBox.height + EL.header.height + EL.footer.height + EL.padding.yAxis

        return {
          width,
          height,
          centerX
        }
      }
      case 'Class': {
        const box = el.methods.map(m => this.cachedBoundingBox(m))
          .reduce((act, cur) => {
            if (!act) return cur
            return combineBoxes(act, cur)
          }, ELEMENT.empty)
        box.height = box.height + ELEMENT.Class.methodSpacing * el.methods.length - 1
        return box
      }
      default:
        return ELEMENT.empty
    }
  }
}
