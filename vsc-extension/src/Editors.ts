import * as vscode from 'vscode'
import * as path from 'path'
import { Extension } from './extension'

const DEBUG_LINE_BACKGROUND_COLOR = 'rgba(114, 167, 178, 0.3)' 
const HOVER_LINE_BACKGROUND_COLOR = 'rgba(246, 216, 167, 0.3)'

export class Editors implements vscode.Disposable {

  private subscriptions : vscode.Disposable[] = []

  private debugLineDecoration: vscode.TextEditorDecorationType
  private hoverLineDecoration: vscode.TextEditorDecorationType

  private warned: boolean

  private highlightedLine = -1
  private hoveredLine = -1
  private highlightedLocalUri : string | undefined
  private hoveredLocalUri : string | undefined
  private lastHighlightedEditor : vscode.TextEditor | undefined
  private lastHoveredEditor : vscode.TextEditor | undefined

  constructor() {
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'java') {
          Extension.endDebug(e.document)
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations()),
      this.debugLineDecoration = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: DEBUG_LINE_BACKGROUND_COLOR
      }),
      this.hoverLineDecoration = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: HOVER_LINE_BACKGROUND_COLOR
      })
    )
    this.warned = false
  }

  public async highlightLine(line: number, localUri: string) {
    this.highlightedLine = line - 1
    this.highlightedLocalUri = localUri
    await this.updateDebugLine(true) // TODO MW: change focus flag to toggle whether highlighted line should be focused or not
  }

  public async hoverLine(line: number, localUri: string) {
    this.hoveredLine = line - 1;
    this.hoveredLocalUri = localUri;
    await this.updateHoveredLine();
  }

  private async updateDebugLine(focus : boolean) {
    this.lastHighlightedEditor?.setDecorations(this.debugLineDecoration, [])

    if(this.highlightedLine < 0) {
      return
    }

    const pos = new vscode.Position(this.highlightedLine, this.highlightedLine)
    const range = new vscode.Range(pos, pos)

    
    if(vscode.window.activeTextEditor && vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri) === this.highlightedLocalUri) {
      this.lastHighlightedEditor = vscode.window.activeTextEditor
      this.lastHighlightedEditor.setDecorations(this.debugLineDecoration, [range])
      if(focus) {
        this.lastHighlightedEditor.revealRange(range)
      }
      return
    }

    
    this.lastHighlightedEditor = vscode.window.visibleTextEditors.find(ed => vscode.workspace.asRelativePath(ed.document.uri) === this.highlightedLocalUri)
    if(this.lastHighlightedEditor) {
      this.lastHighlightedEditor.setDecorations(this.debugLineDecoration, [range])     
      if(focus) {
        this.lastHighlightedEditor.revealRange(range)
      }
      return
    }
    

    if(focus) {
      let uri = (await vscode.workspace.findFiles(`${this.highlightedLocalUri}`, undefined, 1))?.pop()
      if(!uri) { // start searching for files with the same name; this happens when the file is not in a workspace and the local uri is just the base path
        uri = vscode.workspace.textDocuments.find(doc => doc.uri.path.endsWith(this.highlightedLocalUri!))?.uri
      }
      if(!uri) {
        if(!this.warned) {
          vscode.window.showWarningMessage(`Could not find text document: ${this.highlightedLocalUri}`)
          this.warned = false
        }
        return
      }
      // const result = await vscode.commands.executeCommand('vscode.open', uri, { background: true }) // TODO MW: use this command if you want to open java files without taking focus
      this.lastHighlightedEditor = await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.One, preserveFocus: true })
      this.lastHighlightedEditor.setDecorations(this.debugLineDecoration, [range])
      this.lastHighlightedEditor.revealRange(range)
    }
  }

  private async updateHoveredLine() {
    this.lastHoveredEditor?.setDecorations(this.hoverLineDecoration, [])

    if(this.hoveredLine < 0) {
      return
    }

    const pos = new vscode.Position(this.hoveredLine, this.hoveredLine)
    const range = new vscode.Range(pos, pos)

    // we only show hovered lines if the corresponding editor is active
    this.lastHoveredEditor = vscode.window.visibleTextEditors.find(ed => vscode.workspace.asRelativePath(ed.document.uri) === this.hoveredLocalUri)
    if(!this.lastHoveredEditor) {
      this.lastHoveredEditor = vscode.window.visibleTextEditors.find(ed => path.parse(ed.document.fileName).base === this.hoveredLocalUri)
    }
    if(this.lastHoveredEditor) {
      this.lastHoveredEditor.setDecorations(this.hoverLineDecoration, [range])
      this.lastHoveredEditor.revealRange(range)
    }
  }

  private async updateDecorations() {
    this.updateDebugLine(false);
    this.updateHoveredLine();
  }

  public dispose() {
    this.subscriptions.forEach(s => s.dispose())
  }
}