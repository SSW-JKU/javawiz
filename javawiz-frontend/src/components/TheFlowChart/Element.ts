import { textHeight, textWidth } from '@/components/TheFlowChart/Font'
import { BoundingBox } from './size'

const TRUE_CASE_LEFT = 'trueCaseLeft'

/**
 * rendering constants
 */
export const ELEMENT = {
  empty: {
    width: 0,
    height: 0,
    centerX: 0
  },
  Statement: {
    padding: 4,
    translation: {
      x: 20
    },
    endOfStatementList: {
      height: 16
    },
    specialType: {
      height: {
        BREAK: 10,
        YIELD: 10,
        CONTINUE: 10,
        RETURN: 20,
        THROW: 20
      },
      symbolHeight: {
        BREAK: 8,
        YIELD: 8,
        CONTINUE: 8,
        RETURN: 15,
        THROW: 18
      }
    },
    maxWidth: 150,
    fontSize: 12
  },
  Block: {
    padding: {
      get xAxis () { return this.yAxis },
      yAxis: 2
    },
    children: {
      translation: {
        x: 2,
        y: 2
      }
    },
    collapsedBox: {
      height: 16,
      width: 30,
      centerX: 15
    } as BoundingBox,
    overlayBottomOffset: 30
  },
  Method: {
    color: {
      primary: 'black'
    },
    padding: {
      xAxis: 16,
      yAxis: 16
    },
    header: {
      get height () { return this.signatureContainer.height + 2 * this.endpointArrow.height },
      signatureContainer: {
        height: 20
      },
      endpointArrow: {
        height: 15,
        width: 30
      }
    },
    children: {
      translation: {
        // x: 8,
        get y () {
          return ELEMENT.Method.header.endpointArrow.height +
            ELEMENT.Method.header.signatureContainer.height + 15
        }
      }
    },
    footer: {
      height: 15 // endpoint arrow
    }
  },
  IfStatement: {
    get trueCaseLeft (): boolean {
      return JSON.parse(localStorage.getItem(TRUE_CASE_LEFT) || 'true') as boolean
    },
    set trueCaseLeft (val: boolean) {
      localStorage.setItem(TRUE_CASE_LEFT, JSON.stringify(val))
    },
    emptyBlock: {
      width: 30,
      height: 20,
      get centerX (): number { return this.width / 2 }
    },
    header: {
      color: {
        container: 'black'
      },
      padding: 8,
      get height () { return ELEMENT.Statement.fontSize + this.padding },
      width: function (text: string, isFullWidth: boolean): number {
        const padding = 10
        if (isFullWidth) {
          return textWidth(text + '-') + padding
        } else {
          return Math.min(ELEMENT.Statement.maxWidth, textWidth(text)) + padding
        }
      },
      caseTextSpacing: 6
    },
    spacing: 60, // minimum space between true and false case
    padding: 16,
    footer: {
      height: 24,
      collapsedHeight: 8
    }
  },
  Conditional: {
    header: {
      color: {
        container: 'black'
      },
      height: {
        arrow: 14,
        conditionPadding: 4,
        get condition () { return ELEMENT.Statement.fontSize + this.conditionPadding },
        get total () { return this.arrow + this.condition }
      },
      width: function (text: string, isFullWidth: boolean): number {
        // 15 is single corner width of diamond + 10 extra spacing
        const padding = 15 * 2 + 10
        if (isFullWidth) {
          return textWidth(text + '-') + padding
        } else {
          return Math.min(ELEMENT.Statement.maxWidth, textWidth(text)) + padding
        }
      }
    },
    padding: 24,
    footer: {
      height: 32,
      connectionCircleRadius: 4
    },
    repeatLine: {
      minWidth: 15,
      blockWidth: 30,
      get padding () { return this.blockWidth - this.minWidth }
    }
  },
  Switch: {
    header: {
      height: 30,
      width: (text: string) => { return textWidth(text) + 10 }
    },
    padding: 6,
    footer: {
      height: 35
    }
  },
  SwitchEntry: {
    arrowSpacing: 4,
    header: {
      arrowHeight: 15,
      height: (text: string) => textHeight(text) + 15 // + arrow height
    },
    spacing: 20,
    blockFooter: {
      height: 22
    }
  },
  Class: {
    methodSpacing: 40
  },
  TryCatchFinally: {
    spacing: 10,
    description: {
      width: 25
    },
    tryBlock: {
      headerHeight: 15,
      footerHeight: 15,
      totalHeight (blockHeight: number) {
        return this.headerHeight + blockHeight + this.footerHeight
      }
    },
    finallyBlock: {
      headerHeight: 15,
      footerHeight: 15,
      totalHeight (blockHeight: number) {
        return this.headerHeight + blockHeight + this.footerHeight
      }
    }
  },
  CatchClause: {
    header: {
      height: 20,
      minArrowWidth: 18,
      textPadding: 2
    },
    arrowHeight: 10,
    collapsedBox: {
      height: 30,
      width: 42,
      centerX: 31
    } as const
  }
}
