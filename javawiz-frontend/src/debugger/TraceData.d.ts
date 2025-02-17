import { InputBufferInfo, ProcessedTraceState, StackFrame, TraceState } from '@/dto/TraceState'
import { Arrow, Box, LifeLine } from '@/components/TheSequenceDiagram/types'
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
  lifeLines: LifeLine[],
  timeIdx: number,
  boxes: Box[],
  arrows: Arrow[],
  timeIdxStateIdxMap: Map<number, number>,
  visitedLines: number[]
}
