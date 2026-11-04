import type { MarbleDiagramData, MarbleDiagramMarble } from '@/dto/TraceState'

/** Selects the newest top-level stream while leaving nested streams available to future views. */
export function latestTopLevelStream (streams: readonly MarbleDiagramData[]): MarbleDiagramData | undefined {
  return streams
    .filter(stream => stream.parentStreamId === null)
    .at(-1)
}

/**
 * Places tracks, such as the columns or lanes of a marble diagram, one after another. Each track is keyed by its
 * position from the backend, which only decides the order, and takes the space of its measured [sizes] entry.
 * Tracks are [gap] apart, and the first one starts at [firstStart].
 *
 * Example: sizes `{100: 60, 200: 140, 300: 60}`, first start 0, and gap 30 give starts `{100: 0, 200: 90, 300: 260}`.
 */
export function placeTracks (sizes: ReadonlyMap<number, number>, firstStart: number, gap: number): Map<number, number> {
  const starts = new Map<number, number>()
  let start = firstStart
  for (const key of [...sizes.keys()].sort((a, b) => a - b)) {
    starts.set(key, start)
    start += sizes.get(key)! + gap
  }
  return starts
}

/**
 * How a marble that shows a list or an array lays out its items: a result in the terminal lane (an `END` marble, for
 * example from `toList()` or `toArray()`) stacks them vertically, because that lane has room below it. A stream element
 * that is a list or an array, for example from `map(s -> s.split(" "))`, shows them in one horizontal row, so its lane
 * stays low. Lists and arrays look the same in both cases. Marbles without items return `null`.
 */
export function collectionDirection (marble: MarbleDiagramMarble): 'vertical' | 'horizontal' | null {
  if (!marble.items) return null
  return marble.eventKind === 'END' ? 'vertical' : 'horizontal'
}
