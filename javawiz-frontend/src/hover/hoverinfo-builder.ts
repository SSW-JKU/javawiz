import { HoverInfo } from './types'

export function createHoverLine (lineNr: number, localUri: string): HoverInfo {
  return {
    kind: 'Line',
    lineNr,
    localUri
  }
}

export function createHoverClass (clazz: string): HoverInfo {
  return {
    kind: 'Class',
    class: clazz
  }
}

export function createHoverMethod (clazz: string, method: string): HoverInfo {
  return {
    kind: 'Method',
    class: clazz,
    method
  }
}

export function createHoverCondition (clazz: string, expression: string): HoverInfo {
  return {
    kind: 'Condition',
    class: clazz,
    expression
  }
}

export function createHoverLocal (clazz: string, method: string, name: string, reference: number): HoverInfo {
  return {
    kind: 'Local',
    class: clazz,
    method,
    name,
    reference
  }
}

export function createHoverStatic (clazz: string, name: string, reference: number): HoverInfo {
  return {
    kind: 'Static',
    class: clazz,
    name,
    reference
  }
}

export function createHoverThisVar (methodId: number, name: string, reference: number): HoverInfo {
  return {
    kind: 'ThisVar',
    methodId,
    name,
    reference
  }
}

export function createHoverHeapObject (objId: number): HoverInfo {
  return {
    kind: 'HeapObject',
    objId
  }
}

export function createHoverArrayCell (objId: number, index: number): HoverInfo {
  return {
    kind: 'ArrayCell',
    objId,
    index
  }
}

export function createHoverField (objId: number, name: string, reference: number): HoverInfo {
  return {
    kind: 'Field',
    objId,
    name,
    reference
  }
}
