import * as child_process from 'child_process'
import {Extension} from './extension'
import * as vscode from 'vscode'
import * as fs from 'fs'
import Shared from '../../shared/src/Shared'
import * as kill from 'tree-kill'

const ASSETS_PATH_SEGMENTS = ['out', 'assets', 'backend', 'libs']
const WEBSOCKET_DEBUGGER = 'backend-1.7.3.jar'

export class Debugger {
  private static running = false
  private static process: child_process.ChildProcess
  private static timeout: NodeJS.Timeout


  static async start(extensionPath: vscode.Uri, port: number) {
    if (Debugger.running) {
      return
    }
    Debugger.running = true

    const debuggerPath = vscode.Uri.joinPath(extensionPath, ...ASSETS_PATH_SEGMENTS, WEBSOCKET_DEBUGGER).fsPath


    if (!fs.existsSync(debuggerPath)) {
      throw new Error(`Debugger backend not found under the file name ${debuggerPath}`)
    }

    let workspacePath;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath
    }

    Debugger.process = child_process.spawn(
      'java',
      [
        '--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED',
        '--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED',
        '--add-exports', 'jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED',
        '-jar', debuggerPath, port.toString()],
      {
        /* 
        the working directory is inherited to the debuggee process,
        which enables local file operations by the debuggee within the workspace
        */
        cwd: workspacePath
      }
    )
    Debugger.process.stderr?.on('data', (data) => {
      Shared.logDebug(`Websocket Debugger error: ${data}`)
      if (Debugger.running) {
        vscode.window.showErrorMessage('JavaWiz failed.\n' +
                    'Maybe your JDK / PATH environment variable was not correctly set up.\n' +
                    'Please contact the developers and provide following error message:\n' +
                    data)
        Extension.endDebug()
      }
    }) 
    /*
    Debugger.process.on('close', (_code, _signal) => {
      console.log('debugger closed')
      console.log({code: _code, signal: _signal})
      if (Debugger.running) {
        vscode.window.showErrorMessage('JavaWiz Debugger closed unexpectedly. ')
        Debugger.running = false
        Extension.endDebug()
      }
    })
      */
    await new Promise((resolve, reject) => {
      Debugger.timeout = setTimeout(() => reject('could not launch debugger within 15 seconds'), 15000)
      Debugger.process.stdout!.on('data', (data) => {
        Shared.logDebug(`${data}`)
        if(`${data}`.includes('confirming_start')) {
          clearTimeout(Debugger.timeout)
          resolve(undefined)
        }
      })
      // TODO: reject on other startup failures as well rather than calling enddebug
    })
  }

  static async end(): Promise<void> {
    clearTimeout(Debugger.timeout)
    if(Debugger.running) {
      Debugger.running = false
      Debugger.process.stderr?.removeAllListeners('data') // suppress shutdown errors
      await new Promise((resolve, reject) => {
        kill(Debugger.process.pid, e => { // risk: process typically exits after this callback is executed
          if(e) {
            reject(e)
          }
          resolve(undefined)
        })
      })
    }
  }
}