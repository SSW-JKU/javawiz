import { TRANSFORMATION } from '@/helpers/constants'
import { SVG } from '../constants'

export const LOCAL_STORAGE = {
  indexes: 'ARRAY_indexes',
  showArgs: 'ARRAY_show-args',
  onlyCurrentStackFrame: 'ARRAY_only-current-stack',
  highlightIndexes: 'ARRAY_highlight-indexes'
}

export const HTML = {
  ids: {
    parentDiv: 'array-div',
    arraySvg: 'array-svg',
    arrayViz: 'array',
    arrayPointers: 'array-pointers',
    arrayIndexes: 'array-indexes',
    arrays: 'arrays',
    tempVariables: 'temp-variables',
    arrayWriteAccesses: {
      writeAccesses: 'array-write-accesses',
      moving: 'moving-accesses',
      static: 'static-accesses'
    },
    tester: {
      index: 'index-text-tester',
      value: 'value-text-tester'
    },
    prefixes: {
      arrays: 'a',
      pointers: 'p',
      indexes: 'i',
      tempVariables: 't'
    },
    pointers: {
      line: 'pointer-line',
      arrowLine: 'arrow-line',
      nullLine: 'null-line'
    }
  },
  classes: {
    changed: 'changed',
    indexTest: 'index-test',
    textTester: 'text-tester',
    textGroup: 'text-group',
    valueText: 'value-text',
    marginButton: 'margin-button',
    nodes: {
      group: 'array-group',
      dividers: 'cell-dividers',
      lines: 'line-group',
      text: 'text-group'
    },
    indexes: {
      group: 'index-group',
      numbers: 'index-numbers',
      number: 'index-nr',
      oneDim: 'one-dim-index',
      twoDim: 'two-dim-index',
      text: 'index-text'
    },
    pointers: {
      group: 'pointer-group',
      lines: 'pointer-lines',
      text: 'pointer-text'
    },
    tempVariables: {
      group: 'temp-var-group',
      text: 'temp-var-text'
    },
    highlightedCells: {
      group: 'highlighted-cells',
      sources: 'highlighted-source-cells',
      targets: 'highlighted-target-cells'
    }
  }
}

export const LAYOUT = {
  defaultNumberOrCells: 10,
  xOrigin: 70,
  yOrigin: 10,
  arrays: {
    distanceBetween: 42,
    indexNrs: {
      yOffset: -10,
      height: 10
    },
    cells: {
      padding: 2,
      verticalTextOffset: 2.7,
      widthMultiplier: {
        min: 1.5,
        max: 2,
        empty: 0.25
      },
      copyInSameArrayYOffset: 20
    },
    get yOrigin () {
      return this.distanceBetween + LAYOUT.tempVariables.yOrigin + SVG.cellHeight
    }

  },
  pointers: {
    xOrigin: 40,
    text: {
      width: 100,
      yOffset: 3,
      xOffset: 4
    },
    null: {
      lengthMultiplier: 0.7,
      lineLength: 10
    }
  },
  indexes: {
    col: {
      rotationThreshold: 1,
      xOffset: 5,
      yOffset: 10,
      normalText: {
        yOffset: -18,
        width: 10
      },
      rotatedText: {
        xOffset: 4,
        yOffset: -16,
        width: 30,
        transform: 'rotate(-35)'
      }
    },
    row: {
      text: {
        width: SVG.cellHeight * 0.7,
        xOffset: 8,
        yOffset: 1.5
      },
      get xOffset () {
        return this.text.width
      },
      yOffset: 5,
      width: '100%'
    },
    highlightColor: {
      horizontal: '#3395FF14',
      vertical: '#5f686d14'
    },
    get height () {
      return LAYOUT.tempVariables.height
    }
  },
  tempVariables: {
    yOrigin: 10,
    height: 14,
    nameYOffset: -11
  }
}

const displayableTypes = ['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'java.lang.String']
export const DISPLAYABLE_TYPES = {
  types: ['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'java.lang.String'],
  oneDim: displayableTypes.map(arrayType => arrayType + '[]'),
  twoDim: displayableTypes.map(arrayType => arrayType + '[][]')
}

const VARIABLE_REGEX_STRING = '[a-zA-Z_$][a-zA-Z_$0-9]'
const VARIABLE_OR_STAR_REGEX_STRING = `(?:${VARIABLE_REGEX_STRING}*)|\\*`
const INDEX_REGEX_STRING = `^(${VARIABLE_OR_STAR_REGEX_STRING})?\\[(${VARIABLE_OR_STAR_REGEX_STRING})?\\](?:\\[(${VARIABLE_REGEX_STRING}*)?\\])?$`
export const REGEX = {
  arrayWildcard: '*',
  index: new RegExp(INDEX_REGEX_STRING)
}

export const GHOST_INDEXES = {
  blendAnimation: TRANSFORMATION.duration * 1.5 / 2,
  opacity: '0.35'
}
