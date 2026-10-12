import { AbstractSyntaxTree } from '@/dto/AbstractSyntaxTree'

type PetAnnotation = {
  action: string
  view?: string
  target?: string
  payload: string
  uri: string
  lineNr: number
}

export namespace DebuggerProtocol {

  export type ClassContent = {
    readonly localUri: string,
    readonly content: string
  }

  export type CompileRequest = {
    readonly task: 'COMPILE',
    readonly classContents: ClassContent[],
    readonly vscExtensionActive: boolean,
    readonly openEditorLocalUri?: string
    /** Patterns for classes excluded from stepping and instrumentation. If absent, the backend uses its built-in defaults. */
    readonly excludeFromSteppingPatterns: string[] | undefined
    /** Patterns for classes at which ordinary heap traversal stops. If absent, the backend uses its built-in defaults. */
    readonly heapTraversalStopPatterns: string[] | undefined
    /** Patterns for Java data structures whose fields are collected despite being heap-traversal stops. If absent, the backend uses its built-in defaults. */
    readonly dataStructurePatterns: string[] | undefined
  }

  export type StepIntoRequest = {
    readonly task: 'STEP_INTO'
  }

  export type StepOverRequest = {
    readonly task: 'STEP_OVER'
    readonly referenceStackDepth: number
  }

  export type InputRequest = {
    readonly task: 'INPUT'
    readonly text: string
  }

  export type RunToLineRequest = {
    readonly task: 'RUN_TO_LINE'
    readonly line: number
    readonly className: string
  }

  export type StepOutRequest = {
    readonly task: 'STEP_OUT'
    readonly referenceStackDepth: number
  }

  export type StepRequest = StepIntoRequest | StepOverRequest | RunToLineRequest | StepOutRequest

  export type Request = CompileRequest | InputRequest | StepRequest

  export type StepResult = {
    readonly traceStates: TraceState[],
    readonly isWaitingForInput: boolean,
    readonly vmrunning: boolean
  }

  export type CompileSendData = {
    readonly success: boolean
    readonly compileOutput: string,
    readonly asts: AbstractSyntaxTree[],
    readonly firstStepResult: StepResult,
    readonly compiledClasses: string[],
    readonly featureWarnings: string[],
    readonly pets: PetAnnotation[]
  }

  export type ErrorResponse = {
    readonly status: 'ERROR',
    readonly kind: 'ErrorResponse'
    readonly error: string,
    readonly request: Request
  }

  export type CompileSuccessResponse = {
    readonly status: 'SUCCESS',
    readonly kind: 'CompileSuccessResponse'
    readonly request: CompileRequest,
    readonly data: CompileSendData
  }

  export type CompileFailResponse = {
    readonly request: Compile,
    readonly kind: 'CompileFailResponse'
    readonly error: string,
    readonly status: 'FAIL'
  }

  export type StepResultResponse = {
    readonly request: StepRequest,
    readonly kind: 'StepResultResponse',
    readonly data: StepResult,
    readonly status: 'SUCCESS'
  }

  export type InputResponse = {
    readonly request: InputRequest,
    readonly kind: 'InputResponse',
    readonly data: StepResult | null,
    readonly status: 'SUCCESS'
  }

  export type Response = ErrorResponse | CompileSuccessResponse | CompileFailResponse | StepResultResponse | InputResponse
}
