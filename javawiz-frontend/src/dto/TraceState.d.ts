export type VarLocation = 'STATIC' | 'STACK' | 'FIELD' | 'ARR_ELEMENT' | 'STRING_ARR'

export interface PrimitiveVal {
  readonly kind: 'PrimitiveVal'
  title: string | undefined // value displayed in a title tag (visible on hover)
  vizValue: string // value displayed as text, which might differ from original value e.g. when truncating float mantissa
  readonly primitiveValue: string
}

export interface ReferenceVal {
  readonly kind: 'ReferenceVal'
  readonly reference: number
}

export interface NullVal {
  readonly kind: 'NullVal'
}

export type Val = PrimitiveVal | ReferenceVal | NullVal

interface IVar { // interface to include these fields in all members of the union type Var
  readonly kind: 'Var' // the backend does not distinguish static vars and local vars, everything therefore has kind Var
  readonly name: string
  readonly type: string
  readonly value: Val
  changed: boolean
  heapObjectId?: number
}

export interface LocalVar extends IVar {
  class: string
  method: string
}

export interface StaticVar extends IVar {
  class: string
}

export interface LocalCondition {
  readonly id: number
  readonly expression: string
  readonly value: boolean
  readonly evaluated: boolean
}

export interface IndexExpression {
  readonly expression: string,
  readonly isVariable: boolean
}

export interface ArrayAccessTarget {
  readonly kind: 'ArrayAccessTarget'
  readonly id: number
}

export interface VariableTarget {
  readonly kind: 'VariableTarget'
  readonly name: string
}

export type AssignmentTarget = ArrayAccessTarget | VariableTarget

export interface ArrayAccess {
  readonly kind: 'ArrayAccess'
  readonly id: number
  readonly indexExpressions: IndexExpression[]
  readonly assignmentSourceVariableNames: string[]
  readonly assignmentTarget: AssignmentTarget | null,
  readonly isWrittenTo: boolean
}

export type ArrayAccessValue = {
  readonly indexValues: number[]
  readonly evaluated: boolean
  readonly arrayObjectID: number
  readonly arrayAccess: ArrayAccess
}

export interface Condition extends LocalCondition {
  readonly class: string
  readonly method: string
}

export interface HeapArrayElementVar {
  readonly kind: 'HeapArrayElementVar'
  readonly arrayId: number
  readonly type: string
  readonly value: Val
  readonly index: number
  changed: boolean
}

export type Var = LocalVar | StaticVar

interface IHeapItem {
  readonly id: number
  readonly type: string
  readonly faked: boolean
}

export interface HeapArray extends IHeapItem {
  readonly kind: 'HeapArray'
  readonly elements: HeapArrayElementVar[]
}

export interface HeapString extends IHeapItem {
  readonly kind: 'HeapString'
  string: string
  vizString: string
  readonly charArr: Var
}

export interface HeapObject extends IHeapItem {
  readonly kind: 'HeapObject'
  readonly fields: Var[]
}

export type HeapItem = HeapArray | HeapString | HeapObject

export interface StackFrame {
  readonly kind: 'StackFrame'
  readonly line: number
  readonly class: string
  readonly method: string
  readonly signature: string
  readonly genericSignature?: string
  readonly displaySignature: string
  readonly localVariables: LocalVar[]
  readonly conditionValues: LocalCondition[]
  readonly arrayAccessValues: ArrayAccessValue[]
  readonly this?: ReferenceVal
  readonly internal: boolean
  displayText: string
}

export interface LoadedClass {
  readonly kind: 'LoadedClass'
  readonly class: string
  readonly staticFields: StaticVar[]
}

export type LatestMethod =
  'no method called' |
  'read()' |
  'readChar()'|
  'readBoolean()' |
  'readIdentifier()' |
  'readWord()' |
  'readLine()' |
  'readFile()' |
  'readString()' |
  'readInt()' |
  'readLong()' |
  'readFloat()' |
  'readDouble()' |
  'peek()' |
  'open()' |
  'close()'

export interface InputBufferInfo {
  readonly kind: 'InputBufferInfo'
  readonly past: string
  readonly future: string
  readonly done: boolean
  readonly latestValue: string,
  readonly latestMethod: LatestMethod,
  readonly traceSuccess: boolean
}

export interface TraceState {
  readonly kind: 'TraceState'
  readonly sourceFileUri: string,
  readonly line: number // currently active line
  readonly stack: StackFrame[] // function stack; it depends on the StepRequest depth and class filters (defined in Main.kt) which methods appear here
  readonly heap: HeapItem[] // active references to Arrays, Strings and Objects
  readonly loadedClasses: LoadedClass[] // classes together with their static fields
  readonly output: string // stdout output produced since the last step
  readonly error: string // stderr output produced since the last step
  readonly input: string // stdin since the last step
  readonly inputBufferInfo: InputBufferInfo // info on how far the input buffer was read
}

export interface ProcessedTraceState {
  readonly kind: 'ProcessedTraceState',
  readonly stateIndex: number, // the original index within the trace
  readonly localUri: string,
  readonly line: number,
  readonly heapBeforeExecution: HeapItem[],
  readonly stackBeforeExecution: StackFrame[],
  readonly loadedClassesBeforeExecution: LoadedClass[],
  readonly heapAfterExecution: HeapItem[],
  readonly stackAfterExecution: StackFrame[],
  readonly loadedClassesAfterExecution: LoadedClass[],
}

export type Recordable = Val | Var | LocalVar | HeapItem | StackFrame | LoadedClass | TraceState | ProcessedTraceState | InputBufferInfo
