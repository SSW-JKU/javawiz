export type FrontendToExtensionMessage = HighlightLine | HoverLine | GetFileContents | ConsoleEnabled | ChangeConsoleHistory | Notification | CompileError

interface HighlightLine {
	readonly kind: 'highlightLine'
	readonly line: number
	readonly uri: string
}

interface HoverLine {
	readonly kind: 'hoverLine'
	readonly line: number
	readonly uri: string
}

interface GetFileContents {
	readonly kind: 'getFileContents'
}

interface ConsoleEnabled {
	readonly kind: 'consoleEnabled'
	readonly consoleEnabled: boolean
}

interface ChangeConsoleHistory {
	readonly kind: 'changeConsoleHistory'
	readonly newConsoleHistory: ConsoleLine[]
}

interface Notification {
	readonly kind: 'notification'
	readonly type: 'error' | 'warning' | 'information'
	readonly message: string
}

interface CompileError {
	readonly kind: 'compileError'
	readonly message: string
}

export interface ConsoleLine {
	readonly output: string
	readonly input: string
	readonly error: string
}

export type ExtensionToFrontendMessage = ConsoleInput

interface ConsoleInput {
	readonly kind: 'consoleInput'
	readonly consoleInput: string
}





export type ExtensionResponseData = EmptyResponseData | GetFileContentsResponseData

export interface Response {
	readonly message: FrontendToExtensionMessage | ExtensionToFrontendMessage
	readonly result: 'SUCCESS' | 'ERROR' | 'FAIL'
	readonly data?: ExtensionResponseData // on SUCCESS
	readonly error?: string // on ERROR or FAIL
}

export type EmptyResponseData = Record<string, never>

export interface GetFileContentsResponseData {
	readonly fileContents: {
		localUri: string,
		content: string
	}[]
	readonly internalClassPatterns: string[] | undefined
	readonly openEditorLocalUri: string | undefined
}