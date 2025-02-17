export type HeapVizPrimitiveVal = {
  readonly kind: 'HeapVizPrimitiveVal'
  readonly vizValue: string
  readonly title?: string
}

export type HeapVizReferenceVal = {
  readonly kind: 'HeapVizReferenceVal'
  readonly reference: number
}

export type HeapVizNullVal = {
  readonly kind: 'HeapVizNullVal'
}

export type HeapVizVal = HeapVizPrimitiveVal | HeapVizReferenceVal | HeapVizNullVal

export type HeapVizVar = {
  readonly kind: 'HeapVizVar'
  name: string
  type: string
  value: HeapVizVal
  changed: boolean,
  heapObjectId?: number,
  port: string
  identifier: string
}

export interface HeapVizHeapArrayElementVar {
  readonly kind: 'HeapVizHeapArrayElementVar'
  identifier: string
  readonly arrayId: number
  readonly type: string
  readonly value: HeapVizVal
  readonly index: number
  changed: boolean
}

export interface IHeapVizHeapItem {
  id: number
  type: string
  faked: boolean
  isVisible: boolean
  identifier: string
}

export interface HeapVizHeapArray extends IHeapVizHeapItem {
  readonly kind: 'HeapVizHeapArray'
  elements: HeapVizHeapArrayElementVar[]
}

export interface HeapVizHeapString extends IHeapVizHeapItem {
  readonly kind: 'HeapVizHeapString'
  string: string
  vizString: string
  charArr: HeapVizVar
}

export interface HeapVizHeapObject extends IHeapVizHeapItem {
  readonly kind: 'HeapVizHeapObject'
  fields: HeapVizVar[] // does not include static fields
}

export type HeapVizHeapItem = HeapVizHeapArray | HeapVizHeapString | HeapVizHeapObject

export interface HeapVizStackFrame {
  readonly kind: 'HeapVizStackFrame'
  class: string
  method: string
  signature: string
  genericSignature?: string
  localVariables: HeapVizVar[]
  this?: HeapVizReferenceVal,
  displayText: string,
  internal: boolean
}

export interface HeapVizLoadedClass {
  readonly kind: 'HeapVizLoadedClass'
  class: string
  staticFields: HeapVizVar[]
}

export interface HeapVizTraceState {
  readonly kind: 'HeapVizTraceState'
  line: number // currently active line
  stack: HeapVizStackFrame[] // function stack; it depends on the StepRequest depth and class filters (defined in Main.kt) which methods appear here
  heap: HeapVizHeapItem[] // active references to Arrays, Strings and Objects
  loadedClasses: HeapVizLoadedClass[] // classes together with their static fields
  heapAfterExecution: HeapVizHeapItem[],
  stackAfterExecution: HeapVizStackFrame[],
  loadedClassesAfterExecution: HeapVizLoadedClass[],
}

export interface HeapVizMeta {
  isExpanded: boolean
  isFullyVisible: boolean
}

export type HeapVizRecordable = HeapVizVal | HeapVizVar | HeapVizHeapItem | HeapVizStackFrame | HeapVizLoadedClass | HeapVizTraceState
