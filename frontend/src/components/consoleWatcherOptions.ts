import type { WatchOptions } from 'vue'

// Scrolling must observe the output nodes produced by the same reactive update.
export const CONSOLE_TEXT_WATCH_OPTIONS = { flush: 'post' } satisfies WatchOptions
