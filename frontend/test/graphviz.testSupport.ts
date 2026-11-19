import { Graphviz } from '@hpcc-js/wasm/graphviz'

// The Memory View renders its graphs with Graphviz compiled to WebAssembly (@hpcc-js/wasm, installed
// with d3-graphviz), so it runs on any machine without a Graphviz installation. The tests render with
// the same library and version, instead of a `dot` command that may be missing or differ per machine.
const graphviz = await Graphviz.load()

/** The result of {@link runDot}, shaped like the result of running the `dot` command. */
export interface DotResult {
  /** 0 when Graphviz accepted the graph, 1 when it reported an error. */
  status: number
  /** The rendered graph, or '' after an error. */
  stdout: string
  /** Graphviz's error message, or '' on success. */
  stderr: string
}

/**
 * Lays out and renders a DOT graph like `dot -T<format>`, for example
 * `runDot('digraph { a -> b }', 'svg').stdout` starts with an SVG document.
 */
export function runDot (dot: string, format: 'svg' | 'json'): DotResult {
  try {
    return { status: 0, stdout: graphviz.dot(dot, format), stderr: '' }
  } catch (error) {
    return { status: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) }
  }
}
