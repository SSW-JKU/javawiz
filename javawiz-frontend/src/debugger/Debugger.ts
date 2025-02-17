import { DebuggerProtocol } from '@/dto/DebuggerProtocol'
import { StackFrame, TraceState } from '@/dto/TraceState'
import { Trace } from '@/debugger/Trace'
import * as d3 from 'd3'
import { COMPILING, CONNECTED, DONE, DebuggerState, INITIAL, INPUT_EXPECTED, RUNNING, WAITING, CONNECTING } from './DebuggerState'
import { ExtensionCommunication } from '@/helpers/ExtensionCommunication'
import { TraceData } from './TraceData'
import { useGeneralStore } from '@/store/GeneralStore'
import { useHeapVizMetaStore } from '@/store/HeapVizMetaStore'
import { NotificationType } from '@/components/TheNotifications/types'
import { NotificationGroups } from '@/components/TheNotifications/Notifications'

export class Debugger {
  private websocket: WebSocket | null
  private port: number
  private compiledClasses: string[] | undefined
  private trace: Trace
  private undoStack: number[]
  private stateIndex: number
  private state: DebuggerState
  private compileErrorMessage: string | undefined
  private generalStore
  private heapVizMetaStore

  constructor () {
    this.websocket = null
    this.port = 50000
    this.state = INITIAL
    this.trace = new Trace()
    this.undoStack = []
    this.stateIndex = 0
    this.generalStore = useGeneralStore()
    this.heapVizMetaStore = useHeapVizMetaStore()
  }

  public shareInitialState () {
    this.handleDebugStateChange() // send initial debug state to extension
  }

  public setPort (port: number) {
    this.port = port
  }

  public getCompiledClasses (): string[] | undefined {
    return this.compiledClasses
  }

  public getCompileErrorMessage (): string | undefined {
    return this.compileErrorMessage
  }

  private clearNotifications (group: string) {
    this.generalStore.notifications.clear(group)
  }

  private showNotification (notification: NotificationType) {
    this.generalStore.notifications.show(notification)
  }

  public connect (): Promise<boolean> {
    const dbg = this
    return new Promise((resolve, reject) => {
      if (dbg.connected) {
        resolve(true)
        return
      }
      if (dbg.state === CONNECTING) {
        resolve(false)
        return
      }

      this.resetTrace()
      this.state = CONNECTING

      this.showNotification({ kind: 'Connecting' })
      this.websocket = new WebSocket(`ws://localhost:${this.port}`)

      this.websocket.onopen = (_e: Event) => {
        dbg.handleOpen()
        resolve(true)
      }
      this.websocket.onmessage = (e: MessageEvent<any>) => dbg.handleMessage(e)
      this.websocket.onerror = (e: Event) => {
        dbg.handleError(e)
        reject(e)
      }
      this.websocket.onclose = (e: CloseEvent) => dbg.handleClose(e)
    })
  }

  private handleOpen (): void {
    this.state = CONNECTED
    this.clearNotifications(NotificationGroups.debug)
    this.showNotification({ kind: 'ConnectionSuccess' })
  }

  private pushStateIndex (idx: number) {
    this.undoStack.push(this.stateIndex)
    this.stateIndex = idx
    this.handleDebugStateChange()
  }

  private popStateIndex () {
    this.stateIndex = this.undoStack.pop() ?? 0
    this.handleDebugStateChange()
  }

  private resetStack () {
    this.undoStack = []
    this.stateIndex = 0
    this.handleDebugStateChange()
  }

  private handleDebugStateChange () {
    if (this.generalStore.vscExtensionMode) {
      ExtensionCommunication.sendHighlightLine(this.latestTraceState?.line ?? -1, this.latestTraceState?.sourceFileUri ?? '')
      ExtensionCommunication.sendSetConsoleEnabled(this.inputExpected)
      ExtensionCommunication.sendChangeConsoleHistory(this.currentTraceData?.consoleLines ?? [])
    }
  }

  private handleClose (_event: CloseEvent): void {
    this.state = INITIAL
    this.websocket = null
    this.clearNotifications(NotificationGroups.connect)
    this.showNotification({ kind: 'ConnectionClosed' })
  }

  private handleError (_event: Event) {
    this.state = INITIAL
    this.websocket = null
    this.clearNotifications(NotificationGroups.connect)
    this.showNotification({ kind: 'ConnectionFailed', port: this.port })
  }

  private handleMessage (event: MessageEvent<any>): void {
    const response = Object.freeze(JSON.parse(event.data)) as DebuggerProtocol.Response
    switch (response.kind) {
      case 'CompileSuccessResponse': {
        this.resetTrace()
        const data = response.data
        const result = data.firstStepResult
        const states = result.traceStates
        if (result.vmrunning) {
          this.state = RUNNING
        } else {
          this.state = DONE
          this.trace.end(states)
        }
        this.showNotification({ kind: 'CompileSuccess' })
        if (data.featureWarnings.length > 0) {
          this.showNotification({ kind: 'FeatureWarning', warnings: data.featureWarnings })
        }
        this.generalStore.asts = data.asts
        this.compiledClasses = data.compiledClasses
        if (states && result.vmrunning) {
          this.trace.addTraceStates(states)
          this.handleDebugStateChange()
        }
        break
      }

      case 'CompileFailResponse': {
        this.resetTrace()
        this.compileErrorMessage = response.error
        if (this.generalStore.vscExtensionMode) {
          ExtensionCommunication.sendCompileError(response.error)
        }
        break
      }

      case 'StepResultResponse':
      case 'InputResponse': {
        const stepResult = response.data
        if (!stepResult) {
          break
        }
        const newStates = stepResult.traceStates
        if (!stepResult.vmrunning) {
          this.state = DONE
          this.trace.end(newStates)
          this.pushStateIndex(this.trace.traceLength - 1)
          break
        }
        if (stepResult.isWaitingForInput) {
          this.state = INPUT_EXPECTED
          this.showNotification({ kind: 'InputExpected' })
          this.handleDebugStateChange()
        } else {
          this.state = RUNNING
        }
        if (newStates && newStates.length > 0) {
          this.trace.addTraceStates(newStates)
          this.pushStateIndex(this.trace.traceLength - 1)
        }
        break
      }

      case 'ErrorResponse': {
        this.resetTrace()
        this.showNotification({ kind: 'RuntimeError', reason: response.error })
        break
      }
    }
  }

  public getUndoStack (): number[] {
    return this.undoStack
  }

  public get connected (): boolean {
    return this.state.connected
  }

  public get talking (): boolean {
    return this.state.talking
  }

  public get inputExpected (): boolean {
    return this.state.inputExpected
  }

  public get running (): boolean {
    return this.state.running
  }

  public get compiling (): boolean {
    return this.state.compiling
  }

  public get compiled (): boolean {
    return this.state.compiled
  }

  public startCompilation (classContents: DebuggerProtocol.ClassContent[], internalClassPatterns: string[] | undefined) {
    if (this.compiling) {
      return
    }
    this.state = COMPILING
    this.sendToDebugger({
      task: 'COMPILE',
      classContents,
      vscExtensionActive: this.generalStore.vscExtensionMode,
      openEditorLocalUri: this.generalStore.openEditorLocalUri,
      internalClassPatterns
    })
    this.showNotification({ kind: 'Compiling' })
  }

  public sendInput (inputValue: string) {
    if (this.inputExpected && inputValue !== '') {
      this.sendToDebugger({ task: 'INPUT', text: inputValue })
      this.generalStore.inputValue = ''
      this.state = RUNNING
    }
  }

  public stepBack () {
    if (!this.stepBackEnabled) {
      return
    }
    if (this.stateIndex !== 0) {
      this.popStateIndex()
    }
  }

  public stepInto () {
    if (!this.stepForwardEnabled) {
      return
    }
    this.step({ task: 'STEP_INTO' }, (_stateIdx: number) => false)
  }

  public stepOver () {
    if (!this.stepForwardEnabled) {
      return
    }
    const referenceStackDepth = this.latestTraceState?.stack?.length ?? 0
    this.step(
      {
        task: 'STEP_OVER',
        referenceStackDepth
      },
      (stateIdx: number) => {
        return (this.trace.getTraceState(stateIdx)?.stack.length ?? 0) > referenceStackDepth
      }
    )
  }

  public stepOut () {
    if (!this.stepForwardEnabled) {
      return
    }
    const referenceStackDepth = this.latestTraceState?.stack?.length ?? 0
    this.step(
      {
        task: 'STEP_OUT',
        referenceStackDepth
      },
      (stateIdx: number) => {
        return (this.trace.getTraceState(stateIdx)?.stack.length ?? 0) >= referenceStackDepth
      }
    )
  }

  public runToLine (line: number) {
    if (!this.stepForwardEnabled) {
      return
    }

    if (line >= 0) {
      this.step(
        {
          task: 'RUN_TO_LINE',
          line,
          className: this.latestTopStackFrame?.class ?? ''
        },
        (stateIdx: number) => (this.trace.getTraceState(stateIdx)?.line ?? -1) !== line
      )
    } else {
      d3.select('.run-to-arrow')
        .classed('jiggle', true)
        .on('animationend', function () {
          d3.select(this).classed('jiggle', false)
        })
    }
  }

  public resetTrace (): void {
    this.resetStack()
    this.trace = new Trace()
    this.state = CONNECTED
    this.compileErrorMessage = undefined

    this.generalStore.inputValue = ''
    this.heapVizMetaStore.reset()
    this.clearNotifications(NotificationGroups.debug)
  }

  get latestTraceState (): TraceState | undefined {
    return this.trace.getTraceState(this.stateIndex)
  }

  get stepBackEnabled (): boolean {
    return this.stateIndex > 0 && !this.talking
  }

  get stepForwardEnabled (): boolean {
    return !this.talking && !this.hasReachedEnd
  }

  get hasReachedEnd (): boolean {
    return !this.running && !this.isInReplayMode(this.stateIndex)
  }

  private isInReplayMode (index: number): boolean {
    if (!this.compiled) {
      return false
    }
    return index + 1 < this.trace.traceLength
  }

  public step (request: DebuggerProtocol.StepRequest, replayStepPredicate: any): void {
    let newStateIndex = this.stateIndex
    if (this.isInReplayMode(newStateIndex)) {
      do {
        newStateIndex++
      } while (this.isInReplayMode(newStateIndex) && replayStepPredicate(newStateIndex))

      if (!replayStepPredicate(newStateIndex)) {
        this.pushStateIndex(newStateIndex)
        return
      }
    }

    if (this.isInLiveMode(newStateIndex) && !this.talking) {
      this.sendToDebugger(request)
      this.state = WAITING
    }
  }

  private isInLiveMode (stateIdx: number): boolean {
    return stateIdx + 1 === this.trace.traceLength
  }

  get latestTopStackFrame (): StackFrame | undefined {
    return this.latestTraceState?.stack?.[0]
  }

  get currentTraceData (): TraceData | undefined {
    const previousStateIndex = this.undoStack.at(-1)
    return this.trace.getTraceData(this.stateIndex, previousStateIndex)
  }

  get isLive (): boolean {
    return this.isInLiveMode(this.stateIndex)
  }

  private sendToDebugger (message: DebuggerProtocol.Request) {
    const ws = this.websocket
    if (ws) {
      ws.send(JSON.stringify(message))
    }
  }
}
