import { StackFrame, HeapItem, LocalVar, StaticVar, LocalCondition, ProcessedTraceState, HeapArrayElementVar, HeapString } from '@/dto/TraceState'
import { DeskTestLineMethod, DeskTestVal, DeskTestConditionVal, DeskTestMethod, DeskTestStatic, DeskTestVar, DeskTestCondition, DeskTestLine } from './types'
import { HoverInfo } from '@/hover/types'
import { createHoverCondition, createHoverHeapObject, createHoverLine, createHoverLocal, createHoverMethod, createHoverStatic } from '@/hover/hoverinfo-builder'

export function calculateDeskTestLine (
  previous: DeskTestLine | undefined,
  state: ProcessedTraceState
): DeskTestLine {
  function toDeskTestLineMethod (frame: StackFrame, heap: HeapItem[]): DeskTestLineMethod {
    const vars = new Map<string, DeskTestVal>()
    frame.localVariables
      .filter(v => v.changed)
      .forEach(variable => {
        vars.set(
          JSON.stringify(toDeskTestVar(variable, frame)),
          toDeskTestVal(heap, variable)
        )
      })
    const conditions = new Map<string, DeskTestConditionVal>()
    frame.conditionValues
      .filter(c => c.evaluated)
      .forEach(condition => {
        conditions.set(
          JSON.stringify(toDeskTestCondition(condition, frame.class)),
          { primitive: String(condition.value) }
        )
      })

    return {
      name: frame.method,
      class: frame.class,
      vars,
      conditions
    }
  }
  function toDeskTestVal (heap: HeapItem[], variable: LocalVar | StaticVar): DeskTestVal {
    return getDeskTestValue(heap, variable)
  }

  function toDeskTestMethod (frame: StackFrame): DeskTestMethod {
    return {
      displayText: frame.method,
      class: frame.class,
      vars: frame.localVariables.map(v => toDeskTestVar(v, frame)),
      conditions: frame.conditionValues.map(c => toDeskTestCondition(c, frame.class)),
      hoverInfos: [createHoverMethod(frame.class, frame.method)]
    }
  }

  function toDeskTestStatic (field: StaticVar): DeskTestStatic {
    let reference = -1
    if (field.value.kind === 'ReferenceVal') {
      reference = field.value.reference
    }
    return {
      name: field.name,
      class: field.class,
      type: field.type,
      hoverInfos: [createHoverStatic(field.class, field.name, reference)]
    }
  }

  function toDeskTestVar (variable: LocalVar, frame: StackFrame): DeskTestVar {
    let reference = -1
    if (variable.value.kind === 'ReferenceVal') {
      reference = variable.value.reference
    }
    return {
      class: variable.class,
      name: variable.name,
      method: frame.method,
      type: variable.type,
      hoverInfos: [createHoverLocal(variable.class, frame.method, variable.name, reference)]
    }
  }

  function toDeskTestCondition (condition: LocalCondition, clazz: string): DeskTestCondition {
    return {
      expression: condition.expression,
      id: condition.id,
      class: clazz,
      hoverInfos: [createHoverCondition(clazz, condition.expression)]
    }
  }

  const methods: DeskTestMethod[] = []

  state.stackAfterExecution.forEach(frame => {
    methods.push(toDeskTestMethod(frame))
  })

  const statics = [...(previous?.statics ?? [])]
  state.loadedClassesAfterExecution.flatMap(c => c.staticFields).forEach(field => {
    if (!statics.some(s => s.class === field.class && s.name === field.name)) {
      statics.push(toDeskTestStatic(field))
    }
  })

  const currentMethods: DeskTestLineMethod[] = []
  state.stackAfterExecution.forEach(frame => {
    // when a recursive call happens, only the top stack frame for this method is displayed
    if (!currentMethods.some(m => m.name === frame.method && m.class === frame.class)) {
      currentMethods.push(toDeskTestLineMethod(frame, state.heapAfterExecution))
    }
  })

  const currentStatics = new Map<string, DeskTestVal>()
  state.loadedClassesAfterExecution
    .flatMap(c => c.staticFields)
    .filter(f => f.changed)
    .forEach(field => {
      currentStatics.set(
        JSON.stringify(toDeskTestStatic(field)),
        toDeskTestVal(
          state.heapAfterExecution,
          field
        )
      )
    })

  const currentVars = new Map<string, DeskTestVal>()
  const currentConditions = new Map<string, DeskTestConditionVal>()
  currentMethods.forEach(m => {
    for (const [key, value] of m.vars.entries()) {
      currentVars.set(key, value)
    }
    for (const [key, value] of m.conditions.entries()) {
      currentConditions.set(key, value)
    }
  })

  return {
    line: state.line,
    localUri: state.localUri,
    stateIndex: state.stateIndex,
    methods,
    statics,
    currentVars,
    currentConditions,
    currentStatics,
    hoverInfos: getHoverInfos(state)
  }
}

function getHoverInfos (state: ProcessedTraceState): HoverInfo[] { // only highlight at most one column per line
  const hoverInfos: HoverInfo[] = []
  const frame = state.stackAfterExecution[0]
  // add line as HoverInfo
  hoverInfos.push(createHoverLine(state.line, state.localUri))

  // eslint-disable-next-line no-unreachable-loop
  for (const condition of frame.conditionValues) {
    if (!condition.evaluated) continue
    hoverInfos.push(createHoverCondition(frame.class, condition.expression))
    return hoverInfos
  }

  // eslint-disable-next-line no-unreachable-loop
  for (const localVariable of frame.localVariables) {
    if (!localVariable.changed) continue
    let reference = -1
    if (localVariable.value.kind === 'ReferenceVal') {
      reference = localVariable.value.reference
      hoverInfos.push(createHoverHeapObject(reference))
    }
    hoverInfos.push(createHoverLocal(frame.class, frame.method, localVariable.name, reference))
    return hoverInfos
  }
  // eslint-disable-next-line no-unreachable-loop
  for (const clazz of state.loadedClassesAfterExecution) {
    for (const staticField of clazz.staticFields) {
      if (!staticField.changed) continue
      let reference = -1
      if (staticField.value.kind === 'ReferenceVal') {
        reference = staticField.value.reference
        hoverInfos.push(createHoverHeapObject(reference))
      }
      hoverInfos.push(createHoverStatic(clazz.class, staticField.name, reference))
      return hoverInfos
    }
  }
  return hoverInfos
}

/**
 * @desc Get all the values relevant for the representation of a variable in the DeskTest.
 * @param {array} heap
 * @param {LocalVar | StaticVar} variable
 */
export function getDeskTestValue (heap: HeapItem[], variable: LocalVar | StaticVar): DeskTestVal {
  const repValue: DeskTestVal = {}
  switch (variable.value.kind) {
    case 'PrimitiveVal': {
      repValue.title = variable.value.title
      if (variable.type === 'char') {
        repValue.char = variable.value.vizValue
      } else {
        repValue.primitive = variable.value.vizValue
      }
      return repValue
    }
    case 'ReferenceVal': {
      const reference = variable.value.reference
      const obj = heap.find(obj => obj.id === reference)
      if (obj) {
        switch (obj.kind) {
          case 'HeapArray':
            if (obj.elements.length === 0) {
              return { array: 'empty' }
            } else {
              repValue.array = obj.elements.map((element: HeapArrayElementVar) => {
                const value = element.value
                switch (value.kind) {
                  case 'ReferenceVal': {
                    const object = heap.find(obj => obj.id === value.reference) as HeapString | undefined
                    return object
                      ? {
                        string: object.string,
                        type: object.string ? undefined : object.type
                      }
                      : {
                        error: 'object not found'
                      }
                  }
                    break
                  case 'NullVal':
                    return { isNull: true }
                    break
                  case 'PrimitiveVal':
                    return { primitive: value.vizValue, title: value.title }
                    break
                }
                return { error: 'unknown kind' }
              })
            }
            return repValue
          case 'HeapString':
            repValue.string = obj.string
            return repValue
          case 'HeapObject':
            repValue.reference = variable.value.reference // always display object references because it is the only thing we are currently able to display for objects
            return repValue
          default:
            return { error: 'Here be dragon ... Unknown heap object type' }
        }
      }
      break
    }
    case 'NullVal':
      return { isNull: true }
  }
  return { error: ' unknown value ' }
}
