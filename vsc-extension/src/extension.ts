import * as vscode from 'vscode'
import { Communication } from './Communication'
import { Editors } from './Editors'
import { codeLensProvider } from './Codelens'
import { Debugger } from './Debugger'
import { Frontend } from './Frontend'
import { Webview } from './Webview'
import { Console } from './Console'
import * as portfinder from 'portfinder'
import * as http from 'http'
import * as path from 'path'
import shared from '../../shared/src/Shared'
import * as child_process from 'child_process'

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({language: 'java'}, codeLensProvider),
    vscode.commands.registerCommand('javawiz.start', () => Extension.startDebug(context)),
    vscode.commands.registerCommand('javawiz.enableJavaFeatures', () => toggleJavaFeatures(true)),
    vscode.commands.registerCommand('javawiz.disableJavaFeatures', () => toggleJavaFeatures(false)),
    vscode.commands.registerCommand('javawiz.createIn', (...args: any[]) => createAdditionalClass('In', context, args)),
    vscode.commands.registerCommand('javawiz.createOut',  (...args: any[]) => createAdditionalClass('Out', context, args))
  )
  checkJavaVersion()
}

export function deactivate() {
  Extension.endDebug()
}

export class Extension {
  static editors : Editors;
  static state: 'notrunning' | 'startup' | 'running' | 'shutdown' = 'notrunning'

  static textDocuments: vscode.TextDocument[] = []
  static openTextDocumentLocalUri: string | undefined = undefined // try to run currently open editor as main by default

  static async startDebug(context : vscode.ExtensionContext) {
    await Extension.endDebug()
    if(Extension.state !== 'notrunning') {
      return
    }
    Extension.state = 'startup'

    Extension.editors = new Editors()

    try {
      if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'java') {
        Extension.openTextDocumentLocalUri = vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri)
      }
      const activeEditor = vscode.window.activeTextEditor
      if(!activeEditor) {
        throw Error('Cannot launch JavaWiz if no active text editor is selected')
      }
      Console.initialize()
      Console.show()

      const nPorts = 3
      const ports = await getPortsAsync(nPorts);
      const frontendPort = ports[0]
      const communicationPort = ports[1]
      const debuggerPort = ports[2]
      shared.logDebug(`frontend port: ${frontendPort}, communication port: ${communicationPort}, debugger port: ${debuggerPort}`)
      await Communication.start(communicationPort)
      await Debugger.start(context.extensionUri, debuggerPort) // risk: port might no longer be free
      await Frontend.start(context.extensionUri, frontendPort) // risk: port might no longer be free
      const name = path.basename(activeEditor.document.uri.fsPath)
      Webview.activate(name, frontendPort, communicationPort, debuggerPort)
      Extension.state = 'running'
    } catch (e : any) { // some of these initialization operations might fail; in that case, we want to clean up everything else we did
      vscode.window.showErrorMessage(`Could not start javawiz due to an internal error: ${e}`)
      shared.logDebug(e)
      Extension.state = 'running' // ensure endDebug() is executed
      await this.endDebug()
    }
  }

  static async endDebug(focusOn?: vscode.TextDocument) {
    if(Extension.state !== 'running') {
      /*
      endDebug() is usually called multiple times by various event listeners in the components.
      the reason for this is that several events (like killing the debug terminal; closing the webview etc.) should trigger endDebug
      endDebug, on the other hand, ends up triggering some of those events.
      */
      return
    }
    Extension.state = 'shutdown'
    let retries = 2
    while(retries > 0) {
      try {
        await Debugger.end()
        break
      } catch(e) {
        shared.logDebug('killing the debugger caused an error: ')
        shared.logDebug(`${e}`)
        --retries
      }
    }
    try {
      Frontend.end()
      Extension.editors.dispose()
      Webview.close()
      Console.closeIfNoCompileError()
      Communication.end()
      if(focusOn) {
        vscode.window.showTextDocument(focusOn, undefined, false)
      }
    } finally {
      Extension.state = 'notrunning'
    }
  }
}

function getPortsAsync(nPorts : number) : Promise<number[]> {
  return new Promise((resolve, reject) => {
    const options = { port: 43210 }; // { startPort: 43210 }
    portfinder.getPorts(nPorts, options, (err, ports) => {
      if(err) {
        reject(err)
        shared.logDebug(err.toString())
      } else {
        resolve(ports)
      }
    })
  })
}

/*
 listen on the specified port and return a promise
 this makes it possible to await the moment when the server starts listening
 e.g. we don't want to open a webview before the frontend server is running
 */
export async function listenAsync(server : http.Server, port : number) : Promise<void> {
  return new Promise((resolve, _reject) => {
    shared.logDebug(`listening on port ${port}`)
    server.listen(port, resolve)
  })
}


export async function getAllFilesWithContents(): Promise<{
  localUri: string,
  content: string
}[]> {
  const files = await vscode.workspace.findFiles('**/*.java')
  return Promise.all(files.map(async uri => {
    const textDocument = await vscode.workspace.openTextDocument(uri)
    let localUri
    if(vscode.workspace.getWorkspaceFolder(uri)) {
      localUri = vscode.workspace.asRelativePath(textDocument.uri)
    } else {
      localUri = path.parse(textDocument.fileName).base
    }
    console.log('sending document: ')
    console.log(uri.fsPath)
    return {
      localUri,
      content: textDocument.getText() 
    }
  }))
}

/*
if set to true, overrides the javawiz defaults by changing the workspace folder settings
if set to false, changes the workspace folder settings back to the (JavaWiz-overwritten) default value
*/
async function toggleJavaFeatures(enable: boolean) {
  const CONFIG_ORIGINAL: {[key: string]: any} = {
    '[java]': {'editor.suggest.showClasses': false,
      'editor.suggest.showMethods': false,
      'editor.suggest.showConstructors': false,
      'editor.suggest.showConstants': false,
      'editor.suggest.showEnumMembers': false,
      'editor.suggest.showEnums': false,
      'editor.suggest.showEvents': false,
      'editor.suggest.showFields': false,
      'editor.suggest.showInterfaces': false,
      'editor.suggest.showKeywords': false,
      'editor.suggest.showVariables': false,
      'editor.suggest.showSnippets': false,
      'editor.suggest.showWords': false,
      'editor.lightbulb.enabled': false,
      'editor.quickSuggestions': {
        'other': 'off'
      },
    },
    // this is paradoxically not a language-specific setting, so we need to treat it seperately when overwriting config
    'java.inlayHints.parameterNames.enabled': 'none'
  }

  if(!enable) {
    const choice = await vscode.window.showWarningMessage('Running this command will change your vscode settings', 'Ok', 'Cancel');
    if(choice == undefined || choice == 'Cancel') {
      return
    }
  }

  
  const config = vscode.workspace.getConfiguration()
  for(const name in CONFIG_ORIGINAL)  {
    if(name === '[java]') { // set language-specific config for language-specific settings
      const javaConfig = vscode.workspace.getConfiguration('', { languageId: 'java' })
      const javaConfigOriginal = CONFIG_ORIGINAL[name]
      for(const javaConfigName in javaConfigOriginal) {
        const value = enable ? 
          undefined // restores default
          : javaConfigOriginal[javaConfigName] // set to our changes

        await javaConfig.update(
          javaConfigName, 
          value, 
          vscode.ConfigurationTarget.Global,
          true
        )
      }
    } else { // non language-specific settings
      const value = enable ? undefined : CONFIG_ORIGINAL[name]
      await config.update(
        name, 
        value, 
        vscode.ConfigurationTarget.Global,
        true
      )
    }
  }
}

const LOWEST_SUPPORTED = 17

function checkJavaVersion() {
  child_process.exec('javac -version', (err, out) => {
    if(err) {
      vscode.window.showWarningMessage(`Error executing "javac -version": ${err}`)
    }
    const version = parseInt(out.substring(6), 10)
    if(Number.isNaN(version) || !version) {
      if(process.env.PATH?.toLowerCase().includes('jdk')) {
        vscode.window.showWarningMessage('Could not verify correct version of javac.')
      } else {
        vscode.window.showWarningMessage('Could not find jdk on path.')
      }
      return
    }
    if(version < LOWEST_SUPPORTED) {
      vscode.window.showWarningMessage(`JavaWiz requires java ${LOWEST_SUPPORTED} or higher. "javac -version" returns major version ${version}. You may find that it works fine, or you may not.`)
    }
  })

  child_process.exec('java -version', (error, _stdout, stderr) => {
    if(error) {
      vscode.window.showWarningMessage(`error executing "java -version": ${error}`)
    }
    const match = stderr.match(/version "(.*?)"/)
    const version = parseInt(match ? match[1] : '0', 10)
    if(!version) {
      vscode.window.showWarningMessage('Could not determine java version.')
      return
    }
    if(version < LOWEST_SUPPORTED) {
      vscode.window.showWarningMessage(`"javac -version" returns major version ${version}. You may find that it works fine, or you may not.`)
    }
  })
}


function createAdditionalClass(name: 'In' | 'Out', context: vscode.ExtensionContext, ...args: any[]) {
  let uri = vscode.workspace.workspaceFolders![0].uri
  if('scheme' in args[0][0]) {
    uri = args[0][0]
  }
  const filename = name + '.java'
  const ressourcesUri = vscode.Uri.joinPath(context.extensionUri, 'out', 'assets', 'backend', 'resources', 'main', 'additionalclasses', filename)
  vscode.workspace.fs.copy(ressourcesUri, vscode.Uri.joinPath(uri, filename))
}