import { ProcessedHeapItem, ProcessedTraceState } from '@/dto/TraceState';
import { IHeapVizHeapItem } from './HeapVizHeapItem';
import { HeapVizHeapObject } from './HeapVizHeapObject';
import { HeapVizLoadedClass } from './HeapVizLoadedClass';
import { HeapVizStackFrame } from './HeapVizStackFrame';
import { HeapVizHeapString } from './HeapVizHeapString';
import { HeapVizHeapArray } from './HeapVizHeapArray';
import { NewLine } from '../constants';
import { HeapVizReferenceVal } from './HeapVizReferenceVal';
import { MemoryViewRenderContext } from '../MemoryViewRenderContext'

export class HeapVizTraceState {
  private getHeapTotalBytes (): number {
    const aggregatedBackingArrays = new Set(this.heapAfterExecution
      .filter((item): item is HeapVizHeapString => item instanceof HeapVizHeapString && !item.fieldIsVisible)
      .map(item => item.backingArrayId)
      .filter((id): id is number => id !== undefined))

    return this.heapAfterExecution.reduce((sum, heapItem) => {
      if (heapItem instanceof HeapVizHeapArray && aggregatedBackingArrays.has(heapItem.id))
        return sum
      return sum + heapItem.getTotalBytes()
    }, 0)
  }

  public getTotalBytes (): number {
    return this.loadedClassesAfterExecution.reduce((sum, loadedClass) => sum + loadedClass.getTotalBytes(), 0)
      + this.getHeapTotalBytes()
      + this.stackAfterExecution.reduce((sum, stackFrame) => sum + stackFrame.getTotalBytes(), 0)
  }

  public renderDetailsStatics (): string {
    return `<i>${this.loadedClassesAfterExecution.reduce((sum, loadedClass) => sum + loadedClass.getTotalBytes(), 0)} bytes</i>`
  }

  public renderDetailsHeap (): string {
    return `<i>${this.getHeapTotalBytes()} bytes</i>`
  }

  public renderDetailsStack (): string {
    return `<i>${this.stackAfterExecution.reduce((sum, stackFrame) => sum + stackFrame.getTotalBytes(), 0)} bytes</i>`
  }

  line: number; // currently active line
  stack: HeapVizStackFrame[]; // function stack; it depends on the StepRequest depth and class filters (defined in Main.kt) which methods appear here
  heap: IHeapVizHeapItem[]; // active references to Arrays, Strings and Objects
  loadedClasses: HeapVizLoadedClass[]; // classes together with their static fields
  heapAfterExecution: IHeapVizHeapItem[];
  stackAfterExecution: HeapVizStackFrame[];
  loadedClassesAfterExecution: HeapVizLoadedClass[];

  constructor (model: ProcessedTraceState, private readonly renderContext: MemoryViewRenderContext = new MemoryViewRenderContext()) {
    this.line = model.line;
    const stackGrew = model.stackAfterExecution.length > model.stackBeforeExecution.length;
    this.line = model.line;
    // We reverse the stack so main() is always index 0, while called methods have higher stackFrameNumbers.
    // This is done to ensure consistent local variable "port" and "identifier" names.
    this.stack = [...model.stackBeforeExecution].reverse().map((a, b) => new HeapVizStackFrame(a, b, renderContext));
    this.loadedClasses = model.loadedClassesBeforeExecution.map(e => new HeapVizLoadedClass(e, renderContext));
    this.heap = model.heapBeforeExecution.map(e => this.fromHeapItem(e));
    this.loadedClassesAfterExecution = model.loadedClassesAfterExecution.map(e => new HeapVizLoadedClass(e, renderContext));
    this.heapAfterExecution = model.heapAfterExecution.map(e => this.fromHeapItem(e));
    this.stackAfterExecution = [...model.stackAfterExecution].reverse().map((frame, stackFrameNumber) =>
      new HeapVizStackFrame(
        frame,
        stackFrameNumber,
        renderContext,
        stackGrew && stackFrameNumber === model.stackAfterExecution.length - 1
      ));
  }

  public fromHeapItem (hi: ProcessedHeapItem): IHeapVizHeapItem {

    switch (hi.kind) {
      case 'HeapArray':
        return new HeapVizHeapArray(hi, this.renderContext);
      case 'HeapObject':
        return new HeapVizHeapObject(hi, this.renderContext);
      case 'HeapString': {
        return new HeapVizHeapString(hi, this.renderContext);
      }
    }
  }

  public edges ():string {

    let dotString = ''
    dotString += this.getStackEdges()
    dotString += this.getStaticsEdges()
    dotString += this.getFieldEdges()
    return dotString
  }

  private getFieldEdges (): string {

    return this.heapAfterExecution.filter(e => e.isVisible && (e instanceof HeapVizHeapArray || e instanceof HeapVizHeapObject || e instanceof HeapVizHeapString))
      .map(e => e.edges())
      .join(NewLine)

  }

  private getStackEdges () {
    let dotString = ''

    for (const frame of this.stackAfterExecution) {
      frame.localVariables.filter(e => e.isVisible && e.value instanceof HeapVizReferenceVal && e.isExpanded).forEach(e => dotString += e.edges())

      if (frame.this != undefined && frame.this.isExpanded)
        dotString += frame.this.edges()
    }
    return dotString
  }
  private getStaticsEdges () {

    let dotString = ''
    for (const lClass of this.loadedClassesAfterExecution.filter(e => e.isVisible && e.showFieldDetails)) {
      lClass.staticFields.filter(e => e.isVisible && e.value instanceof HeapVizReferenceVal && e.isExpanded).forEach(e => dotString += e.edges())
    }
    return dotString;
  }
}
