import _ from 'lodash'
import { shortTypeName } from './Common'
import {
  LoadedClass,
  LocalVar,
  PrimitiveVal,
  StackFrame,
  StaticVar,
  TraceState
} from '@/dto/TraceState'

const MAX_VIZ_STRING_LEN = 26

function generateVizString (value: string): string {
  return value.length > MAX_VIZ_STRING_LEN ? value.slice(0, MAX_VIZ_STRING_LEN / 2) + '\u2026' + value.slice(-MAX_VIZ_STRING_LEN / 2) : value
}

function sanitizeCharValue (value: string): string {
  switch (value) {
    case '\n':
      return '\\n'
    case '\t':
      return '\\t'
    case '\b':
      return '\\b'
    case '\0':
      return '\\0'
    case '\r':
      return '\\r'
    case '\f':
      return '\\f'
    case '\'':
      return '\\\''
    case '"':
      return '\\"'
    case '\\':
      return '\\\\'
    default: {
      return value
    }
  }
}

function sanitizeStringValue (value: string): string {
  let result = ''
  for (const c of value) {
    result = result + sanitizeCharValue(c)
  }
  return result
}

function sanitizePrimitiveValue (value: PrimitiveVal, type: string): string {
  if (type === 'char') {
    return sanitizeStringValue(value.primitiveValue)
  } else if (type === 'float' || type === 'double') {
    return sanitizeFloatValue(value.primitiveValue)
  }
  return value.primitiveValue
}

function sanitizeFloatValue (value: string): string {
  const MAX_LENGTH = 8
  const ellipsis = '\u2026'
  const overflow = value.length - MAX_LENGTH
  if (overflow > 0) {
    let cutoff = value.indexOf('E')
    if (cutoff < 0) {
      cutoff = value.length
    }
    return value.substring(0, cutoff - overflow) + ellipsis + value.substring(cutoff)
  }
  return value
}

function createTitle (value: PrimitiveVal, type: string): string | undefined {
  if (type === 'float' || type === 'double') {
    return value.primitiveValue
  }
  return undefined
}

function sanitizeTraceState (traceState: TraceState): void {
  traceState
    .heap
    .forEach(heapItem => {
      switch (heapItem.kind) {
        case 'HeapString': {
          heapItem.string = sanitizeStringValue(heapItem.string)
          heapItem.vizString = generateVizString(heapItem.string)
          break
        }
        case 'HeapObject': {
          for (const field of heapItem.fields) {
            if (field.value.kind === 'PrimitiveVal') {
              field.value.title = createTitle(field.value, field.type)
              field.value.vizValue = sanitizePrimitiveValue(field.value, field.type)
            }
          }
          break
        }
        case 'HeapArray': {
          for (let i = 0; i < heapItem.elements.length; i++) {
            const element = heapItem.elements[i]
            const elementValue = element.value
            if (elementValue.kind === 'PrimitiveVal') {
              elementValue.vizValue = sanitizePrimitiveValue(elementValue, element.type)
              elementValue.title = createTitle(elementValue, element.type)
            }
          }
        }
      }
    })

  traceState
    .loadedClasses
    .flatMap(staticClass => staticClass.staticFields)
    .forEach(staticField => {
      if (staticField.value.kind === 'PrimitiveVal') {
        staticField.value.vizValue = sanitizePrimitiveValue(staticField.value, staticField.type)
        staticField.value.title = createTitle(staticField.value, staticField.type)
      }
    })

  traceState
    .stack
    .flatMap(stackFrame => stackFrame.localVariables)
    .forEach(localVar => {
      if (localVar.value.kind === 'PrimitiveVal') {
        localVar.value.vizValue = sanitizePrimitiveValue(localVar.value, localVar.type)
        localVar.value.title = createTitle(localVar.value, localVar.type)
      }
    })

  // add class + method to localvars and class to static fields
  traceState.stack.forEach((stackFrame: StackFrame) => {
    if (stackFrame.method.includes('<init>')) {
      stackFrame.displayText = `Constructor of ${stackFrame.class}`
    } else if (stackFrame.method.includes('<clinit>')) {
      stackFrame.displayText = `Static constructor of ${stackFrame.class}`
    } else {
      const methodNameWithParentheses = addParenthesesToMethodName(stackFrame.method, stackFrame.signature)
      stackFrame.displayText = `${shortTypeName(stackFrame.class)}.${methodNameWithParentheses}`
    }

    stackFrame.localVariables.forEach((localVar: LocalVar) => {
      localVar.class = stackFrame.class
      localVar.method = addParenthesesToMethodName(stackFrame.method, stackFrame.signature)
    })
  })
  traceState.loadedClasses.forEach((loadedClass: LoadedClass) =>
    loadedClass.staticFields.forEach((staticField: StaticVar) => {
      staticField.class = loadedClass.class
    }))

  traceState.heap.forEach(heapItem => {
    if (heapItem.kind === 'HeapObject') {
      heapItem.fields.forEach(field => {
        field.heapObjectId = heapItem.id
      })
    }
  })
}

function addParenthesesToMethodName (methodName: string, signature: string): string {
  return signature.includes('()') ? `${methodName}()` : `${methodName}(...)`
}

function escapeHtml (unsafe: string): string {
  return unsafe
    .replaceAll(/&/g, '&amp;')
    .replaceAll(/</g, '&lt;')
    .replaceAll(/>/g, '&gt;')
    .replaceAll(/"/g, '&quot;')
    .replaceAll(/'/g, '&#039;')
}

export default {
  generateVizString,
  sanitizeTraceState,
  sanitizeFloatValue,
  sanitizeCharValue,
  escapeHtml
}
