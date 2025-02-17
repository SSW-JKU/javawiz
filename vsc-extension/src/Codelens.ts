import * as vscode from 'vscode'
// from '@Shared/Shared' is not working - it compiles, but the files are later not found in the running extension
import Shared from '../../shared/src/Shared'

const RUN_COMMAND: vscode.Command = {
  arguments: [],
  command: 'javawiz.start',
  title: 'Run in JavaWiz'
}

export const codeLensProvider = {
  async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
    const mainMethods = await resolveMainMethods(document.uri) //maybe use regex instead
    return mainMethods.map(
      method => new vscode.CodeLens(method.range, RUN_COMMAND)
    )
  }
}

interface IMainClassOption { //taken from the Microsoft java debugger extension
  readonly mainClass: string;
  readonly projectName?: string;
  readonly filePath?: string;
}

interface IMainMethod extends IMainClassOption {
  range: vscode.Range;
}

async function resolveMainMethods(uri: vscode.Uri): Promise<IMainMethod[]> {
  return <Promise<IMainMethod[]>>vscode.commands.executeCommand(
    'java.execute.workspaceCommand', //java.execute.workspaceCommand is a command contributed by the java redhat extension
    'vscode.java.resolveMainMethod',
    uri.toString())
  /*
  depends on redhat.java and microsoft java debugger extension to work
  take a walk starting at https://github.com/microsoft/vscode-java-debug/blob/6a56a5a9daf9978491f4895e1644ab05c1601092/src/debugCodeLensProvider.ts
  to see why/how this chain of commands works. 
  */
}

function _hasDiagnosticErrors(uri: vscode.Uri) { //deprecated, since we decided to not check for program validity in the Code Lens Provider
  /* 
  This is a bit of a wierd way of checking program validity 
  since Diagnostics are supposed to only convey information to end users, not other extensions. 
  I don't know if the java language server lets us ask whether a program compiles
  (We might do it the hacky way and call javac from the extension, though this may be a versioning nightmare)
  (We might not do this at all)

  Problem: getDiagnostics sometimes returns an outdated value after file changes; how do we await the updates?
  Problem: 'static void main(String wrongParameterType)' doesn't cause any diagnostic problems
  Problem: having a file without a main class won't cause problems
  Problem: we have no way of knowing which extension created the diagnostics; 
    if the user has an extension installed which has unnecessarily many Error diagnostics, this might be an issue
  */
  return vscode.languages
    .getDiagnostics(uri)
    .some((diagnostic: any) => {
      return diagnostic.severity === vscode.DiagnosticSeverity.Error
        && diagnostic.source === 'Java'
    })
}

async function _doesCompile(): Promise<boolean> {  //deprecated, since we decided to not check for program validity in the Code Lens Provider
  //This might be the proper way to check for file validity; still has some 0.5s latency though
  //Problem: only properly works inside workspaces (the ms java debugger extension can't solve this either)
  Shared.logDebug('trying to compile')
  const fullCompile = false
  return vscode.commands.executeCommand('java.workspace.compile', fullCompile).then(
    (result: any) => { Shared.logDebug(result); return <number>result === 1 },
    (rejectReason: any) => { Shared.logDebug(rejectReason); return false })
}