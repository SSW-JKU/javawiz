import { BaseType, Selection } from 'd3-selection'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { VariableToBoxPointer } from '../types'

// =========================
// ARRAY INTERFACES
// =========================

/**
 * Fields shared by all boxes the Array View draws for an array: a one-dimensional array, a two-dimensional
 * array, or one row of a two-dimensional array. Each box is a copy of the array's data-structure graph node
 * with these layout fields added, so its cells are the node's children.
 */
export interface ArrayBoxBase extends DataStructureGraphNode {
  /**
   * Row of the Array View the box is drawn in. Each variable that points to an array has its own row
   * (0 = top); its y coordinate comes from `getRowYCoordinate`. The rows of a two-dimensional array share
   * the row of the whole array and are drawn below each other within it.
   */
  row: number,
  /**
   * Width of one cell in SVG units; all cells of a box have the same width. All rows of a two-dimensional array
   * use the widest cell of the whole array.
   */
  cellWidth: number,
  /** Tells the box types apart (`'OneDimArrayBox'`, `'TwoDimArrayBox'` or `'TwoDimArrayRowBox'`). */
  readonly kind: string
  /**
   * How the index labels are spread at each cell: one entry per cell (per row for a `TwoDimArrayBox`, whose
   * labels mark rows), plus one entry for indexes < 0 and one for indexes ≥ length, in this order at the end.
   * `labelCount` is the number of labels at that cell, `spacing` the distance in SVG units between two of them
   * (horizontal; vertical for a `TwoDimArrayBox`). `undefined` until the first index label is added to this box.
   */
  indexLabelsPerCell?: { labelCount: number, spacing: number }[]
}

/** Box of a one-dimensional array (e.g. `int[]` or `String[]`), drawn as one row of cells. */
export interface OneDimArrayBox extends ArrayBoxBase {
  readonly kind: 'OneDimArrayBox'
  /** Number of cells, i.e. the array's length. */
  dimensions: [number]
}

/**
 * Box of one row of a two-dimensional array: a one-dimensional array drawn as a row of cells inside its
 * `TwoDimArrayBox`. Its row index is drawn to the right of the row; the column indexes are drawn above the first row.
 */
export interface TwoDimArrayRowBox extends ArrayBoxBase {
  readonly kind: 'TwoDimArrayRowBox'
  /** Index of this row in the two-dimensional array (0 = top); the row is drawn this many cell heights lower. */
  rowIndex: number,
  /**
   * `dimensions` of the two-dimensional array: `[rows, length of the longest row]`. Column index labels and the
   * row index text are placed by the longest row, so all rows line up.
   */
  parentDimensions: [number, number],
  /** The two-dimensional array box this row belongs to; `undefined` only while the boxes are being built. */
  parentArrayBox: TwoDimArrayBox | undefined
}

/**
 * Box of a two-dimensional array (e.g. `int[][]`). It has no rectangle of its own: its rows are drawn as
 * `TwoDimArrayRowBox`es below each other. It carries the labels of row indexes, drawn to the right of the rows.
 */
export interface TwoDimArrayBox extends ArrayBoxBase {
  readonly kind: 'TwoDimArrayBox',
  /**
   * The row boxes, in row order. The name is inherited from `DataStructureGraphNode`, so the box stays a graph
   * node whose children are its rows.
   */
  childDataStructureGraphNodes: TwoDimArrayRowBox[],
  /** Number of rows and length of the longest row: `[rows, columns]`. */
  dimensions: [number, number]
}

/** Any box the Array View draws for an array; `kind` tells which one it is. */
export type ArrayBox = OneDimArrayBox | TwoDimArrayBox | TwoDimArrayRowBox

// ==================
// POINTER INTERFACE
// ==================

/**
 * Pointer drawn as an arrow from a variable (a local variable or a static field) to the box of the array it
 * references. The shared fields (name, source variable, null and changed state) are described in
 * `VariableToBoxPointer`; an example of `sourceVariableIdentifier` is `local_0_arr`.
 */
export interface VariableToArrayPointer extends VariableToBoxPointer {
  /**
   * Box of the referenced array. Several variables that reference the same array share the box made for the
   * first of them. `undefined` if the variable holds `null`.
   */
  targetArrayBox?: ArrayBox,
  /** Row of the Array View the pointer starts in (see `ArrayBoxBase.row`); each pointer has its own row. */
  row: number
}

// =================
// INDEX INTERFACES
// =================

/**
 * Index label drawn at an array cell: a small arrow with a text such as `i`, marking the cell that the index
 * currently refers to. Labels come from the index label settings (e.g. `arr[i]` draws `i` at `arr`) and, as
 * "ghosts", from the index expressions of the array accesses in the current step.
 */
export interface IndexLabel {
  /**
   * Box the label is drawn at. For a two-dimensional array, a row index is drawn at the `TwoDimArrayBox`
   * (to the right of the rows) and a column index at its first `TwoDimArrayRowBox` (above the columns).
   */
  arrayBox: ArrayBox,
  /** Text shown: the variable name of a setting (e.g. `i`) or the index expression of an access (e.g. `i + 1`). */
  text: string,
  /**
   * Cell (or row) the label marks, clamped to −1 … length: −1 means the index is below 0 and the label is drawn
   * before the first cell; length means it is ≥ length and the label is drawn after the last cell.
   */
  cellIndex: number,
  /** `true` if the index variable changed in the last step; the label is then drawn in red. Always `false` for ghosts. */
  changed: boolean,
  /** Stacking order among the labels at the same cell (0 = first); used to spread them over the cell. */
  positionAtCell: number,
  /** `true` for a label from an array access of this step that no setting shows; it is drawn semi-transparent. */
  isGhost: boolean,
  /**
   * `true` if the text is longer than `LAYOUT.indexes.col.rotationThreshold` characters. A column label
   * is then drawn rotated; row labels at a `TwoDimArrayBox` are never rotated.
   */
  isRotated: boolean
}

/**
 * Index expression of an array access in the current step, collected before the layout. It becomes a ghost
 * `IndexLabel` unless a label with the same text already exists at that array box.
 */
export type GhostIndexLabelCandidate = Pick<IndexLabel, 'arrayBox' | 'text' | 'cellIndex'>

/**
 * One row of the index table in the Array View settings: an expression that says which index labels to draw.
 * The settings the user adds are saved in localStorage; detected settings are added again in every step.
 */
export interface IndexLabelSetting {
  /**
   * Expression typed in the table, e.g. `arr[i]` (label `i` at array `arr`), `[i]` (at every array) or `arr[i][j]`
   * (row label `i` and column label `j`). Older saved settings named this field `displayString`.
   */
  expression: string,
  /**
   * Array box of the array access a detected setting was made for; its labels are drawn there instead of at the
   * arrays found by name. `undefined` for the settings the user adds.
   */
  arrayBox?: ArrayBox,
  /**
   * `true` if the view added this setting for an array access of the current step. Detected settings cannot be
   * edited or deleted and are not saved.
   */
  isDetected: boolean,
  /** `true` if the user hid this detected setting's labels with the eye button; `undefined` means shown. */
  isHidden?: boolean
}

/** Index label setting whose expression has the expected format, with the parts of the expression. */
export interface ValidParsedIndexLabelSetting extends IndexLabelSetting {
  /** Name of the array, e.g. `arr` for `arr[i]`; `*` if the expression names no array (`[i]`), i.e. every array. */
  arrayName: string,
  /**
   * Names of the index variables in order: `['i']` for `arr[i]`, `['i', 'j']` for `arr[i][j]` (row, column), and
   * `['*', 'j']` for `arr[][j]` or `arr[*][j]`, where `*` means that no label is drawn for that dimension.
   */
  variableNames: string[],
  /** Always `true`; tells this type apart from `InvalidParsedIndexLabelSetting`. */
  readonly isValid: true
}

/**
 * Index label setting whose expression has the wrong format (e.g. `arr[` or `arr`). It draws no labels, and its
 * input field in the settings table is marked as invalid.
 */
export interface InvalidParsedIndexLabelSetting extends IndexLabelSetting {
  /** Always `false`; tells this type apart from `ValidParsedIndexLabelSetting`. */
  readonly isValid: false
}

/** Index label setting after its expression was parsed; `isValid` tells whether parsing succeeded. */
export type ParsedIndexLabelSetting = ValidParsedIndexLabelSetting | InvalidParsedIndexLabelSetting

// ========================================
// ANIMATION AND TEMP. VARIABLE INTERFACES
// ========================================

/**
 * Local variable whose value was copied into an array cell in this step (e.g. `tmp` in `arr[j] = tmp;`) but that has
 * no temporary variable box in this step: boxes are only shown for variables that just received an array element.
 * If the previous step showed a box for this variable, that box flies into the target cell instead of fading out.
 */
export interface VanishedSourceVariable {
  /** Name of the variable, e.g. `tmp`. */
  variableName: string,
  /** Number of the stack frame the variable belonged to (`main` = 0), to match it with its temporary variable box. */
  stackFrameNumber: number,
  /** Position (SVG coordinates of the top-left corner) and width (SVG units) of the cell the value was copied into. */
  targetCell: {
    coordinates: [number, number],
    width: number
  }
}

/**
 * Box for a local variable of a primitive type or `String` that received an array element in this step
 * (e.g. `tmp` in `int tmp = arr[i];`), drawn above the arrays with the variable's name and value. Copies between
 * this box and array cells are animated.
 */
export interface TemporaryVariableBox {
  /** Tells this box apart from the array boxes in the copy animations. */
  kind: 'TemporaryVariableBox'
  /** Data-structure graph node of the local variable; gives its name, value and stack frame. */
  variableDataStructureGraphNode: DataStructureGraphNode,
  /** SVG coordinates of the box's top-left corner; the boxes are placed left to right. */
  coordinates: [number, number],
  /** Width of the box in SVG units: fitted to the value, between the minimum and maximum cell width (see `getCellWidth`). */
  cellWidth: number,
  /**
   * Set while the box is removed, if its variable was copied into an array cell in this step: the box then flies
   * into that cell instead of fading out. `undefined` otherwise.
   */
  vanishedSourceVariable?: VanishedSourceVariable
}

/**
 * One value copied in the current step, animated as a rectangle that flies along a curve from the source to the
 * target and changes its width on the way. Source and target are an array cell, a temporary variable box, or a
 * whole row of a two-dimensional array (when a row is assigned, e.g. `grid[0] = grid[1];`).
 */
interface CopyAnimation {
  /** SVG coordinates of the source's top-left corner, where the rectangle starts. */
  sourceCoordinates: [number, number],
  /** SVG coordinates of the target's top-left corner, where the rectangle ends. */
  targetCoordinates: [number, number],
  /** Width of the source in SVG units: the rectangle's width at the start. */
  sourceWidth: number,
  /** Width of the target in SVG units: the rectangle's width at the end. */
  targetWidth: number
}

/**
 * All copy animations of the current step. They are collected while the step is prepared and then started
 * together with the same duration.
 */
export interface CopyAnimationGroup {
  /**
   * Duration of every animation of the step in milliseconds: the longest one needed, which grows with the
   * distance a rectangle flies. Temporary variable boxes that fly into a cell use it too.
   */
  duration: number,
  /** D3 selection of the SVG layer the flying rectangles are appended to (also the curves they follow, which are removed right away). */
  movingLayerSelection: Selection<BaseType, unknown, HTMLElement, any>,
  /** The copies of this step, one flying rectangle each. */
  copyAnimations: CopyAnimation[]
}
