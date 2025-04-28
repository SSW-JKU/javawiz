interface AstItem {
  begin: number
  end: number
  uuid: string
}

export interface MethodCallExpr extends AstItem {
  deltaBegin: number,
  length: number,
  name: string,
  candidates: string[] // uuids of possible methods
}

export interface Statement extends AstItem {
  readonly kind: 'Statement'
  code: string,
  methodCallExpressions: MethodCallExpr[]
  endOfStatementList: boolean,
  type: 'OTHER' | 'RETURN' | 'BREAK' | 'CONTINUE' | 'THROW' | 'YIELD'
}

export interface Block extends AstItem {
  readonly kind: 'Block',
  statements: AstElement[]
}

export interface Method extends AstItem {
  readonly kind: 'Method'
  name: string
  signature: string
  body: Block
  className: string,
  nargs: number
}

export type Conditional = AstItem & {
  condition: string
  beginCondition: number
  endCondition: number
  trueCase: Block,
  methodCallExpressions: MethodCallExpr[]
} & ({
  readonly kind: 'Conditional'
  type: 'IF' | 'WHILE' | 'FOR' | 'DO_WHILE'
} | {
  readonly kind: 'IfStatement'
  falseCase: Block | null | undefined
  type: 'IF'
})

export type IfStatement = Conditional & {
  readonly kind: 'IfStatement',
  falseCase: Block | null | undefined
  type: 'IF'
}

export interface SwitchEntry extends AstItem {
  readonly kind: 'SwitchEntry'
  block: Block
  labels: string[],
  isDefault: boolean
}
export interface Switch extends AstItem {
  readonly kind: 'Switch'
  entries: SwitchEntry[]
  selector: string
  defaultEntry?: SwitchEntry
}

export interface Class extends AstItem {
  readonly kind: 'Class'
  name: string
  methods: Method[]
  // initializations: Method
}

export interface CatchClause extends AstItem {
  readonly kind: 'CatchClause',
  parameter: string,
  beginParameter: number,
  endParameter: number
  body: Block
}

export interface TryCatchFinally extends AstItem {
  readonly kind: 'TryCatchFinally',
  tryBlock: Block,
  catchClauses: CatchClause[],
  finallyBlock?: Block
}

export interface AstFile extends AstItem {
  readonly kind: 'AstFile',
  classes: Class[]
}

export type AstElement = Block | Method | Class | Conditional | IfStatement | Statement | Switch | SwitchEntry | TryCatchFinally | CatchClause | AstFile

export type AbstractSyntaxTree = {
  file: AstFile
  localFileUri: string
}
