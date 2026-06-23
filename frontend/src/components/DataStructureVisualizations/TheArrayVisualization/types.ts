import { BaseType, Selection } from 'd3-selection'
import { HeapTreeNode } from '../heapBFS'

// =========================
// ARRAY INTERFACES
// =========================

/**
 * interface for a visualized array
 * level: level of the array in the visualization
 * cellWidth: with of the array cells
 * kind: string to distinguish array kinds
 * indexDistances: array to store distances of indexes at each cell
 */
export interface IArrayNode extends HeapTreeNode {
  level: number,
  cellWidth: number,
  readonly kind: string
  indexDistances?: { count: number, distance: number }[]
}

/**
 * interface for one-dimensional arrays
 * dimensions: length of the array
 */
export interface OneDimArrayNode extends IArrayNode {
  readonly kind: 'OneDimArrayNode'
  dimensions: [number]
}

/**
 * interface for children of two-dimensional arrays
 * indexInParent: index of this parent in its parent
 * parentDimensions: tuple with dimensions of parent array
 * parent: two dim parent of this array
 */
export interface TwoDimArrayChild extends IArrayNode {
  readonly kind: 'TwoDimArrayChild'
  indexInParent: number,
  parentDimensions: [number, number],
  parent: IArrayNode | undefined
}

/**
 * interface for two-dimensional arrays
 * children: arrays inside this two dimensional array
 * dimensions: dimensions of array
 */
export interface TwoDimArrayNode extends IArrayNode {
  readonly kind: 'TwoDimArrayNode',
  children: TwoDimArrayChild[],
  dimensions: [number, number]
}

export type ArrayNode = OneDimArrayNode | TwoDimArrayNode | TwoDimArrayChild

// ==================
// POINTER INTERFACE
// ==================

/**
 * interface for pointers to arrays
 * array: array to point to
 * name: name of the pointer
 * level: level of pointer in visualization
 * isNull: true iff array is null
 * methodOrParentId: method or parent-id, depending on which pointer this is
 * parent: parent of this pointer
 * changed: true iff pointer has changed in the last step
 */
export interface ArrayPointer {
  array?: ArrayNode,
  name: string
  level: number,
  isNull: boolean,
  methodOrParentId: string,
  parent: HeapTreeNode,
  changed: boolean
}

// =================
// INDEX INTERFACES
// =================

/**
 * interface for indexes of arrays
 * array: indexed array
 * name: displayed name of index
 * value: current index
 * changed: true, iff index has changed in the last step
 * index: index of the index at the element it's pointing to
 * isGhost: true, iff index should be displayed as a "ghost"
 * rotated: true, iff index should be rotated
 */
export interface ArrayIndex {
  array: ArrayNode,
  name: string,
  value: number,
  changed: boolean,
  index: number,
  isGhost: boolean,
  rotated: boolean
}

/**
 * Index in settings
 * displayString: string displayed in the settings
 * array: array referenced by this index
 * isDetected: true, iff index was detected by the system (via an array access)
 * isHidden: true, iff user hides the detected index manually
 */
export interface SettingsIndex {
  displayString: string,
  array?: ArrayNode,
  isDetected: boolean,
  isHidden?: boolean
}

/**
 * Valid processed settings index
 * arrayName: name of the array extracted from displayString
 * variableNames: names of the variables extracted from displayString
 * isValid: true, since above fields have valid entries
 */
export interface ValidProcessedIndex extends SettingsIndex {
  arrayName: string,
  variableNames: string[],
  readonly isValid: true
}

/**
 * Invalid processed settings index
 * isValid: false, since displayString has the wrong format
 */
export interface InvalidProcessedIndex extends SettingsIndex {
  readonly isValid: false
}

export type ProcessedIndex = ValidProcessedIndex | InvalidProcessedIndex

// ========================================
// ANIMATION AND TEMP. VARIABLE INTERFACES
// ========================================

/**
 * Missing source of array access (is not on stack anymore)
 * name: variable name
 * stackDepth: old stack depth
 * target: coordinates and cell width of target cell
 */
export interface MissingSource {
  name: string,
  stackDepth: number,
  target: {
    coordinates: [number, number],
    width: number
  }
}

/**
 * Temporary variable used for storing array elements
 * variable: variable the value is stored in
 * coordinates: coordinates of the variable
 * cellWidth: width of the displayed cell
 * missingSource: optional missing source, if it's not on the stack anymore
 */
export interface TempVariable {
  kind: 'TempVariable'
  variable: HeapTreeNode,
  coordinates: [number, number],
  cellWidth: number,
  missingSource?: MissingSource
}

/**
 * interface for animated copy of cell or array
 * coordinatesFrom: coordinates of the origin rectangle
 * coordinatesTo: coordinates of the target rectangle
 * widthFrom: width of origin rectangle
 * widthTo: width of source rectangle
 */
interface CopyAnimationData {
  coordinatesFrom: [number, number],
  coordinatesTo: [number, number],
  widthFrom: number,
  widthTo: number
}

/**
 * interface for storing copy animations
 * duration: duration for animations
 * movingViz: selection to append the rectangles to
 * data: CopyAnimationData of each animation
 */
export interface CopyAnimations {
  duration: number,
  movingViz: Selection<BaseType, unknown, HTMLElement, any>,
  data: CopyAnimationData[]
}
