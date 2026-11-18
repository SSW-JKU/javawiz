import { HoverInfo } from '@/hover/types'

import { HeapVizTraceState } from './Types/HeapVizTraceState'
import { HeapVizHeapString } from './Types/HeapVizHeapString'
import { HeapVizHeapArray } from './Types/HeapVizHeapArray'
import { IHeapVizHeapItem } from './Types/HeapVizHeapItem'
import { HeapVizHeapObject } from './Types/HeapVizHeapObject'
import { HeapVizHeapArrayElementVar } from './Types/HeapVizHeapArrayElementVar'
import { HeapVizVar } from './Types/HeapVizVar'
import {
  createHoverClass,
  createHoverField,
  createHoverHeapObject,
  createHoverArrayCell,
  createHoverThisVar,
  createHoverStatic,
  createHoverLocal,
  createHoverMethod
} from '@/hover/hoverinfo-builder'
import {
  MAIN_HEADER_BG_COLOR,
  MAIN_HEADER_BG_COLOR_HOVER,
  METHOD_HEADER_BG_COLOR_HOVER,
  SUB_HEADER_BG_COLOR
} from './constants'
import { HeapVizReferenceVal } from './Types/HeapVizReferenceVal'

import { HeapVizStackFrame } from './Types/HeapVizStackFrame'
import { HeapVizLoadedClass } from './Types/HeapVizLoadedClass'
import { HeapVizVal } from './Types/HeapVizVal'
import { stackFrameIdentifier } from '@/identifiers/trace-identifiers'

/**
 * What a record of the Memory View stands for, with the data needed to build its hover infos.
 * A record is a table row or header that has its own identifier, such as a local or a heap object.
 */
export type HoverTarget =
  | { kind: 'local', stackFrameNr: number, stackFrame: HeapVizStackFrame, variable: HeapVizVar }
  | { kind: 'this', stackFrameNr: number, variable: HeapVizVar }
  | { kind: 'static', loadedClass: HeapVizLoadedClass, variable: HeapVizVar }
  | { kind: 'field', heapObject: HeapVizHeapObject, variable: HeapVizVar }
  | { kind: 'arrayElement', array: HeapVizHeapArray, element: HeapVizHeapArrayElementVar }
  /** The `value` field of a String: hovering it hovers the String, clicking it expands the backing array. */
  | { kind: 'stringValue', heapString: HeapVizHeapString, variable: HeapVizVar }
  | { kind: 'heapItem', heapItem: IHeapVizHeapItem }
  | { kind: 'method', stackFrame: HeapVizStackFrame }

/**
 * Maps the identifier of every record in `state` to what it stands for. The kind of a record is known
 * from where it sits in the state (a stack frame, a loaded class, a heap item), so no identifier is decoded.
 *
 * Example: for the local `n` in frame 1, `collectHoverTargets(state).get('local_1_n')` is
 * `{ kind: 'local', stackFrameNr: 1, stackFrame, variable }`.
 */
export function collectHoverTargets (state: HeapVizTraceState): Map<string, HoverTarget> {
  const targets = new Map<string, HoverTarget>()
  state.stackAfterExecution.forEach((stackFrame, stackFrameNr) => {
    targets.set(stackFrameIdentifier(stackFrameNr), { kind: 'method', stackFrame })
    if (stackFrame.this)
      targets.set(stackFrame.this.identifier, { kind: 'this', stackFrameNr, variable: stackFrame.this })
    for (const variable of stackFrame.localVariables)
      targets.set(variable.identifier, { kind: 'local', stackFrameNr, stackFrame, variable })
  })
  for (const loadedClass of state.loadedClassesAfterExecution) {
    for (const variable of loadedClass.staticFields)
      targets.set(variable.identifier, { kind: 'static', loadedClass, variable })
  }
  for (const heapItem of state.heapAfterExecution) {
    targets.set(heapItem.identifier, { kind: 'heapItem', heapItem })
    if (heapItem instanceof HeapVizHeapObject) {
      for (const variable of heapItem.fields)
        targets.set(variable.identifier, { kind: 'field', heapObject: heapItem, variable })
    } else if (heapItem instanceof HeapVizHeapArray) {
      for (const element of heapItem.elements)
        targets.set(element.identifier, { kind: 'arrayElement', array: heapItem, element })
    } else if (heapItem instanceof HeapVizHeapString) {
      targets.set(heapItem.charArr.identifier, { kind: 'stringValue', heapString: heapItem, variable: heapItem.charArr })
    }
  }
  return targets
}

/** The referenced heap item id, or -1 for `null` and primitives. */
function referenceOf (value: HeapVizVal): number {
  return value instanceof HeapVizReferenceVal ? value.reference : -1
}

/** The hover infos for a heap item: the item, everything that references it, and its class unless it is an array. */
function heapItemHoverInfos (heapItem: IHeapVizHeapItem, state: HeapVizTraceState): HoverInfo[] {
  return [
    createHoverHeapObject(heapItem.id),
    ...getReferencesOfHoveredHeapItem(heapItem.id, state),
    ...(heapItem instanceof HeapVizHeapArray ? [] : [createHoverClass(heapItem.varType)])
  ]
}

/**
 * The hover infos the Memory View sends while the mouse is over `target`, in the order the other views expect.
 * A referenced object is included, so the object and the arrow to it are highlighted too.
 */
export function hoverInfosForTarget (target: HoverTarget, state: HeapVizTraceState): HoverInfo[] {
  switch (target.kind) {
    case 'local': {
      const reference = referenceOf(target.variable.value)
      return [
        ...(target.variable.value instanceof HeapVizReferenceVal ? [createHoverHeapObject(reference)] : []),
        createHoverLocal(target.stackFrame.class, target.stackFrame.method, target.variable.name, reference, target.stackFrameNr)
      ]
    }
    case 'this': {
      const reference = referenceOf(target.variable.value)
      // A `this` row always holds a reference; the check only guards against malformed traces.
      return reference > 0 ? [createHoverThisVar(target.stackFrameNr, 'this', reference), createHoverHeapObject(reference)] : []
    }
    case 'static': {
      const reference = referenceOf(target.variable.value)
      return [
        ...(reference > 0 ? [createHoverHeapObject(reference)] : []),
        createHoverStatic(target.loadedClass.class, target.variable.name, reference)
      ]
    }
    case 'field': {
      const reference = referenceOf(target.variable.value)
      return [
        createHoverField(target.heapObject.id, target.variable.name, reference),
        ...(reference !== -1 ? [createHoverHeapObject(reference)] : []),
        createHoverClass(target.heapObject.varType)
      ]
    }
    case 'arrayElement':
      return [
        createHoverArrayCell(target.array.id, target.element.index),
        ...(target.element.value instanceof HeapVizReferenceVal ? [createHoverHeapObject(target.element.value.reference)] : [])
      ]
    case 'stringValue':
      return heapItemHoverInfos(target.heapString, state)
    case 'heapItem':
      return heapItemHoverInfos(target.heapItem, state)
    case 'method':
      return [createHoverMethod(target.stackFrame.class, target.stackFrame.method)]
  }
}

export function getReferencesOfHoveredHeapItem (objId: number, state: HeapVizTraceState): HoverInfo[] {
  const hoverInfos: HoverInfo[] = []

  // check if a static field
  for (const loadedClass of state.loadedClassesAfterExecution) {
    for (const staticField of loadedClass.staticFields) {
      if (staticField.value instanceof HeapVizReferenceVal && staticField.value.reference === objId) {
        hoverInfos.push(createHoverStatic(loadedClass.class, staticField.name, objId))
      }
    }
  }

  // check if a local variable is referencing the object
  for (const [index, stackFrame] of state.stackAfterExecution.entries()) {
    const thisVar = stackFrame.this?.value as HeapVizReferenceVal
    if (thisVar && thisVar.reference === objId) {
      hoverInfos.push(createHoverThisVar(index, 'this', objId))
    }

    for (const localVar of stackFrame.localVariables) {
      if (localVar.value instanceof HeapVizReferenceVal && localVar.value.reference === objId) {
        hoverInfos.push(createHoverLocal(stackFrame.class, stackFrame.method, localVar.name, objId, index))
      }
    }
  }

  // check if a field of another object is referencing the object
  for (const heapItem of state.heapAfterExecution) {
    switch (true) {
      case heapItem instanceof HeapVizHeapArray: {
        for (const arrElement of heapItem.elements) {
          if (arrElement.value instanceof HeapVizReferenceVal && arrElement.value.reference === objId) {
            hoverInfos.push(createHoverArrayCell(arrElement.arrayId, arrElement.index))
          }
        }
        break
      }
      case heapItem instanceof HeapVizHeapObject: {
        for (const field of heapItem.fields) {
          if (field.value instanceof HeapVizReferenceVal && field.value.reference === objId) {
            hoverInfos.push(createHoverField(field.heapObjectId ? field.heapObjectId : -1, field.name, objId))
          }
        }
      }
    }
  }

  return hoverInfos
}

export function getMethodHeaderBGOnHover (stackFrame: HeapVizStackFrame, highlightedItems: HoverInfo[]): string {
  for (const item of highlightedItems) {
    if (item.kind === 'Method' && stackFrame.class === item.class && stackFrame.method === item.method) {
      return METHOD_HEADER_BG_COLOR_HOVER
    }
  }
  return SUB_HEADER_BG_COLOR
}

export function getHeapItemOrArrayHeaderBGOnHover (heapItem: IHeapVizHeapItem | HeapVizHeapArray, highlightedItems: HoverInfo[]): string {
  for (const item of highlightedItems) {
    if (item.kind === 'HeapObject' && heapItem.id === item.objId) {
      return MAIN_HEADER_BG_COLOR_HOVER
    }
  }
  return MAIN_HEADER_BG_COLOR
}
