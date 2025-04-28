import { easeCubic } from 'd3-ease'

export const DATA = {
  programStart: 3
}
export const LAYOUT = {
  xMultiplier: 80,
  xOffset: 30,
  yMultiplier: 13,
  yOffset: 25,
  lineOffset: 25,
  shift: 5,
  width: 40,
  line: {
    xOffset: 8,
    yOffset: 3,
    mainYOffset: 7,
    mainY2: 38,
    horizontalLength: 24,
    button: {
      radius: 2,
      strokeWidth: 0.3
    }
  },
  text: {
    yOffset: 5,
    fontSize: 7,
    fontWeight: 600,
    selfCall: 2.105,
    constructor: 14
  },
  arrowText: {
    selfCall: {
      yOffset: -5.5
    },
    return: {
      yOffset: -5
    },
    fontSize: 5,
    yOffset: -8.5,
    constructor: -14.5
  },
  constructorOffset: 15,
  returnOffset: 4,
  arrow: {
    selfCall: {
      yOffset: -6
    },
    return: {
      yOffset: -1
    },
    yOffset: -2,
    secYOffset: -2,
    constructor: -7
  },
  strokeWidth: 0.4,
  horizontalLine: {
    strokeWidth: 0.7,
    xOffset: -8
  },
  mainBoxColor: '#e3ecf4',
  altBoxColor: '#bed3e6',
  dotColor: '#39678f',
  box: {
    width: 10,
    yOffset: -2,
    shift: 15,
    mainYOffset: -2,
    heightOffset: 5,
    collapsedBoxOffset: 5,
    mainHeightOffset: 9,
    distance: 60
  },
  circle: {
    radius: 0.7,
    strokeWidth: 0.3
  }
}

export const FONT_FAMILY = `"Droid Sans Mono", "monospace", monospace, "Droid Sans Fallback"`
export const HTML = {
  ids: {
    verticalLine: 'vertical-line',
    horizontalLine: 'horizontal-line',
    firstCrossLine: 'first-cross-line',
    secondCrossLine: 'second-cross-line',
    textLabel: 'label',
    returnTextLabel: 'returnLabel',
    callTextLabel: 'callLabel',
    callArrowLine: 'call-arrow-line',
    constructorLine: 'constructor',
    constructorLabel: 'constructor-label',
    selfCallArrowLine1: 'self-call-arrow-line1',
    selfCallArrowLine2: 'self-call-arrow-line2',
    selfCallArrowLine3: 'self-call-arrow-line3',
    selfCallArrowText: 'self-call-arrow-text',
    returnArrowLine: 'return-arrow-line',
    lifeLines: 'life-lines',
    arrows: 'arrows',
    methodCallBox: 'method-call-box',
    boxes: 'boxes',
    parentDiv: 'the-sequence-diagram',
    dot1: 'dot1',
    dot2: 'dot2',
    dot3: 'dot3'
  },
  class: {
    label: 'text-label'
  },
  classes: {
    highlighted: {
      arrow: 'highlighted-arrow',
      box: 'highlighted-box',
      lifeLine: 'highlighted-lifeline',
      refArrow: 'highlighted-ref-arrow',
      refBox: 'highlighted-ref-box',
      refLifeLine: 'highlighted-ref-lifeline'
    }
  }
}

export const SVG = {
  get lifeLineHeight () {
    return LAYOUT.text.fontSize * 3
  },
  get lifeLineWidth () {
    return this.lifeLineHeight * 2
  },
  getFirstXCoordinateForCross () {
    return LAYOUT.width / 2 - 5
  },
  getSecondXCoordinateForCross () {
    return LAYOUT.width / 2 + 5
  },
  multiplier: 0.2
}

export const ZOOM = {
  offsetMultiplier: 1.1,
  thresholdMultiplier: 1.2
}

export const DEFAULT_ZOOM_FACTOR = 1.3

export const DURATION = 1000

export const TRANSFORMATION = {
  duration: 1800,
  ease: easeCubic
}
