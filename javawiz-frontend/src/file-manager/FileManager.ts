import { FileData } from '@/file-manager/FileData'
// Import Monaco editor (relies on MonacoWebpackPlugin in vue.config.js)
import { editor, Uri } from 'monaco-editor/esm/vs/editor/editor.api'
import { FileManagerEvent } from '@/file-manager/FileManagerEvent'
import { DebuggerProtocol } from '@/dto/DebuggerProtocol'
import Ajv from 'ajv'
import schema from '@/assets/configSchema.json'

const EXAMPLE_URL = 'examples'

export class FileManager {
  // map from file uri to  file data
  private readonly files: Map<string, FileData>
  // file uri of open file as string
  private _openFile: string | null
  private readonly listeners: ((type: FileManagerEvent) => any)[]

  private ajv: Ajv.Ajv

  constructor () {
    this.files = new Map()
    this._openFile = null
    this.listeners = []
    this.ajv = new Ajv()
  }

  public get openFile () {
    return this._openFile
  }

  public get openFileAsUriObject (): Uri | undefined {
    return this._openFile
      ? this.files.get(this._openFile)?.uri
      : undefined
  }

  public get previousViewState (): editor.ICodeEditorViewState | null {
    return this._openFile
      ? this.files.get(this._openFile)?.prevViewState ?? null
      : null
  }

  public get fileUris () {
    return this.files.keys()
  }

  public get fileContents () {
    const fileContentsMap = new Map<string, string>()
    this.files.forEach((fileData, fileUri) =>
      fileContentsMap.set(fileUri, getModel(fileData.uri)?.getValue() ?? '')
    )
    return fileContentsMap
  }

  public setFileContents (files: DebuggerProtocol.ClassContent[]) {
    for (const fileData of this.files.values()) {
      getModel(fileData.uri)?.dispose()
    }
    this.files.clear()

    for (const file of files) {
      this.addFile(file.localUri, file.content, file.localUri.endsWith('.java') ? 'java' : undefined)
    }

    this._openFile = files[0].localUri
  }

  public async openExample (dirName: string): Promise<boolean> {
    const response = await fetch(`${EXAMPLE_URL}/${dirName}/config.json`)
    if (!response.ok) {
      return false
    }

    const config = await response.json()
    const valid = this.ajv.validate(schema, config)
    if (!valid) {
      return false
    }

    const fileContents = [] as DebuggerProtocol.ClassContent[]
    for (const fileName of config.sources) {
      const fileResponse = await fetch(`${EXAMPLE_URL}/${dirName}/${fileName}`)
      if (!fileResponse.ok) {
        return false
      }

      const fileContent = await fileResponse.text()
      fileContents.push({ localUri: fileName, content: fileContent })
    }

    this.setFileContents(fileContents)
    return true
  }

  public addFile (fileUri: string, text?: string, language?: string, overwriteExisting: boolean = false) {
    if ((fileUri.endsWith('.java') || fileUri.endsWith('.txt'))) {
      if (this.files.has(fileUri)) {
        if (overwriteExisting && text !== undefined) {
          this.changeFile(fileUri, text)
        }
      } else {
        const model = createModel(text, language, fileUri)
        // update file contents and notify listeners on file content change
        model.onDidChangeContent(_ => {
          this.notifyListeners('CONTENT_CHANGED')
        })
        this.files.set(fileUri, { uri: model.uri, prevViewState: null })
        this._openFile = fileUri
        this.notifyListeners('FILE_ADDED')
      }
    }
  }

  public deleteFile (fileUri: string) {
    const uri = this.files.get(fileUri)?.uri
    if (this.files.size > 1 && uri && this.files.has(fileUri)) {
      getModel(uri)?.dispose()
      this.files.delete(fileUri)
      if (this._openFile === fileUri) {
        this._openFile = this.files.keys().next().value!!
      }
      this.notifyListeners('FILE_REMOVED')
    }
  }

  public changeToFile (fileUri: string, viewState?: editor.ICodeEditorViewState | null) {
    if (this._openFile !== fileUri && this.files.has(fileUri)) {
      const openFileData = this._openFile ? this.files.get(this._openFile) : undefined
      if (openFileData && viewState) {
        openFileData.prevViewState = viewState
      }
      this._openFile = fileUri
    }
  }

  public changeFile (fileUri: string, newContent: string) {
    if (this.files.has(fileUri)) {
      getModel(this.files.get(fileUri)!.uri)?.setValue(newContent)
    } else {
      const model = createModel(newContent, undefined, fileUri)
      this.files.set(fileUri, { uri: model.uri, prevViewState: null })
    }
    this._openFile = fileUri
  }

  public addListener (callback: (e: FileManagerEvent) => any) {
    this.listeners.push(callback)
  }

  private notifyListeners (type: FileManagerEvent) {
    for (const listener of this.listeners) {
      listener(type)
    }
  }
}

// do not watch this function reactively, Vue cannot handle it
export function getModel (uri?: Uri) {
  if (uri) {
    return editor.getModel(uri)
  }
  return null
}

function createModel (text: string | undefined, language: string | undefined, fileUri: string) {
  let model: editor.ITextModel
  if (!text && !language && fileUri.endsWith('.java')) {
    model = editor.createModel(
      `public class ${fileUri.slice(fileUri.lastIndexOf('/') + 1, fileUri.length - 5)} {\n  \n}`,
      'java'
    )
  } else {
    model = editor.createModel(text ?? '', language)
  }
  // set tab size to two for new tabs
  model.updateOptions({ tabSize: 2 })
  return model
}
