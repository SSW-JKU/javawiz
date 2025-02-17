import { SVG } from '../constants'

export const LOCAL_STORAGE = {
  leftName: 'TREE_leftName',
  rightName: 'TREE_rightName',
  valueName: 'TREE_valueName',
  parentName: 'TREE_parentName'
}

export const FUZZY_NAMES = {
  tree: 'Tree',
  node: 'Node'
}

export const HTML = {
  ids: {
    parentDiv: 'tree-div',
    treeSvg: 'tree-svg',
    tree: 'tree',
    treeNodes: 'tree-nodes',
    childPointers: 'tree-child-pointers',
    nodePointers: 'tree-node-pointers',
    fieldNotFound: 'tree-field-not-found',
    prefixes: {
      nodes: 'tree-n',
      child: 'tree-ch',
      pointer: 'tree-p'
    },
    nodes: {
      leftField: 'left-field',
      rightField: 'right-field'
    },
    pointers: {
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
      field: 'node-field'
    },
    pointers: {
      name: 'pointer-name',
      text: 'pointer-text'
    },
    highlighted: {
      field: 'highlighted',
      pointer: 'highlighted-pointer',
      ref: 'highlighted-ref'
    }
  }
}

export const LAYOUT = {
  treeWidthMultiplier: 1.7,
  svgWidth: 820,
  distanceBetweenTrees: 72,
  nodes: {
    yOrigin: 50,
    verticalTextOffset: 2.5,
    distanceBetween: 36
  },
  pointers: {
    distance: 15,
    length: 20,
    yOffset: 5,
    verticalTextOffset: 1.5,
    null: {
      verticalLineLength: 8,
      textWidth: 100,
      index: -0.7,
      get length () {
        return LAYOUT.pointers.length * 0.7
      }
    },
    textOffset: {
      normalMultiplier: 1.3,
      nullMultiplier: 1.5
    }
  },
  childPointers: {
    yOffset: 4,
    null: {
      offset: SVG.cellHeight,
      lineLength: 16
    }
  }
}
