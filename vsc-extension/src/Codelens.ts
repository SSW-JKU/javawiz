import * as vscode from 'vscode'

const RUN_COMMAND: vscode.Command = {
  arguments: [],
  command: 'javawiz.start',
  title: 'Debug with JavaWiz'
}

export const codeLensProvider = {
  async provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
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
