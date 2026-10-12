import type { MarbleDiagramData } from '@/dto/TraceState'

/** Selects the newest top-level stream while leaving nested streams available to future views. */
export function latestTopLevelStream (streams: readonly MarbleDiagramData[]): MarbleDiagramData | undefined {
  return streams
    .filter(stream => stream.parentStreamId === null)
    .at(-1)
}
