type ConnectionFailed = {
  readonly kind: 'ConnectionFailed',
  readonly port: number
}

type ConnectionSuccess = {
  readonly kind: 'ConnectionSuccess'
}

type Connecting = {
  readonly kind: 'Connecting'
}

type ConnectionClosed = {
  readonly kind: 'ConnectionClosed'
}

type CompileSuccess = {
  readonly kind: 'CompileSuccess'
}

type InputExpected = {
  readonly kind: 'InputExpected'
}

type RuntimeError = {
  readonly kind: 'RuntimeError'
  readonly reason: string
}

type Compiling = {
  readonly kind: 'Compiling'
}

type LocalStorageLoadingError = {
  readonly kind: 'LocalStorageLoadingError'
}

type ExampleLoadingError = {
  readonly kind: 'ExampleLoadingError'
}

type InvalidFileType = {
  readonly kind: 'InvalidFileType'
}

type InvalidFileName = {
  readonly kind: 'InvalidFileName'
}

type FileReadError = {
  readonly kind: 'FileReadError'
}

type FeatureWarning = {
  readonly kind: 'FeatureWarning'
  readonly warnings: string[]
}

type VisualizationExported = {
  readonly kind: 'VisualizationExported'
  readonly fileName: string
}

// Notification is already defined, that's why 'NotificationType' is used
type NotificationType = ConnectionFailed
| Connecting
| ConnectionSuccess
| ConnectionClosed
| CompileSuccess
| InputExpected
| RuntimeError
| Compiling
| LocalStorageLoadingError
| ExampleLoadingError
| InvalidFileType
| InvalidFileName
| FileReadError
| FeatureWarning
| VisualizationExported

export type Notification = {
  readonly type: 'info' | 'success' | 'warning' | 'error'
  readonly message: string
  readonly id: number
  readonly groups: string[]
}
