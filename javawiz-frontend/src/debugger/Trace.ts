import {
  DeskTestLine
} from '@/components/TheDeskTest/types'
import {
  HeapArray, HeapArrayElementVar, HeapItem, HeapObject, HeapString, InputBufferInfo, LoadedClass,
  LocalVar, PrimitiveVal, ProcessedTraceState, ReferenceVal, StackFrame,
  StaticVar, TraceState, Val, Var
} from '@/dto/TraceState'
import { ConsoleLine } from '@Shared/Protocol'
import _ from 'lodash'
import sanitizer from '@/helpers/sanitizer'
import { OverlayVar } from '@/components/TheFlowChart/types'
import { SequenceDiagramHistory } from '@/components/TheSequenceDiagram/SequenceDiagramHistory'
import { Arrow, LifeLine, Box } from '@/components/TheSequenceDiagram/types'
import { calculateDeskTestLine } from '@/components/TheDeskTest/line'
import { TraceData } from './TraceData'

export class Trace {
  private readonly trace: TraceState[]
  private readonly processedTrace: ProcessedTraceState[]
  private readonly deskTestLines: DeskTestLine[]

  private readonly sequenceDiagramHistory: SequenceDiagramHistory

  constructor () {
    this.trace = []
    this.processedTrace = []
    this.deskTestLines = []
    this.sequenceDiagramHistory = new SequenceDiagramHistory()
  }

  public getTraceData (stateIndex: number, previousStateIndex: number | undefined): TraceData | undefined {
    if (stateIndex < 0 || stateIndex >= this.traceLength) {
      return undefined
    }
    return {
      consoleLines: this.getConsoleLines(stateIndex),
      inputBufferInfo: this.getInputBufferInfo(stateIndex),
      stateIndex,
      deskTestLines: this.getDeskTestLines(stateIndex),
      firstTraceState: this.firstState()!,
      flowChartOverlayLocals: this.getFlowChartOverlayLocals(stateIndex),
      flowChartOverlayStatics: this.getFlowChartOverlayStatics(stateIndex),
      processedTraceState: previousStateIndex === undefined ? undefined : this.delta(previousStateIndex, stateIndex),
      stackFrames: this.getStackFrames(stateIndex),
      lifeLines: this.getLifeLines(stateIndex),
      boxes: this.getBoxes(stateIndex),
      timeIdx: this.getTimeIdx(stateIndex),
      arrows: this.getArrows(stateIndex),
      timeIdxStateIdxMap: this.getTimeIdxStateIdxMap(),
      visitedLines: this.getVisitedLines()
    }
  }

  private getConsoleLines (stateIndex: number): ConsoleLine[] {
    return this.trace
      .slice(0, stateIndex + 1)
      .map((state: TraceState) => {
        return { input: state.input, output: state.output, error: state.error }
      })
  }

  public addTraceStates (
    newStates: TraceState[]
  ): void {
    this.sequenceDiagramHistory.addTraceStates(newStates, this.trace.length)
    newStates.forEach((state: TraceState) => {
      sanitizer.sanitizeTraceState(state)
      this.trace.push(state)
    })
    let currentDeskTestLine = this.deskTestLines.pop()
    let currentIdx = this.processedTrace.at(-1)?.stateIndex ?? 0
    let current: TraceState | undefined = this.trace[currentIdx]
    while (current && currentIdx + 1 < this.trace.length) {
      const nextIdx = currentIdx + 1
      const next = this.trace[nextIdx]

      const newProcessedTraceState = Trace.calculateProcessedTraceState(current, next, currentIdx)
      this.processedTrace.push(newProcessedTraceState)

      currentDeskTestLine = calculateDeskTestLine(currentDeskTestLine, newProcessedTraceState)
      this.deskTestLines.push(currentDeskTestLine)
      current = next
      currentIdx = nextIdx
    }

    const first = this.processedTrace[0]
    if (first) {
      Trace.setAllChangedFlagsToTrue(first)
    }
  }

  private getDeskTestLines (stateIndex: number): DeskTestLine[] {
    return this.deskTestLines.filter(line => line.stateIndex < stateIndex)
  }

  private getInputBufferInfo (stateIndex: number): InputBufferInfo {
    return this.trace[stateIndex].inputBufferInfo
  }

  end (lastStates: TraceState[]) {
    if (lastStates.length > 0) {
      this.addTraceStates(lastStates)
    }
    return this.sequenceDiagramHistory.endAllLifeLines()
  }

  getLifeLines (stateIndex: number): LifeLine[] {
    return this.sequenceDiagramHistory.getLifeLines(stateIndex)
  }

  getArrows (stateIndex: number): Arrow[] {
    return this.sequenceDiagramHistory.getArrows(stateIndex)
  }

  getTimeIdx (stateIndex: number): number {
    return this.sequenceDiagramHistory.getTimeIdx(stateIndex)
  }

  getBoxes (stateIndex: number): Box[] {
    return this.sequenceDiagramHistory.getBoxes(stateIndex)
  }

  getTimeIdxStateIdxMap () {
    return this.sequenceDiagramHistory.getTimeIdxStateIdxMap()
  }

  getVisitedLines () {
    return this.sequenceDiagramHistory.getVisitedLines()
  }

  getStackFrames (stateIndex: number) {
    return this.trace[stateIndex].stack
  }

  getHeap (stateIndex: number) {
    return this.trace[stateIndex].heap
  }

  isInLiveMode (stateIdx: number): boolean {
    return stateIdx + 1 === this.trace.length
  }

  isInReplayMode (stateIdx: number): boolean {
    return stateIdx + 1 < this.trace.length
  }

  firstState (): TraceState | undefined {
    return this.trace[0]
  }

  getTraceState (stateIndex: number): TraceState | undefined {
    return this.trace.at(stateIndex)
  }

  private delta (fromIndex: number, toIndex: number): ProcessedTraceState | undefined {
    return Trace.calculateProcessedTraceState(this.trace[fromIndex], this.trace[toIndex], fromIndex)
  }

  get traceLength (): number {
    return this.trace.length
  }

  private getFlowChartOverlayLocals (stateIndex: number): OverlayVar[] {
    const state = this.trace.at(stateIndex)
    if (!state) {
      return []
    }
    let localVariables
    if (state.stack.length === 1) {
      localVariables = state.stack[0].localVariables.filter(v => !(v.type === 'java.lang.String[]' && v.name.startsWith('a'))) // filter args
    } else {
      localVariables = state.stack[0].localVariables
    }
    return localVariables.map(v => {
      const val = v.value
      switch (val.kind) {
        case 'NullVal': return { name: v.name, displayValue: 'null', changed: v.changed }
        case 'PrimitiveVal':
          return {
            name: v.name,
            displayValue: v.type === 'char' ? `'${val.vizValue}'` : val.vizValue,
            changed: v.changed
          }
        case 'ReferenceVal': {
          const item = state.heap.find(item => item.id === val.reference)
          if (!item) {
            console.warn('heap item not found')
            return { name: v.name, displayValue: '', changed: v.changed }
          }
          switch (item.kind) {
            case 'HeapArray': return { name: v.name, displayValue: item.type, changed: v.changed }
            case 'HeapObject': return { name: v.name, displayValue: item.type, changed: v.changed }
            case 'HeapString': return { name: v.name, displayValue: `"${item.vizString}"`, changed: v.changed }
          }
        }
      }
      throw new Error('unknown variable kind')
    })
  }

  private getFlowChartOverlayStatics (stateIndex: number): OverlayVar[] {
    const state = this.trace.at(stateIndex)
    if (!state) {
      return []
    }
    let mainClass = state.loadedClasses[0]
    if (state.loadedClasses.length > 1) {
      const mainClassName = this.trace.at(0)!.stack[0].class
      mainClass = state.loadedClasses.find(c => c.class === mainClassName)!
    }
    const staticFields = mainClass.staticFields

    return staticFields.map(v => {
      const val = v.value
      switch (val.kind) {
        case 'NullVal': return { name: v.name, displayValue: 'null', changed: v.changed }
        case 'PrimitiveVal':
          return {
            name: v.name,
            displayValue: v.type === 'char' ? `'${val.vizValue}'` : val.vizValue,
            changed: v.changed
          }
        case 'ReferenceVal': {
          const item = state.heap.find(item => item.id === val.reference)
          if (!item) {
            console.warn('heap item not found')
            return { name: v.name, displayValue: '', changed: v.changed }
          }
          switch (item.kind) {
            case 'HeapArray': return { name: v.name, displayValue: item.type, changed: v.changed }
            case 'HeapObject': return { name: v.name, displayValue: item.type, changed: v.changed }
            case 'HeapString': return { name: v.name, displayValue: `"${item.vizString}"`, changed: v.changed }
          }
        }
      }
      throw new Error('unknown field kind')
    })
  }

  private static calculateProcessedTraceState (
    current: TraceState,
    next: TraceState,
    index: number): ProcessedTraceState {
    const result: ProcessedTraceState = {
      kind: 'ProcessedTraceState',
      localUri: current.sourceFileUri,
      stateIndex: index,
      line: current.line,
      heapBeforeExecution: current.heap,
      stackBeforeExecution: current.stack,
      loadedClassesBeforeExecution: current.loadedClasses,
      heapAfterExecution: next.heap,
      stackAfterExecution: next.stack,
      loadedClassesAfterExecution: next.loadedClasses
    }

    if (!next) {
      return result
    }

    // local variables
    // We reverse the stack so main() is always index 0, while called methods have higher stackFrameNumbers.
    // This is done to ensure consistent local variable identifiers
    const currentLocalVarLookup = new Map<string, LocalVar>()
    const reversedCurrentStack = [...current.stack].reverse()
    reversedCurrentStack.forEach(function (stackFrame: StackFrame, stackFrameNumber: number) {
      for (const localVar of stackFrame.localVariables) {
        currentLocalVarLookup.set(stackFrameNumber + '_' + localVar.name, localVar)
      }
    })

    const nextLocalVarLookup = new Map<string, LocalVar>()
    const reversedNextStack = [...next.stack].reverse()
    reversedNextStack.forEach(function (stackFrame: StackFrame, stackFrameNumber: number) {
      for (const localVar of stackFrame.localVariables) {
        nextLocalVarLookup.set(stackFrameNumber + '_' + localVar.name, localVar)
      }
    })

    for (const nextLocalVar of nextLocalVarLookup.values()) {
      nextLocalVar.changed = false
    }
    for (const [key, nextLocalVar] of nextLocalVarLookup.entries()) {
      const currLocalVar = currentLocalVarLookup.get(key)
      if (currLocalVar) {
        nextLocalVar.changed = hasChanged(currLocalVar.value, current.heap, nextLocalVar.value, next.heap)
      } else {
        nextLocalVar.changed = true
      }
    }

    const stackSizeIncreased = next.stack.length > current.stack.length

    // stack size increased -> top most stack frame will be a fresh method call -> local vars are the parameters -> all of them should be 'changed'
    if (stackSizeIncreased) {
      next.stack[0].localVariables.forEach((localVar: LocalVar) => {
        localVar.changed = true
      })
    }

    // statics
    const currentStaticVars: StaticVar[] = current.loadedClasses
      .flatMap((clazz: LoadedClass) => clazz.staticFields)

    // loadedClassesAfterExecution will not be null at this point
    const nextStaticVars: StaticVar[] = next.loadedClasses
      .flatMap((clazz: LoadedClass) => clazz.staticFields)

    nextStaticVars.forEach((staticVar: StaticVar) => {
      staticVar.changed = false
    })
    _.differenceWith(nextStaticVars,
      currentStaticVars,
      (nextVar: StaticVar, currVar: StaticVar) => nextVar.name === currVar.name &&
            !hasChanged(currVar.value, current.heap, nextVar.value, next.heap))
      .forEach((changedStaticVar: StaticVar) => {
        changedStaticVar.changed = true
      })

    // heap objects
    const currObjFields: Var[] = current.heap
      .filter((heapItem): heapItem is HeapObject => heapItem.kind === 'HeapObject')
      .flatMap((heapObj: HeapObject) => heapObj.fields)

    // heapAfterExecution will not be null at this point
    const nextObjFields: Var[] = next.heap
      .filter((heapItem): heapItem is HeapObject => heapItem.kind === 'HeapObject')
      .flatMap((heapObj: HeapObject) => heapObj.fields)

    nextObjFields.forEach((field: Var) => {
      field.changed = false
    })

    _.differenceWith(nextObjFields,
      currObjFields,
      (next: Var, curr: Var) => next.heapObjectId === curr.heapObjectId && next.name === curr.name && _.isEqual(next.value, curr.value))
      .forEach((changedObjField: Var) => {
        changedObjField.changed = true
      })

    const currStringCharArr: Var[] = current.heap
      .filter((heapItem): heapItem is HeapString => heapItem.kind === 'HeapString')
      .flatMap((heapStr: HeapString) => heapStr.charArr)

    const nextStringCharArr: Var[] = next.heap
      .filter((heapItem): heapItem is HeapString => heapItem.kind === 'HeapString')
      .flatMap((heapStr: HeapString) => heapStr.charArr)

    nextStringCharArr.forEach((charArr: Var) => {
      charArr.changed = false
    })

    _.differenceWith(nextStringCharArr,
      currStringCharArr,
      (next: Var, curr: Var) => next.name === curr.name && _.isEqual(next.value, curr.value))
      .forEach((changedCharArr: Var) => {
        changedCharArr.changed = true
      })

    // heap array
    const currArrayElements =
        current.heap
          .filter((heapItem): heapItem is HeapArray => heapItem.kind === 'HeapArray')
          .flatMap((ha: HeapArray) => ha.elements)
    const currArrayElementsLookup = new Map<string, HeapArrayElementVar>()
    currArrayElements.forEach((elem: HeapArrayElementVar) => {
      currArrayElementsLookup.set(elem.arrayId + '_' + elem.index, elem)
    })

    const nextArrayElements =
        next.heap
          .filter((heapItem): heapItem is HeapArray => heapItem.kind === 'HeapArray')
          .flatMap((ha: HeapArray) => ha.elements)

    nextArrayElements.forEach((elem: HeapArrayElementVar) => {
      elem.changed = false
    })

    nextArrayElements.forEach((elem: HeapArrayElementVar) => {
      const currElem = currArrayElementsLookup.get(elem.arrayId + '_' + elem.index)
      if (currElem) {
        elem.changed = !_.isEqual(elem.value, currElem.value)
      } else {
        elem.changed = true
      }
    })

    return result
  }

  private static setAllChangedFlagsToTrue (state: ProcessedTraceState) {
    state.stackBeforeExecution
      .flatMap((stackFrame: StackFrame) => stackFrame.localVariables)
      .forEach((localVar: LocalVar) => {
        localVar.changed = true
      })
    state.loadedClassesBeforeExecution
      .flatMap((clazz: LoadedClass) => clazz.staticFields)
      .forEach((staticVar: StaticVar) => {
        staticVar.changed = true
      })
    if (state.loadedClassesAfterExecution) {
      state.loadedClassesAfterExecution
        .flatMap((clazz: LoadedClass) => clazz.staticFields)
        .forEach((staticVar: StaticVar) => {
          staticVar.changed = true
        })
    }
  }
}

function hasChanged (current: Val, currentHeap: HeapItem[], next: Val, nextHeap: HeapItem[]): boolean {
  if (current.kind !== next.kind) {
    return true
  }
  switch (current.kind) {
    case 'NullVal':
      return false
    case 'PrimitiveVal':
      return current.primitiveValue !== (next as PrimitiveVal).primitiveValue
    case 'ReferenceVal': {
      const currentObject = currentHeap.find(hi => hi.id === current.reference)
      const nextObject = nextHeap.find(hi => hi.id === (next as ReferenceVal).reference)
      if (!currentObject && !nextObject) {
        return false
      } else if (!currentObject || !nextObject) {
        return true
      } else if (currentObject.kind !== nextObject.kind) {
        return true
      }
      switch (currentObject.kind) {
        case 'HeapObject':
          return currentObject.id !== nextObject.id
        case 'HeapString':
          return currentObject.string !== (nextObject as HeapString).string
        case 'HeapArray':
          return currentObject.id !== nextObject.id // TODO: check if we want to mark element changes as array changes
      }
    }
  }
}
