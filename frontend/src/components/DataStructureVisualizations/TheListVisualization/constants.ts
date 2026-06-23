export const LOCAL_STORAGE = {
  nextName: 'LIST_nextName',
  valName: 'LIST_valName',
  prevName: 'LIST_prevName'
}

export const FUZZY_NAMES = {
  list: 'List',
  node: 'Node'
}

export const HTML = {
  ids: {
    parentDiv: 'list-div',
    listSvg: 'list-svg',
    list: 'list',
    listNodes: 'list-nodes',
    nextPointers: 'list-next-pointers',
    nodePointers: 'list-node-pointers',
    fieldNotFound: 'list-field-not-found',
    prefixes: {
      nodes: 'list-n',
      reference: 'list-r',
      next: 'list-next',
      pointer: 'list-p'
    },
    pointers: {
      name: 'name',
      parent: 'parent',
      line: 'pointer-line',
      arrowLine: 'arrow-line',
      nullLine: 'null-line'
    }
  },
  classes: {
    changed: 'changed',
    valueText: 'value-text',
    fieldText: 'field-text',
    nodes: {
      group: 'node-group',
      lineGroup: 'line-group',
      textGroup: 'text-group',
      valueArrow: 'value-arrow',
      referenceGroup: 'reference-group'
    },
    pointers: {
      name: 'pointer-name',
      text: 'pointer-text',
      parent: 'pointer-parent'
    },
    highlighted: {
      field: 'highlighted',
      pointer: 'highlighted-pointer',
      ref: 'highlighted-ref'
    }
  }
}

export const LAYOUT = {
  defaultNumberOfNodes: 4,
  nodes: {
    yOrigin: 3 * 20,
    fieldTextYOffset: 2.5,
    distances: {
      multiplier: 1.5,
      constant: 0.5,
      value: 20,
      between: 3 * 20
    },
    get valuePointerYOffset () {
      return LAYOUT.nextPointer.xOffset / 2
    }
  },
  pointers: {
    distance: 25,
    length: 20,
    xOffset: 5,
    null: {
      verticalLineLength: 8,
      get length () {
        return LAYOUT.pointers.length * 0.7
      }
    },
    text: {
      yOffset: 15,
      height: 14,
      parent: {
        height: 10,
        yOffset: 6
      }
    }
  },
  nextPointer: {
    xOffset: 7,
    nullLengthMultiplier: 0.5
  }
}
