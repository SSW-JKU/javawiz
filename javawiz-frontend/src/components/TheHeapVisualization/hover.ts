import { HoverInfo } from '@/hover/types'
import { HeapVizHeapArray, HeapVizHeapArrayElementVar, HeapVizHeapItem, HeapVizHeapString, HeapVizStackFrame, HeapVizTraceState, HeapVizVar } from './types'
import {
  createHoverField,
  createHoverHeapObject,
  createHoverArrayCell,
  createHoverClass,
  createHoverThisVar,
  createHoverStatic,
  createHoverLocal,
  createHoverMethod
} from '@/hover/hoverinfo-builder'
import {
  MAIN_HEADER_BG_COLOR,
  MAIN_HEADER_BG_COLOR_HOVER,
  METHOD_HEADER_BG_COLOR_HOVER,
  OBJECT_BG_HOVER,
  REFERENCED_OBJECT_BG_HOVER,
  SUB_HEADER_BG_COLOR,
  WHITE
} from './constants'
import { desanitizeIdentifier } from './mapping'

export function getHeapItemToHeapItemHoverInfos (sanitizedIdentifier: string, state: HeapVizTraceState): HoverInfo[] {
  const identifier = desanitizeIdentifier(sanitizedIdentifier)
  const hoverInfos: HoverInfo[] = []
  const splitId = identifier.split(':')
  const id = splitId[0].match(/\d+/g)
  const fieldName = splitId.length > 1 ? splitId[1] : ''
  let reference = -1
  if (id === null) {
    return []
  }
  const objId = Number(id[0])
  const heapItem = state.heapAfterExecution.find(o => o.id === objId)
  if (!heapItem) {
    return []
  }

  if (heapItem.kind === 'HeapVizHeapObject' && fieldName.length > 0) {
    heapItem.fields.forEach(field => {
      if (field.name === fieldName && field.value.kind === 'HeapVizReferenceVal') {
        reference = field.value.reference
      }
    })
    hoverInfos.push(createHoverField(heapItem.id, fieldName, reference))
    if (reference !== -1) {
      hoverInfos.push(createHoverHeapObject(reference))
    }

    hoverInfos.push(createHoverClass(heapItem.type))

    return hoverInfos
  }
  if (heapItem.kind === 'HeapVizHeapArray' && fieldName.startsWith('i_')) {
    const idx = Number(fieldName.match(/\d+/g)![0])
    const arrayElement = heapItem.elements[idx]
    hoverInfos.push(createHoverArrayCell(objId, idx))

    if (arrayElement.value.kind === 'HeapVizReferenceVal') {
      hoverInfos.push(createHoverHeapObject(arrayElement.value.reference))
    }
    return hoverInfos
  }
  hoverInfos.push(createHoverHeapObject(objId))

  if (objId !== -1) {
    hoverInfos.push(...getReferencesOfHoveredHeapItem(objId, state))
  }

  if (heapItem.kind !== 'HeapVizHeapArray') {
    // info about which class the hovered object belongs to
    hoverInfos.push(createHoverClass(heapItem.type))
  }

  return hoverInfos
}

export function getLocalOrStaticsToHeapItemHoverInfos (sanitizedIdentifier: string, state: HeapVizTraceState): HoverInfo[] {
  const identifier = desanitizeIdentifier(sanitizedIdentifier)
  const loadedClasses = state.loadedClassesAfterExecution
  const methods = state.stackAfterExecution
  const methodId = Number(identifier.match(/\d+/g)?.[0])
  const hoverInfos: HoverInfo[] = []

  const isThisVar = identifier.search('localvar_') === 0
  const isStaticField = identifier.charAt(0) === 's' // s = static, l = local
  const varOrFieldName = identifier
    .split('_') // split identifier by underscores
    .slice(2) // remove the first two elements (s_class_ or l_stackFrameNr_)
    .join('_') // join everything else together which results in the var or field name
  let className = ''
  let method = ''
  let reference = -1

  if (isThisVar) {
    const thisItem = methods[methodId].this
    if (thisItem?.reference) {
      hoverInfos.push(createHoverThisVar(methodId, 'this', thisItem.reference))
      hoverInfos.push(createHoverHeapObject(thisItem.reference))
    }
    return hoverInfos
  }
  if (isStaticField) {
    for (const clazz of loadedClasses) {
      for (const field of clazz.staticFields) {
        className = clazz.class
        if (field.name === varOrFieldName && field.value.kind === 'HeapVizReferenceVal' && field.value.reference > 0) {
          reference = field.value.reference
          hoverInfos.push(createHoverHeapObject(reference))
          break
        }
      }
    }
    hoverInfos.push(createHoverStatic(className, varOrFieldName, reference))
    return hoverInfos
  }
  const currMethod = methods[methodId]
  className = currMethod.class
  method = currMethod.method
  for (const local of currMethod.localVariables) {
    if (local.name === varOrFieldName && local.value.kind === 'HeapVizReferenceVal') {
      reference = local.value.reference
      hoverInfos.push(createHoverHeapObject(reference))
      break
    }
  }

  hoverInfos.push(createHoverLocal(className, method, varOrFieldName, reference))
  return hoverInfos
}

export function getMethodHoverInfos (identifier: string, state: HeapVizTraceState): HoverInfo[] {
  const hoverInfos: HoverInfo[] = []
  for (const stackFrame of state.stackAfterExecution) {
    if (stackFrame.displayText === identifier) {
      hoverInfos.push(createHoverMethod(stackFrame.class, stackFrame.method))
      break
    }
  }
  return hoverInfos
}

export function getReferencesOfHoveredHeapItem (objId: number, state: HeapVizTraceState): HoverInfo[] {
  const hoverInfos: HoverInfo[] = []

  // check if a static field
  for (const loadedClass of state.loadedClassesAfterExecution) {
    for (const staticField of loadedClass.staticFields) {
      if (staticField.value.kind === 'HeapVizReferenceVal' && staticField.value.reference === objId) {
        hoverInfos.push(createHoverStatic(loadedClass.class, staticField.name, objId))
      }
    }
  }

  // check if a local variable is referencing the object
  for (const [index, stackFrame] of state.stackAfterExecution.entries()) {
    const thisVar = stackFrame.this
    if (thisVar && thisVar.reference === objId) {
      hoverInfos.push(createHoverThisVar(index, 'this', objId))
    }

    for (const localVar of stackFrame.localVariables) {
      if (localVar.value.kind === 'HeapVizReferenceVal' && localVar.value.reference === objId) {
        hoverInfos.push(createHoverLocal(stackFrame.class, stackFrame.method, localVar.name, objId))
      }
    }
  }

  // check if a field of another object is referencing the object
  for (const heapItem of state.heapAfterExecution) {
    switch (heapItem.kind) {
      case 'HeapVizHeapArray': {
        for (const arrElement of heapItem.elements) {
          if (arrElement.value.kind === 'HeapVizReferenceVal' && arrElement.value.reference === objId) {
            hoverInfos.push(createHoverArrayCell(arrElement.arrayId, arrElement.index))
          }
        }
        break
      }
      case 'HeapVizHeapObject': {
        for (const field of heapItem.fields) {
          if (field.value.kind === 'HeapVizReferenceVal' && field.value.reference === objId) {
            hoverInfos.push(createHoverField(field.heapObjectId ? field.heapObjectId : -1, field.name, objId))
          }
        }
      }
    }
  }

  return hoverInfos
}

function getHeapVizVarColorOnHover (
  heapItem: HeapVizVar,
  highlightedItems: HoverInfo[],
  state: HeapVizTraceState
): string {
  for (const item of highlightedItems) {
    if (item.kind !== 'Field') {
      continue
    }
    if (heapItem.heapObjectId === item.objId && heapItem.name === item.name) {
      return OBJECT_BG_HOVER
    }
    if (heapItem.heapObjectId === item.reference) {
      return REFERENCED_OBJECT_BG_HOVER
    }
  }

  const identifier = desanitizeIdentifier(heapItem.identifier).split(':')
  const identifierFirst = identifier[1].charAt(0)
  const classOrStackFrameNr = identifier[1].split('_')[1]

  for (const item of highlightedItems) {
    switch (item.kind) {
      case 'ThisVar':
        if (identifier[1].startsWith('localvar') && heapItem.name === 'this' && heapItem.value.kind === 'HeapVizReferenceVal' && heapItem.value.reference === item.reference) {
          return OBJECT_BG_HOVER
        }
        break
      case 'Static':
        if (identifierFirst === 's' && classOrStackFrameNr === item.class && heapItem.name === item.name) {
          return OBJECT_BG_HOVER
        }
        break
      case 'Local': {
        if (identifierFirst !== 'l') {
          break
        }
        const stackFrameNr = Number(classOrStackFrameNr)
        const stackItem = state.stackAfterExecution[stackFrameNr] // method of the local variable
        if (stackItem && stackItem.class === item.class && stackItem.method === item.method && heapItem.name === item.name) {
          return OBJECT_BG_HOVER
        }
        break
      }
      case 'HeapObject': {
        if (identifierFirst === 'o' && heapItem.heapObjectId === item.objId) {
          return REFERENCED_OBJECT_BG_HOVER
        }
        break
      }
    }
  }
  return WHITE
}

export function getItemColorOnHover (
  heapItem: HeapVizVar | HeapVizHeapArray | HeapVizHeapArrayElementVar | HeapVizHeapString,
  highlightedItems: HoverInfo[],
  state: HeapVizTraceState): string {
  switch (heapItem.kind) {
    case 'HeapVizVar':
      return getHeapVizVarColorOnHover(heapItem, highlightedItems, state)
    case 'HeapVizHeapArrayElementVar':
      for (const item of highlightedItems) {
        if (item.kind === 'ArrayCell' && heapItem.arrayId === item.objId && heapItem.index === item.index) {
          return OBJECT_BG_HOVER
        }
      }
      for (const item of highlightedItems) {
        if (item.kind === 'HeapObject' && heapItem.arrayId === item.objId) {
          return REFERENCED_OBJECT_BG_HOVER
        }
      }
      return WHITE
    case 'HeapVizHeapArray':
    case 'HeapVizHeapString':
      for (const item of highlightedItems) {
        if (item.kind === 'HeapObject' && heapItem.id === item.objId) {
          return REFERENCED_OBJECT_BG_HOVER
        }
      }
      return WHITE
  }
}

export function getMethodHeaderBGOnHover (stackFrame: HeapVizStackFrame, highlightedItems: HoverInfo[]): string {
  for (const item of highlightedItems) {
    if (item.kind === 'Method' && stackFrame.class === item.class && stackFrame.method === item.method) {
      return METHOD_HEADER_BG_COLOR_HOVER
    }
  }
  return SUB_HEADER_BG_COLOR
}

export function getHeapItemOrArrayHeaderBGOnHover (heapItem: HeapVizHeapItem | HeapVizHeapArray, highlightedItems: HoverInfo[]): string {
  for (const item of highlightedItems) {
    if (item.kind === 'HeapObject' && heapItem.id === item.objId) {
      return MAIN_HEADER_BG_COLOR_HOVER
    }
  }
  return MAIN_HEADER_BG_COLOR
}

export function isHighlightedEdge (sanitizedFrom: string, sanitizedTo: string, highlightedItems: HoverInfo[], state: HeapVizTraceState): boolean {
  const from = desanitizeIdentifier(sanitizedFrom)
  const to = desanitizeIdentifier(sanitizedTo)
  const toObjId = Number(to.split(':')[0].match(/\d+/g)![0])

  const objectHighlighted = highlightedItems.some(item => item.kind === 'HeapObject' && item.objId === toObjId)
  if (!objectHighlighted) {
    return false
  }
  const isLocal = from.split(':')[1].startsWith('l_')
  const isStatic = from.split(':')[1].startsWith('s_')

  if (from.startsWith('o_')) { // check if a field references a heap item
    const splitFrom = from.split(':')
    const fromObjId = Number(splitFrom[0].match(/\d+/g)![0])

    if (splitFrom[1].startsWith('i_')) {
      const index = Number(splitFrom[1].split('_')[1])
      for (const item of highlightedItems) {
        if (item.kind === 'ArrayCell' &&
          item.objId === fromObjId &&
          item.index === index) {
          return true
        }
      }
      return false
    }
    const field = splitFrom[1]

    for (const item of highlightedItems) {
      if (item.kind === 'Field' &&
          item.objId === fromObjId &&
          item.name === field &&
          item.reference === toObjId) {
        return true
      }
    }
    return false
  }
  if (isLocal) { // check if a local variable or static field is referencing a heap item
    const splitFrom = from.split('_')
    const name = splitFrom[splitFrom.length - 1]
    const stackFrame = state.stackAfterExecution[Number(splitFrom[1])]

    for (const item of highlightedItems) {
      if (item.kind === 'Local' &&
        item.class === stackFrame.class &&
        item.method === stackFrame.method &&
        item.name === name &&
        item.reference === toObjId) {
        return true
      }
    }
    return false
  }
  if (isStatic) {
    const splitFrom = from.split('_')
    const name = splitFrom.slice(2).join('_')
    const classOfStaticField = from.split('_')[1]
    const loadedClass = state.loadedClasses.find(loadedClass => loadedClass.class === classOfStaticField)!

    for (const item of highlightedItems) {
      if (item.kind === 'Static' &&
        item.class === loadedClass.class &&
        item.name === name &&
        item.reference === toObjId) {
        return true
      }
    }
    return false
  }
  if (from.split(':')[1].search('localvar_') === 0) {
    const stackFrameNr = Number(from.split('_')[1])
    const thisVar = state.stackAfterExecution.at(stackFrameNr)?.this
    if (thisVar === undefined) {
      return false
    }

    for (const item of highlightedItems) {
      if (item.kind === 'ThisVar' &&
        thisVar.reference === toObjId &&
        item.methodId === stackFrameNr &&
        item.reference === toObjId) {
        return true
      }
    }

    for (const item of highlightedItems) {
      if (item.kind === 'ThisVar' ||
        item.kind === 'Static' ||
        item.kind === 'Local' ||
        item.kind === 'Field') {
        return false
      }
    }
    return thisVar.reference === toObjId &&
          highlightedItems.some(item => item.kind === 'HeapObject' && item.objId === toObjId)
  }

  return false
}

export function relevantChange (current: HoverInfo[], next: HoverInfo[]) {
  const changes = (new Set(current) as any).symmetricDifference(new Set(next))
  for (const hoverInfo of changes) {
    if (hoverInfo.kind !== 'Line' && hoverInfo.kind !== 'Condition') return true
  }
  return false
}
