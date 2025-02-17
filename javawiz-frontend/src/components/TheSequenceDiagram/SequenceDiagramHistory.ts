import { Arrow, Box, LifeLine } from '@/components/TheSequenceDiagram/types'
import { HeapItem, HeapObject, LoadedClass, LocalVar, StackFrame, TraceState, Val, Var } from '@/dto/TraceState'
import { getArrowDirection, getBoxesForLifeLine, getElemLabel } from '@/components/TheSequenceDiagram/data-utils'
import { getFirstBox } from '@/components/TheSequenceDiagram/drawing-utils'

export class SequenceDiagramHistory {
  private arrows: Arrow[] = []
  private readonly lifeLines: LifeLine[] = []
  private readonly boxes: Box[] = []
  private eventIdx = 0
  private timeIdx = 1
  private methodCallId = 0
  private mainDepth = 0
  private boxIndex = 0
  private readonly timeIdxStateIdxMap = new Map<number, number>()

  private lastState: TraceState | undefined
  private visitedLines: number[] = []

  // adapts lifelines, arrows and boxes according to new trace states
  public addTraceStates (newStates: TraceState[], stateIndex: number): void {
    let previous = this.lastState

    for (let i = 0; i < newStates.length; i++) {
      const current = newStates[i]
      this.createLifeLines(current, stateIndex + i)

      // create lifelines for objects created inside constructors
      this.createFieldObjects(current, stateIndex + i)
      this.endLifeLines(current)
      this.createCallArrows(previous, current, stateIndex + i)
      this.createReturnArrows(previous, current, stateIndex + i)

      previous = current
    }
    this.visitedLines.push(newStates[newStates.length - 1].line)
    this.lastState = newStates.at(-1) ?? this.lastState
  }

  // returns all lifelines up until a specified state index
  getLifeLines (stateIndex: number) {
    return this.lifeLines.filter(l => stateIndex >= this.timeIdxStateIdxMap.get(l.start)!!)
  }

  // returns all arrows up until a specified state index
  getArrows (stateIndex: number) {
    return this.arrows.filter(a => a.time && stateIndex >= this.timeIdxStateIdxMap.get(a.time)!!)
  }

  // returns all boxes up until a specified state index
  getBoxes (stateIndex: number) {
    return this.boxes.filter(b => stateIndex >= this.timeIdxStateIdxMap.get(b.start)!!)
  }

  // returns all visited lines
  getVisitedLines () {
    return this.visitedLines
  }

  // returns the last time index for a specified state index
  getTimeIdx (stateIndex: number) {
    let maxTimeIdx = 0
    for (const [timeIdx, mapStateIdx] of this.timeIdxStateIdxMap) {
      if (stateIndex >= mapStateIdx && timeIdx > maxTimeIdx) {
        maxTimeIdx = timeIdx
      }
    }
    return maxTimeIdx
  }

  // returns the map of time indices and state indices
  getTimeIdxStateIdxMap () {
    return this.timeIdxStateIdxMap
  }

  // creates lifelines for nested constructors
  private createFieldObjects (current: TraceState, stateIdx: number): number {
    let result = 0
    for (let i = 0; i < this.lifeLines.length; i++) {
      const lifeLine = this.lifeLines[i]
      if (!lifeLine.heapId) {
        continue
      }
      const obj = this.findHeapObject(current.heap, lifeLine.heapId)
      if (obj === null) {
        continue
      }
      const box: Box = {
        lifeLine,
        index: this.boxIndex,
        start: this.timeIdx,
        methodCallId: this.methodCallId,
        depth: 0,
        isDrawn: true,
        wasDrawn: true,
        prevState: 'expanded',
        currState: 'expanded',
        stepOver: false,
        changed: true
      }
      let added = false
      const prevIdx = this.timeIdx
      for (let j = 0; j < obj.fields.length; j++) {
        const field = obj.fields[j]
        const value = field.value
        const [b, l] = this.addFieldLifeLine(value, field, lifeLine, stateIdx, added, prevIdx, box)
        added = b
        if (l !== null) {
          this.createRecursive(field, current.heap, stateIdx, l)
        }
      }
      box.end = this.timeIdx
      if (obj.fields.length > 0 && added && box.end) {
        this.boxIndex++
        this.timeIdx++
      }
      result = obj.fields.length
    }
    return result
  }

  // recursively creates further lifelines for object fields
  private createRecursive (field: Var, heap: HeapItem[], stateIdx: number, lifeLine: LifeLine) {
    const value = field.value
    if (value.kind !== 'ReferenceVal') {
      return
    }
    const obj = this.findHeapObject(heap, value.reference)
    if (obj === null) {
      return
    }
    const box: Box = {
      lifeLine,
      index: ++this.boxIndex,
      start: ++this.timeIdx,
      methodCallId: this.methodCallId,
      depth: 0,
      isDrawn: true,
      wasDrawn: true,
      prevState: 'expanded',
      currState: 'expanded',
      stepOver: false,
      changed: true
    }
    let added = false
    const prevIdx = this.timeIdx
    for (let i = 0; i < obj.fields.length; i++) {
      const field = obj.fields[i]
      const value = field.value
      const [b, l] = this.addFieldLifeLine(value, field, lifeLine, stateIdx, added, prevIdx, box)
      added = b
      if (l !== null) {
        this.createRecursive(field, heap, stateIdx, l)
      }
    }
    box.end = this.timeIdx
    if (!added) {
      this.timeIdx--
    }
  }

  // creates constructor arrow and lifeline for an object field
  private addFieldLifeLine (val: Val, field: Var, lifeLine: LifeLine, stateIdx: number, added: boolean, prevIdx: number, box: Box): [boolean, LifeLine | null] {
    if (val.kind !== 'ReferenceVal' || field.type.includes('java.lang') || field.type.includes('[]')) {
      return [added, null]
    }
    for (let i = 0; i < this.lifeLines.length; i++) {
      if (this.lifeLines[i].heapId && this.lifeLines[i].heapId === val.reference) {
        return [added, null]
      }
    }
    const className = getElemLabel(field.type)
    const arrow: Arrow = {
      from: lifeLine,
      label: `${className} ()`,
      kind: 'Constructor',
      methodCallId: ++this.methodCallId,
      fromDepth: 0,
      toDepth: 0,
      direction: 'Right',
      isHidden: false,
      changed: true,
      time: this.timeIdx,
      line: 0,
      fromBoxIndex: this.boxIndex,
      to: lifeLine
    }
    this.timeIdx++
    const otherLifeLine: LifeLine = {
      index: this.eventIdx,
      label: field.name,
      heapId: val.reference,
      start: this.timeIdx,
      className,
      currState: 'expanded',
      prevState: 'expanded',
      isDrawn: true,
      wasDrawn: true,
      programEnd: false,
      changed: true
    }
    this.arrows.push(arrow)
    if (!added) {
      this.boxes.push(box)
      this.timeIdxStateIdxMap.set(prevIdx, stateIdx)
      added = true
    }
    this.lifeLines.push(otherLifeLine)
    this.eventIdx++
    arrow.to = otherLifeLine
    this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
    return [added, otherLifeLine]
  }

  // creates a new return arrow
  private createReturnArrows (previous: TraceState | undefined, current: TraceState, stateIdx: number): void {
    if (!previous) {
      return
    }
    if (previous.stack.length === current.stack.length || current.stack[0].class.includes('java.')) {
      return
    }
    for (let i = 0; i < (previous.stack.length - current.stack.length); i++) {
      const fromLifeLine = this.getLifeLine(previous.stack[i])!!
      const toLifeLine = this.getLifeLine(current.stack[0])!!
      if (previous.stack[i]!!.class.includes('java.') || !current.stack[i]) {
        continue
      }
      if (this.getLabel(current, i).includes('void <init', 0)) {
        continue
      }
      const methodCall = this.getMethodCall(fromLifeLine, toLifeLine, this.timeIdx)
      if (methodCall.id === -1) {
        continue
      }
      const newArrow: Arrow = {
        from: fromLifeLine,
        to: toLifeLine,
        fromBoxIndex: methodCall.toBoxIndex,
        toBoxIndex: methodCall.fromBoxIndex,
        label: 'return',
        time: this.timeIdx,
        kind: 'Return',
        methodCallId: methodCall.id,
        fromDepth: methodCall.toDepth,
        toDepth: methodCall.fromDepth,
        direction: getArrowDirection(fromLifeLine, toLifeLine),
        isHidden: false,
        changed: true,
        line: current.stack[0].line
      }
      for (let j = 0; j < this.boxes.length; j++) {
        const box = this.boxes[j]
        if (box.methodCallId === methodCall.id && box.depth === methodCall.toDepth) {
          box.end = this.timeIdx
          box.returnArrow = newArrow
        }
      }
      this.arrows.push(newArrow)
      this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
      this.timeIdx++
    }
  }

  // returns the needed depth of an arrow
  private getArrowDepth (from: LifeLine, to: LifeLine | null): [fromDepth: number, toDepth: number] {
    let fromDepth = 0
    let toDepth = 0
    const fromBoxes = getBoxesForLifeLine(from, this.boxes)
    const toBoxes = getBoxesForLifeLine(to, this.boxes)
    if (from === to) {
      if (from.heapId) {
        const maxDepth = this.getMaxDepthForLifeLine(from)
        for (let i = 0; i < fromBoxes.length; i++) {
          if (!fromBoxes[i].end) {
            fromDepth = maxDepth + 1
            toDepth = maxDepth + 1
          }
        }
      } else {
        for (let i = 0; i < fromBoxes.length; i++) {
          if (!fromBoxes[i].end || this.timeIdx === fromBoxes[i].end) {
            fromDepth = fromBoxes[i].depth + 1
            toDepth = fromDepth
          }
        }
      }
    } else {
      if (to !== null) {
        for (let i = 0; i < toBoxes.length; i++) {
          if (!toBoxes[i].end) {
            toDepth = toBoxes[i].depth + 1
          }
        }
      }

      for (let i = 0; i < fromBoxes.length; i++) {
        if (!fromBoxes[i].end) {
          fromDepth = fromBoxes[i].depth
        }
      }
    }
    if (!to) {
      return [fromDepth, fromDepth]
    }
    return [fromDepth, toDepth]
  }

  // returns the latest defined box of a lifeline
  private getLastBoxForLifeLine (lifeLine: LifeLine) {
    const boxesForLifeLine = getBoxesForLifeLine(lifeLine, this.boxes)
    let time = 0
    let lastBox = getFirstBox(this.boxes, lifeLine)!!
    for (let i = 0; i < boxesForLifeLine.length; i++) {
      const endTime = boxesForLifeLine[i].end ?? this.timeIdx
      if (endTime > time) {
        time = endTime
        lastBox = boxesForLifeLine[i]
      }
    }
    return lastBox
  }

  private createInitialCallArrow (current: TraceState, stateIdx: number) {
    if (current === null) {
      return
    }
    const lifeLine = this.getLifeLine(current.stack[0])!!
    const label: string = this.getLabel(current, 0)
    lifeLine.currState = 'expanded'
    const mainArrow: Arrow = {
      from: lifeLine,
      to: lifeLine,
      fromBoxIndex: this.boxIndex,
      toBoxIndex: this.boxIndex,
      label,
      kind: 'CallMain',
      time: this.timeIdx,
      methodCallId: this.methodCallId,
      fromDepth: this.mainDepth,
      toDepth: this.mainDepth,
      direction: 'Neither',
      isHidden: true,
      wasHidden: true,
      changed: true,
      line: current.stack[0].line
    }
    const methodCallBox: Box = {
      lifeLine,
      index: this.boxIndex,
      start: this.timeIdx,
      methodCallId: this.methodCallId,
      callArrow: mainArrow,
      depth: this.mainDepth,
      isDrawn: true,
      currState: 'expanded',
      wasDrawn: true,
      prevState: 'expanded',
      stepOver: false,
      changed: true
    }
    this.boxes.push(methodCallBox)
    this.addArrow(mainArrow)
    this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
    this.timeIdx++
    this.mainDepth++
    this.boxIndex++
  }

  private createConstructorArrows (previous: TraceState, current: TraceState) {
    for (let i = 0; i < (current.heap.length - previous.heap.length); i++) { // TODO: check if new heap objects are only added at end
      const item = current.heap[current.heap.length - 1 - i]
      if (item.kind !== 'HeapObject') {
        continue
      }
      if (current.stack.some(frame => frame.this && frame.this.reference === item.id)) {
        continue
      }
      const fromLifeLine = this.getLifeLine(previous.stack[0])
      if (fromLifeLine === null) {
        continue
      }
      const fromBox = this.getLastBoxForLifeLine(fromLifeLine)
      if (!fromBox) {
        continue
      }
      const constructorLabel = getElemLabel(`${item.type} ()`)
      const arrow: Arrow = {
        kind: 'Constructor',
        from: fromBox.lifeLine,
        fromBoxIndex: fromBox.index,
        label: constructorLabel,
        reference: item.id,
        methodCallId: this.methodCallId,
        fromDepth: this.getArrowDepth(fromLifeLine, null)[0],
        toDepth: 0,
        direction: 'Right',
        isHidden: true,
        changed: true,
        line: previous.stack[0].line
      }
      this.addArrow(arrow)
    }
  }

  // creates a call arrow
  private createCallArrows (previous: TraceState | undefined, current: TraceState, stateIdx: number): void {
    if (!previous) {
      this.createInitialCallArrow(current, stateIdx)
      return
    }
    if (previous.heap.length <= current.heap.length) {
      this.createConstructorArrows(previous, current)
    }
    if (previous.stack[0]!!.class.includes('java.')) {
      return
    }
    for (let i = 0; i < (current.stack.length - previous.stack.length); i++) {
      const fromLifeLine = this.getLifeLine(previous.stack[0]) // TODO: is this safe if more than one stack frame is pushed at once?
      const toLifeLine = this.getLifeLine(current.stack[i])
      let label = this.getLabel(current, i)
      if (label.includes('void <init', 0)) {
        label = 'constructor'
      }
      if (current.stack[i].class.includes('java.')) {
        continue
      }
      if (toLifeLine === null && label === 'constructor') {
        label = current.stack[0].class.includes('[]') ? `${current.stack[0].class}` : `${current.stack[0].class} ()`
        label = getElemLabel(label)

        let fromBoxIndex
        let from
        let fromDepth = 0

        if (fromLifeLine !== null) {
          const lastBox = this.getLastBoxForLifeLine(fromLifeLine)
          fromLifeLine.currState = 'expanded'
          from = fromLifeLine
          fromBoxIndex = lastBox.index
          fromDepth = this.getArrowDepth(fromLifeLine, toLifeLine)[0]
        }
        const newArrow: Arrow = {
          from,
          fromBoxIndex,
          label,
          this: current.stack[0].this,
          kind: 'Constructor',
          methodCallId: this.methodCallId,
          fromDepth,
          toDepth: 0,
          direction: 'Right',
          isHidden: true,
          changed: true,
          line: previous.stack[0].line
        }

        this.addArrow(newArrow)
      }
      if (fromLifeLine === null || toLifeLine === null) {
        return
      }
      const [fromDepth, toDepth] = this.getArrowDepth(fromLifeLine, toLifeLine)
      let lastBox = this.getLastBoxForLifeLine(fromLifeLine)
      if (fromLifeLine === toLifeLine) {
        const boxesForLifeLine = getBoxesForLifeLine(fromLifeLine, this.boxes)
        for (let j = 0; j < boxesForLifeLine.length; j++) {
          if (this.timeIdx === (boxesForLifeLine[j].end ? boxesForLifeLine[j].end : this.timeIdx)) {
            lastBox = boxesForLifeLine[j]
          }
        }
      }
      const toBoxIndex = this.boxIndex
      fromLifeLine.currState = 'expanded'
      toLifeLine.currState = 'expanded'
      const newFromLifeLine = lastBox.lifeLine
      const direction = getArrowDirection(fromLifeLine, toLifeLine)
      const line = previous.stack[0].line
      let newArrow: Arrow
      const common = {
        from: newFromLifeLine,
        to: toLifeLine,
        fromBoxIndex: lastBox.index,
        time: this.timeIdx,
        methodCallId: this.methodCallId,
        fromDepth,
        toDepth,
        direction,
        isHidden: false,
        changed: true,
        line
      }
      if (label === 'constructor') {
        label = getElemLabel(toLifeLine.className.includes('[]') ? `${toLifeLine.className}` : `${toLifeLine.className} ()`)
        newArrow = {
          label,
          this: current.stack[0].this,
          kind: 'Constructor',
          ...common
        }
      } else {
        newArrow = {
          toBoxIndex,
          label,
          kind: 'Call',
          ...common
        }
        const methodCallBox: Box = {
          lifeLine: toLifeLine,
          index: this.boxIndex,
          start: this.timeIdx,
          methodCallId: this.methodCallId,
          callArrow: newArrow,
          depth: toDepth,
          isDrawn: true,
          wasDrawn: true,
          prevState: 'expanded',
          currState: 'expanded',
          stepOver: false,
          changed: true
        }
        const newToLifeLine = this.getLifeLineByIndex(toLifeLine.index)!! // TODO: ===toLifeLine?
        if (methodCallBox.currState === 'hidden') {
          const boxesForLifeLine = getBoxesForLifeLine(newToLifeLine, this.boxes)
          const allHidden = boxesForLifeLine.every(box => box.currState === 'hidden')
          const constructor = this.arrows.some((a: Arrow) => a.kind === 'Constructor' && a.to === newToLifeLine && !a.isHidden)
          if (allHidden && !constructor) {
            newToLifeLine.currState = 'hidden'
          }
        } else {
          newToLifeLine.currState = 'expanded'
        }
        this.boxes.push(methodCallBox)
        this.boxIndex++
      }
      const added = this.addArrow(newArrow)
      if (added) {
        this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
        this.timeIdx++
      } else if (this.arrows.every(arrow => arrow.line !== newArrow.line)) {
        this.arrows.push(newArrow)
        this.methodCallId++

        this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
        this.timeIdx++
      }
    }
  }

  // returns the lifeline that corresponds to a unique index
  private getLifeLineByIndex (index: number) {
    for (let i = 0; i < this.lifeLines.length; i++) {
      if (this.lifeLines[i].index === index) {
        return this.lifeLines[i]
      }
    }
  }

  // returns the method call at a specified time index going from one lifeline to another
  private getMethodCall (from: LifeLine, to: LifeLine, time: number): { id: number, toDepth: number, fromDepth: number, fromBoxIndex: number, toBoxIndex: number } {
    const maxDepth = this.getMaxDepthForLifeLine(to)
    for (let i = 0; i < this.boxes.length; i++) {
      const arrow = this.boxes[i].callArrow
      if (!arrow) continue
      const lifeLineMatch = arrow.from === to && arrow.to === from
      if (lifeLineMatch && arrow.kind === 'Call' && arrow.time!! < time && !this.boxes[i].end && arrow.fromDepth === maxDepth) {
        return {
          id: arrow.methodCallId,
          toDepth: arrow.toDepth,
          fromDepth: maxDepth,
          fromBoxIndex: arrow.fromBoxIndex!!,
          toBoxIndex: arrow.toBoxIndex!!
        }
      }
    }
    return { id: -1, toDepth: -1, fromDepth: -1, fromBoxIndex: -1, toBoxIndex: -1 }
  }

  // returns the maximum box depth that exists for a specified lifeline
  private getMaxDepthForLifeLine (l: LifeLine) {
    const boxesForLifeLine = getBoxesForLifeLine(l, this.boxes)
    let max = 0
    for (let i = 0; i < boxesForLifeLine.length; i++) {
      const box = boxesForLifeLine[i]
      if (!box.end && box.depth > max) {
        max = box.depth
      }
    }
    return max
  }

  // returns the label for a call arrow
  private getLabel (current: TraceState, index: number): string {
    return current.stack[index].displaySignature
  }

  // appends an arrow to the list of existing arrows
  private addArrow (arrow: Arrow): boolean {
    let foundCallArrow: boolean = false
    let foundReturnArrow: boolean = false
    for (let i = 0; i < this.arrows.length; i++) {
      if (this.arrows[i].from === arrow.from && this.arrows[i].to === arrow.to && this.arrows[i].label === arrow.label && this.arrows[i].kind === arrow.kind) {
        const thisReferenceMatch = !!arrow.this && this.arrows[i] && this.arrows[i].this?.reference === arrow.this?.reference
        const staticMatch = !arrow.this && !this.arrows[i].this && !arrow.reference && !this.arrows[i].reference
        const implicitReferenceMatch = arrow.reference && this.arrows[i].reference && arrow.reference === this.arrows[i].reference
        if (thisReferenceMatch || staticMatch || implicitReferenceMatch) {
          foundCallArrow = true
        }
        for (let j = 0; j < this.arrows.length; j++) { // TODO: does loop need to be nested?
          if (this.arrows[j].from === arrow.to && this.arrows[j].to === arrow.from && this.arrows[j].label === 'return' && this.arrows[j].kind === 'Return') {
            foundReturnArrow = true
          }
        }
      }
    }
    if (!foundCallArrow || foundReturnArrow) {
      this.arrows.push(arrow)
      this.methodCallId++
      return true
    }
    return false
  }

  private getLifeLine (frame: StackFrame) {
    const thisReference = frame.this?.reference
    for (let i = 0; i < this.lifeLines.length; ++i) {
      const lifeLine = this.lifeLines[i]
      if (thisReference !== undefined && lifeLine.heapId === thisReference) {
        return lifeLine
      }
      if (thisReference === undefined && lifeLine.label === frame.class) {
        return lifeLine
      }
    }
    return null
  }

  // searches for an object inside the local variables of a stack frame
  private searchLocalVariables (stack: StackFrame[], heap: HeapItem[], reference: number): [objectName: string | null, objectId: number | undefined] {
    let objectName = null
    let objectId: number | undefined
    for (let i = 0; i < stack.length; i++) {
      const localVariables: LocalVar[] = stack[i].localVariables
      for (let j = 0; j < localVariables.length; j++) {
        const localValue = localVariables[j].value
        if (localValue.kind !== 'ReferenceVal') {
          continue
        }
        if (localValue.reference === reference) {
          objectName = localVariables[j].name
          objectId = localValue.reference
          continue
        }

        for (let k = 0; k < heap.length; k++) { // TODO: reduce depth
          const object = heap[k]
          if (object.kind !== 'HeapArray' || object.id !== localValue.reference) {
            continue
          }
          for (let l = 0; l < object.elements.length; l++) {
            const heapValue = object.elements[l].value
            if (heapValue.kind === 'ReferenceVal' && heapValue.reference === reference) {
              objectName = localVariables[j].name + '[' + l + ']' // found array element
              objectId = heapValue.reference
            }
          }
        }
      }
    }
    return [objectName, objectId]
  }

  // searches for an object inside the fields of a heap item
  private searchHeap (heap: HeapItem[], loadedClasses: LoadedClass[], reference: number): [objectName: string | null, objectId: number | undefined] {
    let objectName = null
    let objectId: number | undefined
    for (let i = 0; i < heap.length; i++) {
      const object = heap[i]
      if (object.kind === 'HeapObject') {
        for (let j = 0; j < object.fields.length; j++) {
          const value = object.fields[j].value
          if (value.kind === 'ReferenceVal' && value.reference === reference) {
            objectName = object.fields[j].name
            objectId = value.reference
          }
        }
        if (objectName === null && object.id === reference) {
          objectName = this.searchLoadedClasses(loadedClasses, object.id)
          if (objectName !== null) {
            objectId = reference
          }
        }
      } else if (object.kind === 'HeapArray') {
        for (let j = 0; j < object.elements.length; j++) {
          const value = object.elements[j].value
          if (value.kind === 'ReferenceVal' && value.reference === reference) {
            objectName = this.searchLoadedClasses(loadedClasses, object.elements[j].arrayId)
            if (objectName !== null) {
              objectName = objectName + '[' + j + ']'
              objectId = reference
            }
          }
        }
      }
    }
    return [objectName, objectId]
  }

  // searches for a reference inside the static fields of all loaded classes
  private searchLoadedClasses (loadedClasses: LoadedClass[], reference: number): string | null {
    for (let i = 0; i < loadedClasses.length; i++) {
      for (let j = 0; j < loadedClasses[i].staticFields.length; j++) {
        const staticValue = loadedClasses[i].staticFields[j].value
        if (staticValue.kind === 'ReferenceVal' && reference === staticValue.reference) {
          return loadedClasses[i].staticFields[j].name
        }
      }
    }
    return null
  }

  // searches for an object inside the fields of a heap item
  private findHeapObject (heap: HeapItem[], reference: number): HeapObject | null {
    for (let i = 0; i < heap.length; i++) {
      const object = heap[i]
      if (object.kind === 'HeapObject' && object.id === reference) {
        return object
      }
    }
    return null
  }

  // returns the object associated with a specified trace state
  private getObject (newState: TraceState) {
    const stack: StackFrame[] = newState.stack
    const heap: HeapItem[] = newState.heap
    let objectName = null
    let objectId: number | undefined = 0
    const thisObject = stack[0].this
    if (thisObject) {
      [objectName, objectId] = this.searchLocalVariables(stack, heap, thisObject.reference)
      if (objectName === null) {
        [objectName, objectId] = this.searchHeap(heap, newState.loadedClasses, thisObject.reference)
      }
    }
    return {
      objectName,
      objectId
    }
  }

  private getRefObject (newState: TraceState, reference: number) {
    const stack: StackFrame[] = newState.stack
    const heap: HeapItem[] = newState.heap
    let objectName = null
    let objectId: number | undefined = 0;
    [objectName, objectId] = this.searchLocalVariables(stack, heap, reference)
    if (objectName === null) {
      [objectName, objectId] = this.searchHeap(heap, newState.loadedClasses, reference)
    }
    return {
      objectName,
      objectId
    }
  }

  private createTargetLifeLine (arrow: Arrow, stateIdx: number, current: TraceState) {
    if (!arrow.isHidden || arrow.to !== undefined || arrow.from === undefined) {
      return
    }
    let reference: number | undefined
    if (arrow.this) {
      reference = arrow.this?.reference
    } else if (arrow.reference) {
      reference = arrow.reference
    }
    if (!reference) {
      return
    }
    const className = getElemLabel(arrow.label.substring(0, arrow.label.indexOf(' ')))
    const diffObject = this.getRefObject(current, reference)
    const label = diffObject.objectName
    if (diffObject.objectId === 0 || !label) {
      return
    }
    if (this.lifeLines.some(lifeLine => lifeLine.heapId === diffObject.objectId)) {
      return
    }
    this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
    this.timeIdx++

    const newLifeLine: LifeLine = {
      index: this.eventIdx,
      label,
      heapId: diffObject.objectId,
      start: this.timeIdx,
      className,
      currState: 'expanded',
      prevState: 'expanded',
      isDrawn: true,
      wasDrawn: true,
      programEnd: false,
      changed: true
    }
    arrow.wasHidden = true
    arrow.isHidden = false
    arrow.time = this.timeIdx - 1
    arrow.to = newLifeLine
    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i]
      if (arrow.time >= box.start &&
              arrow.time <= (box.end ?? this.timeIdx) &&
              box.lifeLine === arrow.from) {
        arrow.fromDepth = box.depth
      }
    }

    this.lifeLines.push(newLifeLine)
    this.eventIdx++
    this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
    this.timeIdx++
    if (!newLifeLine.label.includes('[')) {
      const filteredArrows = this.arrows.filter(a => a !== undefined && a.time !== undefined) // TODO: use library function? not sure what this block does
      const sortedArrows: Arrow[] = []
      let max = 0
      for (let i = 0; i < filteredArrows.length; i++) {
        if (filteredArrows[i] !== undefined && filteredArrows[i].time!! > max) {
          max = filteredArrows[i].time!!
        }
      }
      for (let i = 0; i < filteredArrows.length; i++) {
        for (let j = 0; j < filteredArrows.length; j++) {
          if (filteredArrows[j].time!! < filteredArrows[i].time!! && !sortedArrows.includes(filteredArrows[j])) {
            sortedArrows.push(filteredArrows[j])
          }
        }
        if (!sortedArrows.includes(filteredArrows[i])) {
          sortedArrows.push(filteredArrows[i])
        }
      }
      this.arrows = sortedArrows
    }
  }

  // creates new lifelines
  private createLifeLines (current: TraceState, stateIdx: number): void {
    const object = this.getObject(current)
    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]
      this.createTargetLifeLine(arrow, stateIdx, current)
    }
    for (let i = 0; i < current.stack.length; i++) {
      let name = current.stack[i].class
      if (name.includes('java.')) {
        name = 'java'
      } else if (name.includes('jdk.')) {
        name = 'jdk'
      }
      if (name !== 'java' && name !== 'jdk') {
        name = getElemLabel(name)
      }
      let label = this.getLabel(current, i)
      if (label.includes('void <init', 0)) {
        label = 'constructor'
      }
      if (label === 'constructor') {
        continue
      }
      if (object.objectName === null) {
        let found: boolean = false
        for (let j = 0; j < this.lifeLines.length; j++) {
          if (this.lifeLines[j].label === current.stack[i].class || (this.lifeLines[j].heapId && current.stack.length > 0 &&
              current.stack[0].this && this.lifeLines[j].heapId === current.stack[0].this.reference)) {
            found = true
            break
          }
        }
        if (!found && name !== 'java' && name !== 'jdk') {
          const newLifeLine: LifeLine = {
            index: this.eventIdx,
            label: current.stack[i].class,
            start: this.timeIdx,
            className: name,
            currState: 'expanded',
            prevState: 'expanded',
            isDrawn: true,
            wasDrawn: true,
            programEnd: false,
            changed: true
          }
          this.lifeLines.push(newLifeLine)
          this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
          this.eventIdx++
          this.timeIdx++
        }
      } else if (this.lifeLines.every(lifeLine => lifeLine.heapId !== object.objectId) && name !== 'java' && name !== 'jdk') {
        const newLifeLine: LifeLine = {
          index: this.eventIdx,
          label: object.objectName,
          heapId: object.objectId,
          start: this.timeIdx,
          className: name,
          currState: 'expanded',
          prevState: 'expanded',
          isDrawn: true,
          wasDrawn: true,
          programEnd: false,
          changed: true
        }
        this.lifeLines.push(newLifeLine)
        this.timeIdxStateIdxMap.set(this.timeIdx, stateIdx)
        this.eventIdx++
        this.timeIdx++
      }
    }
  }

  // ends all lifelines at the end of a program
  public endAllLifeLines (): void {
    for (let i = 0; i < this.lifeLines.length; i++) {
      this.lifeLines[i].programEnd = true
      if (!this.lifeLines[i].end) {
        this.lifeLines[i].end = this.timeIdx
      }
    }
  }

  // ends a lifeline if it is no longer active
  private endLifeLines (state: TraceState): void {
    let anyEnded: boolean = false
    for (let i = 0; i < this.lifeLines.length; i++) {
      const lifeLine = this.lifeLines[i]
      if (!lifeLine.heapId || lifeLine.end) { // don't end static lifelines; ignore ended lifeLines
        continue
      }
      const heapObject = this.findHeapObject(state.heap, lifeLine.heapId)
      if (heapObject === null) {
        lifeLine.end = this.timeIdx
        anyEnded = true
      }
    }
    if (anyEnded) {
      this.timeIdx++
    }
  }
}
