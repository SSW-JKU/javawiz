import { HoverInfo } from '@/hover/types'

export type HoverTarget = {
  hoverInfos: HoverInfo[]
}

export interface DeskTestArrayVal {
  readonly isNull?: boolean
  readonly string?: string
  readonly primitive?: string
  readonly type?: string // element type for object arrays
  readonly title?: string
}

export interface DeskTestConditionVal {
  readonly primitive?: string
}

export interface DeskTestVal {
  title?: string
  isNull?: boolean // true if value is null, false or undefined otherwise
  string?: string
  array?: DeskTestArrayVal[] | 'empty'
  reference?: number
  binary?: string[] | null
  char?: string
  primitive?: string
  error?: string
}

export type DeskTestStatic = {
  readonly class: string
  readonly name: string
  readonly type: string
} & HoverTarget

export type DeskTestCondition = {
  readonly expression: string
  readonly id: number
  readonly class: string
} & HoverTarget

export type DeskTestVar = {
  readonly name: string
  readonly method: string
  readonly class: string
  readonly type: string
} & HoverTarget

export type DeskTestMethod = {
  readonly displayText: string
  readonly class: string
  readonly vars: DeskTestVar[]
  readonly conditions: DeskTestCondition[]
} & HoverTarget

export type DeskTestLineMethod = {
  readonly name: string
  readonly class: string
  readonly vars: Map<string, DeskTestVal> // keys: DeskTestVars
  readonly conditions: Map<string, DeskTestConditionVal> // keys: DeskTestCondition
}

export type DeskTestLine = {
  readonly line: number
  readonly localUri: string
  readonly stateIndex: number
  readonly currentVars: Map<string, DeskTestVal> // keys: JSON.stringify(<DeskTestVar>)
  readonly currentConditions: Map<string, DeskTestConditionVal> // keys: JSON.stringify(<DeskTestCondition>)
  readonly currentStatics: Map<string, DeskTestVal> // keys: JSON.stringify(<DeskTestStatic>)
  readonly methods: DeskTestMethod[]
  readonly statics: DeskTestStatic[]
} & HoverTarget
