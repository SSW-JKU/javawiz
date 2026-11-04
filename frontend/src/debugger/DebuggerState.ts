export type DebuggerState = {
  name: string,
  connected: boolean,
  talking: boolean,
  compiling: boolean,
  compiled: boolean,
  running: boolean,
  inputExpected: boolean
}

export const INITIAL: DebuggerState = {
  name: 'INITIAL',
  connected: false,
  talking: false,
  compiling: false,
  compiled: false,
  running: false,
  inputExpected: false
}

export const CONNECTING: DebuggerState = {
  name: 'CONNECTING',
  connected: false,
  talking: true,
  compiling: false,
  compiled: false,
  running: false,
  inputExpected: false
}

export const CONNECTED: DebuggerState = {
  name: 'CONNECTED',
  connected: true,
  talking: false,
  compiling: false,
  compiled: false,
  running: false,
  inputExpected: false
}

export const COMPILING: DebuggerState = {
  name: 'COMPILING',
  connected: true,
  talking: true,
  compiling: true,
  compiled: false,
  running: false,
  inputExpected: false
}

export const RUNNING: DebuggerState = {
  name: 'RUNNING',
  connected: true,
  talking: false,
  compiling: false,
  compiled: true,
  running: true,
  inputExpected: false
}

export const DONE: DebuggerState = {
  name: 'DONE',
  connected: true,
  talking: false,
  compiling: false,
  compiled: true,
  running: false,
  inputExpected: false
}

export const WAITING: DebuggerState = {
  name: 'WAITING',
  connected: true,
  talking: true,
  compiling: false,
  compiled: true,
  running: true,
  inputExpected: false
}

export const INPUT_EXPECTED: DebuggerState = {
  name: 'INPUT_EXPECTED',
  connected: true,
  talking: false,
  compiling: false,
  compiled: true,
  running: true,
  inputExpected: true
}

/**
 * The program has sent nothing for a long time without reading input. It may still be running, or read input in a way
 * the backend cannot see. The console stays open for that case, and stepping again keeps waiting.
 */
export const UNRESPONSIVE: DebuggerState = {
  name: 'UNRESPONSIVE',
  connected: true,
  talking: false,
  compiling: false,
  compiled: true,
  running: true,
  inputExpected: true
}
