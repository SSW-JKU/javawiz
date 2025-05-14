import * as child_process from 'child_process'
import {Extension} from './extension'
import * as vscode from 'vscode'
import * as fs from 'fs'
import Shared from '../../shared/src/Shared'
import * as kill from 'tree-kill'

const ASSETS_PATH_SEGMENTS = ['out', 'assets', 'backend', 'libs']
const BACKEND_JAR = 'backend-1.7.6.jar'

export class Backend {
  private static running = false
  private static process: child_process.ChildProcess
  private static timeout: NodeJS.Timeout


  static async start(extensionPath: vscode.Uri, port: number) {
    if (Backend.running) {
      return
    }
    Backend.running = true

    const backendPath = vscode.Uri.joinPath(extensionPath, ...ASSETS_PATH_SEGMENTS, BACKEND_JAR).fsPath


    if (!fs.existsSync(backendPath)) {
      throw new Error(`Backend not found under the file name ${backendPath}`)
    }

    let workspacePath;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath
    }

    Backend.process = child_process.spawn(
      'java',
      [
        '--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED',
        '--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED',
        '--add-exports', 'jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED',
        '-jar', backendPath, port.toString()],
      {
        /* 
        the working directory is inherited to the debuggee process,
        which enables local file operations by the debuggee within the workspace
        */
        cwd: workspacePath
      }
    )
    Backend.process.stderr?.on('data', (data) => {
      Shared.logDebug(`Backend error: ${data}`)
      if (Backend.running) {
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
      Backend.timeout = setTimeout(() => reject('could not launch backend within 15 seconds'), 15000)
      Backend.process.stdout!.on('data', (data) => {
        Shared.logDebug(`${data}`)
        if(`${data}`.includes('confirming_start')) {
          clearTimeout(Backend.timeout)
          resolve(undefined)
        }
      })
      // TODO: reject on other startup failures as well rather than calling enddebug
    })
  }

  static async end(): Promise<void> {
    clearTimeout(Backend.timeout)
    if(Backend.running) {
      Backend.running = false
      Backend.process.stderr?.removeAllListeners('data') // suppress shutdown errors
      await new Promise((resolve, reject) => {
        kill(Backend.process.pid, e => { // risk: process typically exits after this callback is executed
          if(e) {
            reject(e)
          }
          resolve(undefined)
        })
      })
    }
  }
}