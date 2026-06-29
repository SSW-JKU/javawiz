import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'

export type FileData = {
  readonly uri: monaco.Uri,
  prevViewState: monaco.editor.ICodeEditorViewState | null
}
