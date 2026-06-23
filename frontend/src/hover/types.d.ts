export type HoverLine = {
  readonly kind: 'Line'
  readonly lineNr: number
  readonly localUri: string
}

export type HoverClass = {
  readonly kind: 'Class'
  readonly class: string
}

export type HoverMethod = {
  readonly kind: 'Method'
  readonly method: string
  readonly class: string
}

export type HoverCondition = {
  readonly kind: 'Condition'
  readonly expression: string
  readonly class: string
}

export type HoverLocal = {
  readonly kind: 'Local'
  readonly class: string
  readonly method: string
  readonly name: string
  readonly reference: number
}

export type HoverStatic = {
  readonly kind: 'Static'
  readonly class: string
  readonly name: string,
  readonly reference: number
}

export type HoverThisVar = {
  readonly kind: 'ThisVar'
  methodId: number
  readonly name: string,
  readonly reference: number
}

export type HoverHeapObject = {
  readonly kind: 'HeapObject'
  readonly objId: number
}

export type HoverArrayCell = {
  readonly kind: 'ArrayCell'
  readonly index: number
  readonly objId: number
}

export type HoverField = {
  readonly kind: 'Field'
  readonly name: string,
  readonly reference: number
  readonly objId: number
}

export type HoverMethodCall = {
  readonly kind: 'MethodCall'
  readonly name: string,
  readonly methodCallId: number,
  readonly time: number
}

export type HoverBox = {
  readonly kind: 'Box'
  readonly index: number,
  readonly start: number
}

// eslint-disable-next-line vue/max-len
export type HoverInfo = HoverLine | HoverClass | HoverMethod | HoverCondition | HoverLocal | HoverStatic | HoverThisVar | HoverHeapObject | HoverArrayCell | HoverField | HoverMethodCall | HoverBox

export type HoverHandler = (infos: HoverInfo[]) => void
