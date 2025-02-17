import { HeapArrayElementVar, HeapItem, LoadedClass, ProcessedTraceState, StackFrame, Val, Var } from '@/dto/TraceState'
import { HeapVizTraceState, HeapVizStackFrame, HeapVizHeapItem, HeapVizLoadedClass, HeapVizHeapArray, HeapVizHeapObject, HeapVizHeapString, HeapVizVar, HeapVizVal } from './types'

export function fromProcessedTraceState (processedTraceState: ProcessedTraceState): HeapVizTraceState {
  return {
    kind: 'HeapVizTraceState',
    line: processedTraceState.line,
    // We reverse the stack so main() is always index 0, while called methods have higher stackFrameNumbers.
    // This is done to ensure consistent local variable "port" and "identifier" names.
    stack: [...processedTraceState.stackBeforeExecution].reverse().map(function (stackFrame: StackFrame, stackFrameNumber: number): HeapVizStackFrame {
      return mapStackFrame(stackFrame, stackFrameNumber)
    }),
    heap: processedTraceState.heapBeforeExecution.map(function (hi: HeapItem): HeapVizHeapItem {
      return mapHeapItem(hi)
    }),
    loadedClasses: processedTraceState.loadedClassesBeforeExecution.map(function (lc: LoadedClass): HeapVizLoadedClass {
      return mapLoadedClass(lc)
    }),
    heapAfterExecution: processedTraceState.heapAfterExecution!!
      .map(function (hi: HeapItem): HeapVizHeapItem {
        return mapHeapItem(hi)
      }),
    stackAfterExecution: [...processedTraceState.stackAfterExecution!!].reverse().map(function (stackFrame: StackFrame, stackFrameNumber: number): HeapVizStackFrame {
      return mapStackFrame(stackFrame, stackFrameNumber)
    }),
    loadedClassesAfterExecution: processedTraceState.loadedClassesAfterExecution!!.map(function (lc: LoadedClass): HeapVizLoadedClass {
      return mapLoadedClass(lc)
    })
  }
}

function mapHeapItem (hi: HeapItem): HeapVizHeapItem {
  switch (hi.kind) {
    case 'HeapArray': {
      const vizArr: HeapVizHeapArray = {
        kind: 'HeapVizHeapArray',
        id: hi.id,
        type: hi.type,
        faked: hi.faked,
        elements: hi.elements.map(function (hav: HeapArrayElementVar) {
          return {
            kind: 'HeapVizHeapArrayElementVar',
            type: hav.type,
            value: valToHeapVizVal(hav.value),
            changed: hav.changed,
            port: `i_${hav.index}`,
            identifier: `o_${hi.id}:i_${hav.index}`,
            index: hav.index,
            arrayId: hav.arrayId
          }
        }),
        isVisible: false,
        identifier: `o_${hi.id}`
      }
      return vizArr
    }
    case 'HeapObject': {
      const vizObj: HeapVizHeapObject = {
        kind: 'HeapVizHeapObject',
        id: hi.id,
        type: hi.type,
        faked: hi.faked,
        fields: hi.fields.map(function (f: Var) {
          return {
            kind: 'HeapVizVar',
            name: f.name,
            type: f.type,
            value: valToHeapVizVal(f.value),
            changed: f.changed,
            heapObjectId: f.heapObjectId,
            port: sanitizeIdentifier(f.name),
            identifier: `o_${hi.id}:${sanitizeIdentifier(f.name)}`
          }
        }),
        identifier: `o_${hi.id}`,
        isVisible: false
      }
      return vizObj
    }
    case 'HeapString': {
      const vizStr: HeapVizHeapString = {
        kind: 'HeapVizHeapString',
        id: hi.id,
        type: hi.type,
        faked: hi.faked,
        string: hi.string,
        vizString: hi.vizString,
        charArr: {
          kind: 'HeapVizVar',
          name: hi.charArr.name,
          type: hi.charArr.type,
          value: valToHeapVizVal(hi.charArr.value),
          changed: hi.charArr.changed,
          port: sanitizeIdentifier(hi.charArr.name),
          identifier: `o_${hi.id}:${sanitizeIdentifier(hi.charArr.name)}`
        },
        identifier: `o_${hi.id}`,
        isVisible: true
      }
      return vizStr
    }
  }
}

function mapStackFrame (sf: StackFrame, stackFrameNr: number): HeapVizStackFrame {
  return {
    kind: 'HeapVizStackFrame',
    class: sf.class,
    method: sf.method,
    signature: sf.signature,
    genericSignature: sf.genericSignature,
    localVariables: sf.localVariables.map(function (lv: Var): HeapVizVar {
      return {
        kind: 'HeapVizVar',
        name: lv.name,
        type: lv.type,
        value: valToHeapVizVal(lv.value),
        changed: lv.changed,
        port: `l_${stackFrameNr}_${sanitizeIdentifier(lv.name)}`,
        identifier: `roots:l_${stackFrameNr}_${sanitizeIdentifier(lv.name)}`
      }
    }),
    this: sf.this
      ? {
        kind: 'HeapVizReferenceVal',
        reference: sf.this?.reference
      }
      : undefined,
    displayText: sf.displayText,
    internal: sf.internal
  }
}

function mapLoadedClass (lc: LoadedClass): HeapVizLoadedClass {
  return {
    kind: 'HeapVizLoadedClass',
    class: lc.class,
    staticFields: lc.staticFields.map(function (sf: Var): HeapVizVar {
      return {
        kind: 'HeapVizVar',
        name: sf.name,
        type: sf.type,
        value: valToHeapVizVal(sf.value),
        changed: sf.changed,
        port: `s_${sanitizeIdentifier(lc.class)}_${sanitizeIdentifier(sf.name)}`,
        identifier: `roots:s_${sanitizeIdentifier(lc.class)}_${sanitizeIdentifier(sf.name)}`
      }
    })
  }
}

function valToHeapVizVal (val: Val): HeapVizVal {
  switch (val.kind) {
    case 'ReferenceVal':
      return {
        kind: 'HeapVizReferenceVal',
        reference: val.reference
      }
    case 'PrimitiveVal':
      return {
        kind: 'HeapVizPrimitiveVal',
        vizValue: val.vizValue,
        title: val.title
      }
    case 'NullVal':
      return {
        kind: 'HeapVizNullVal'
      }
  }
}

/*
Dollar characters (e.g. in class names, for inner classes etc.) and dots (package names) seem to cause trouble in the heap viz
therefore we replace them by a dummy value
*/
function sanitizeIdentifier (name: string) {
  return name.replaceAll('$', '_DOLLAR_SIGN_REPLACEMENT_').replaceAll('.', '_DOT_CHARACTER_REPLACEMENT_')
}

export function desanitizeIdentifier (identifier: string) {
  return identifier.replaceAll('_DOLLAR_SIGN_REPLACEMENT_', '$').replaceAll('_DOT_CHARACTER_REPLACEMENT_', '.')
}
