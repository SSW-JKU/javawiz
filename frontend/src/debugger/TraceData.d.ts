import { InputBufferInfo, ProcessedTraceState, StackFrame, MarbleDiagramDataCollection, TraceState } from '@/dto/TraceState'
import { ConsoleLine } from '@Shared/Protocol'
import { DeskTestLine } from '@/components/TheDeskTest/types'
import { OverlayVar } from '@/components/TheFlowChart/types'

type TraceData = {
  consoleLines: ConsoleLine[],
  processedTraceState: ProcessedTraceState | undefined,
  stateIndex: number,
  inputBufferInfo: InputBufferInfo,
  deskTestLines: DeskTestLine[],
  firstTraceState: TraceState,
  flowChartOverlayLocals: OverlayVar[],
  flowChartOverlayStatics: OverlayVar[],
  stackFrames: StackFrame[],
  streamVisualizationData: MarbleDiagramDataCollection
}
