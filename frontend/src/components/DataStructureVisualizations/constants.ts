export const REGEX = {
  // regex to match illegal chars in css selector
  illegalCssSelector: /[.()<>]/g
}

export const CSS = {
  cell: {
    fontSize: 9,
    name: {
      fontWeight: 'normal',
      fontFamily: 'Courier, monospace'
    },
    value: {
      fontWeight: 'normal',
      fontFamily: 'Arial'
    }
  },
  pointer: {
    get fontSize () {
      return CSS.cell.fontSize - 1
    },
    parent: {
      fontStyle: 'italic',
      fontFamily: 'Arial',
      get fontSize () {
        return CSS.pointer.fontSize - 1
      }
    },
    name: {
      fontFamily: 'Courier, monospace'
    }
  }
}

export const SVG = {
  get cellHeight () {
    return CSS.cell.fontSize * 2
  },
  get cellWidth () {
    return this.cellHeight * 3.6
  }
}

export const ZOOM = {
  offsetMultiplier: 1.1,
  thresholdMultiplier: 1.05
}
