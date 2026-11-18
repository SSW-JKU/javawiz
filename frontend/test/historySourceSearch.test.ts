import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addSourceLineMatches,
  buildFilteredHistoryStates,
  createHistoryLookup,
  createSourceLineLookup,
  findHighlightedHistoryEntries,
  parseDslFilter
} from '../src/components/TheHistoryView/historyFiltering.ts'
import type { FilteredHistoryState } from '../src/components/TheHistoryView/historyFiltering.ts'
import type { DebuggerProtocol } from '../src/dto/DebuggerProtocol.d.ts'
import type { LocalVar, ProcessedTraceState, StackFrame, Val } from '../src/dto/TraceState.d.ts'

// Source lines from the JW-504 issue. The indentation checks that rows show trimmed text.
const EXAMPLE_SOURCE = [
  '    int total = a + b;',
  '    y = someMeth(concreteArgName);',
  '    values[i] = left + right;',
  '    // call sort after validation',
  '    worker.sort();'
].join('\n')

const EXAMPLE_SOURCES: DebuggerProtocol.ClassContent[] = [
  { localUri: 'Example.java', content: EXAMPLE_SOURCE }
]

const primitive = (value: string): Val => ({
  kind: 'PrimitiveVal',
  primitiveValue: value,
  title: value,
  vizValue: value
})

const local = (name: string, value: string): LocalVar => ({
  kind: 'Var',
  name,
  type: 'int',
  value: primitive(value),
  changed: true,
  class: 'Example',
  method: 'run'
})

function frame (method = 'run', localVariables: LocalVar[] = []): StackFrame {
  return {
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method,
    signature: '()V',
    displaySignature: `${method}()`,
    localVariables,
    conditionValues: [],
    arrayAccessValues: [],
    internal: false,
    displayText: `${method}()`
  }
}

function executedLine (
  stateIndex: number,
  line: number,
  options: { localUri?: string, stackBefore?: StackFrame[], stackAfter?: StackFrame[] } = {}
): ProcessedTraceState {
  const stackAfter = options.stackAfter ?? [frame()]
  return {
    kind: 'ProcessedTraceState',
    stateIndex,
    localUri: options.localUri ?? 'Example.java',
    line,
    heapBeforeExecution: [],
    stackBeforeExecution: options.stackBefore ?? stackAfter,
    loadedClassesBeforeExecution: [],
    heapAfterExecution: [],
    stackAfterExecution: stackAfter,
    loadedClassesAfterExecution: []
  }
}

/** Trace with one executed state per example line; line 5 calls `sort`. */
function exampleTrace (): ProcessedTraceState[] {
  return [
    executedLine(0, 1),
    executedLine(1, 2),
    executedLine(2, 3),
    executedLine(3, 4),
    executedLine(4, 5, { stackBefore: [frame()], stackAfter: [frame('sort'), frame()] })
  ]
}

interface SearchResult {
  states: FilteredHistoryState[]
  highlighted: FilteredHistoryState['entries']
}

/**
 * Runs a query the way the History View does: build the regular rows, add
 * source rows for a source query, then collect the highlighted rows in display order.
 */
function search (
  query: string,
  trace: ProcessedTraceState[],
  sources: DebuggerProtocol.ClassContent[] = EXAMPLE_SOURCES,
  isShownMethod: (className: string, methodSignature: string) => boolean = () => true
): SearchResult {
  const filter = parseDslFilter(query)
  const baseStates = buildFilteredHistoryStates({
    trace,
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod,
    formatter: {
      formatValue: value => value.kind === 'PrimitiveVal' ? value.vizValue : 'other',
      formatCall: traceIndex => `call at ${traceIndex}`
    },
    lookup: createHistoryLookup()
  })
  const states = filter?.kind === 'source'
    ? addSourceLineMatches(trace, baseStates, filter.text, createSourceLineLookup(sources), isShownMethod)
    : baseStates
  const highlightedSet = findHighlightedHistoryEntries(states, filter)
  const highlighted = states.flatMap(state => state.entries).filter(entry => highlightedSet.has(entry))
  return { states, highlighted }
}

/** Lines of the states whose rows are highlighted, in display order. */
function matchedLines (result: SearchResult): number[] {
  return result.states
    .filter(state => state.entries.some(entry => result.highlighted.includes(entry)))
    .map(state => state.state.line)
}

test('parses quoted and unrecognized queries as source-text searches', () => {
  const source = (text: string) => ({ kind: 'source', text, isActive: true })

  assert.deepEqual(parseDslFilter('a + b'), source('a + b'))
  assert.deepEqual(parseDslFilter('   a + b   '), source('a + b'))
  assert.deepEqual(parseDslFilter('"a + b"'), source('a + b'))
  assert.deepEqual(parseDslFilter('"a +  b"'), source('a +  b'))
  assert.deepEqual(parseDslFilter('" a + b "'), source(' a + b '))
  assert.deepEqual(parseDslFilter('"y = someMeth(concreteArgName)"'), source('y = someMeth(concreteArgName)'))
  assert.deepEqual(parseDslFilter('"y = 7"'), source('y = 7'))
  assert.deepEqual(parseDslFilter('"call sort"'), source('call sort'))
  assert.deepEqual(parseDslFilter('"a + b'), source('"a + b'))
  assert.deepEqual(parseDslFilter('counter ='), source('counter ='))
})

test('keeps structured filters for unquoted assignment and call queries', () => {
  assert.deepEqual(parseDslFilter('y = 7'), {
    kind: 'assignment',
    target: 'y',
    targetValue: '7',
    isActive: true
  })
  assert.deepEqual(parseDslFilter('call sort'), {
    kind: 'call',
    methodName: 'sort',
    isActive: true
  })
})

test('treats empty quotes as an inactive filter and blank queries as no filter', () => {
  assert.deepEqual(parseDslFilter('""'), { kind: 'inactive', isActive: false })
  assert.deepEqual(parseDslFilter('  ""  '), { kind: 'inactive', isActive: false })
  assert.equal(parseDslFilter('   '), null)
})

test('matches source lines literally and case-sensitively, as in the issue table', () => {
  const trace = exampleTrace()
  const expectations: Array<[string, number[]]> = [
    ['a + b', [1]],
    ['"a + b"', [1]],
    ['A + B', []],
    ['left + right', [3]],
    ['"y = someMeth(concreteArgName)"', [2]],
    ['"someMeth(concreteArgName)"', [2]],
    ['"values[i]"', [3]],
    ['"call sort"', [4]],
    ['"worker.sort()"', [5]],
    ['"a +  b"', []],
    ['"a + b;\\ny"', []]
  ]

  for (const [query, lines] of expectations) {
    assert.deepEqual(matchedLines(search(query, trace)), lines, query)
  }
})

test('shows the trimmed source line in a dedicated source row', () => {
  const result = search('"values[i]"', exampleTrace())

  assert.equal(result.highlighted.length, 1)
  assert.deepEqual(result.highlighted[0], {
    key: 'state:2:source',
    icon: 'source-line',
    text: 'values[i] = left + right;',
    match: { kind: 'source', sourceText: '    values[i] = left + right;' },
    isCall: false,
    extraIndent: 0
  })
})

test('uses the call filter for an unquoted call query instead of searching the comment line', () => {
  const result = search('call sort', exampleTrace())

  assert.deepEqual(result.highlighted.map(entry => entry.icon), ['call'])
  assert.deepEqual(matchedLines(result), [5])
  assert.equal(result.states.flatMap(state => state.entries).some(entry => entry.icon === 'source-line'), false)
})

test('finds lines by file and line number in multi-file programs', () => {
  const sources = [
    { localUri: 'A.java', content: 'class A {\n  int x = 1;\n}' },
    { localUri: 'B.java', content: 'class B {\n  int y = 2;\n}' }
  ]
  const trace = [
    executedLine(0, 2, { localUri: 'A.java' }),
    executedLine(1, 2, { localUri: 'B.java' })
  ]

  const onlyB = search('int y', trace, sources)
  assert.deepEqual(onlyB.highlighted.map(entry => entry.text), ['int y = 2;'])
  assert.equal(onlyB.states[0].state.localUri, 'B.java')

  const both = search('int', trace, sources)
  assert.deepEqual(both.highlighted.map(entry => entry.text), ['int x = 1;', 'int y = 2;'])
})

test('matches every execution of a repeated line in chronological order', () => {
  const trace = Array.from({ length: 10 }, (_, index) => executedLine(index, 1))

  const result = search('a + b', trace)

  assert.equal(result.highlighted.length, 10)
  assert.deepEqual(result.states.map(state => state.traceIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.deepEqual(result.highlighted.map(entry => entry.key), trace.map(state => `state:${state.stateIndex}:source`))
})

test('gives each matching state exactly one navigation stop, even with several other rows', () => {
  const trace = [executedLine(0, 3, { stackAfter: [frame('run', [local('left', '1'), local('right', '2')])] })]

  const result = search('left + right', trace)

  assert.deepEqual(result.states[0].entries.map(entry => entry.text), [
    'values[i] = left + right;',
    'left = 1',
    'right = 2'
  ])
  assert.deepEqual(result.highlighted, [result.states[0].entries[0]])
})

test('adds a group for a matching state without rows at its chronological position', () => {
  const trace = [
    executedLine(0, 1, { stackAfter: [frame('run', [local('total', '3')])] }),
    executedLine(1, 2),
    executedLine(2, 3, { stackAfter: [frame('run', [local('left', '1')])] })
  ]

  const result = search('someMeth', trace)

  assert.deepEqual(result.states.map(state => state.traceIndex), [0, 1, 2])
  assert.deepEqual(result.states.map(state => state.entries.map(entry => entry.text)), [
    ['total = 3'],
    ['y = someMeth(concreteArgName);'],
    ['left = 1']
  ])
  assert.deepEqual(result.highlighted, [result.states[1].entries[0]])
})

test('hides source matches inside methods hidden with Shown Methods', () => {
  const trace = [
    executedLine(0, 1, { stackAfter: [frame('hidden')] }),
    executedLine(1, 1)
  ]
  const isShownMethod = (_className: string, methodSignature: string) => methodSignature !== 'hidden()'

  const result = search('a + b', trace, EXAMPLE_SOURCES, isShownMethod)

  assert.deepEqual(result.highlighted.map(entry => entry.key), ['state:1:source'])
})

test('ignores missing files and out-of-range lines without failing', () => {
  const trace = [
    executedLine(0, 1, { localUri: 'Unknown.java' }),
    executedLine(1, 0),
    executedLine(2, 99)
  ]

  assert.deepEqual(search('a', trace).states, [])
  const withoutSources = search('a', exampleTrace(), [])
  assert.deepEqual(withoutSources.highlighted, [])
  assert.deepEqual(withoutSources.states.flatMap(state => state.entries).map(entry => entry.icon), ['call'])

  const getSourceLine = createSourceLineLookup(EXAMPLE_SOURCES)
  assert.equal(getSourceLine('Unknown.java', 1), undefined)
  assert.equal(getSourceLine('Example.java', 0), undefined)
  assert.equal(getSourceLine('Example.java', -1), undefined)
  assert.equal(getSourceLine('Example.java', 6), undefined)
  assert.equal(getSourceLine('Example.java', 5), '    worker.sort();')
})

test('maps CRLF, LF, and CR files to the same one-based lines', () => {
  const getSourceLine = createSourceLineLookup([
    { localUri: 'Lf.java', content: 'first\nsecond\nthird' },
    { localUri: 'Crlf.java', content: 'first\r\nsecond\r\nthird' },
    { localUri: 'Cr.java', content: 'first\rsecond\rthird' }
  ])

  for (const localUri of ['Lf.java', 'Crlf.java', 'Cr.java']) {
    assert.equal(getSourceLine(localUri, 2), 'second', localUri)
    assert.equal(getSourceLine(localUri, 3), 'third', localUri)
  }
})
