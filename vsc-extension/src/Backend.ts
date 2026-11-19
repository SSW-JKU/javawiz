import * as child_process from 'child_process'
import {Extension} from './extension'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as os from 'os'
import Shared from '../../shared/src/Shared'
import kill from 'tree-kill'
import { checkJavaRuntime, javaExecutable, JavaRuntimeCompatibilityError } from './JavaRuntime'

const ASSETS_PATH_SEGMENTS = ['out', 'assets', 'backend', 'libs']
const BACKEND_JAR = 'backend-2.4.3.jar'

export class Backend {
  private static running = false
  private static process: child_process.ChildProcess
  private static timeout: NodeJS.Timeout


  static async start(extensionPath: vscode.Uri, port: number): Promise<void> {
    if (Backend.running) {
      return
    }

    const backendPath = vscode.Uri.joinPath(extensionPath, ...ASSETS_PATH_SEGMENTS, BACKEND_JAR).fsPath


    if (!fs.existsSync(backendPath)) {
      throw new Error(`Backend not found under the file name ${backendPath}`)
    }

    // Check the same java and javac used by the backend before creating a partial session.
    const javaHome = configuredJavaHome()
    const javaRuntime = await checkJavaRuntime(javaHome)
    if (!javaRuntime.ok) {
      throw new JavaRuntimeCompatibilityError(javaRuntime.message)
    }

    let workspacePath;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath
    }

    Backend.running = true
    Backend.process = child_process.spawn(
      javaExecutable('java', javaHome),
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
    Backend.process.stdout?.on('data', (data) => {
      Shared.logDebug(`Backend output: ${data}`)
    })
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
      Backend.process.stdout?.on('data', (data) => {
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
      const pid = Backend.process.pid
      if (pid === undefined) {
        throw new Error('Cannot stop backend process because no process id is available')
      }
      await new Promise((resolve, reject) => {
        kill(pid, (e?: Error) => { // risk: process typically exits after this callback is executed
          if(e) {
            reject(e)
          }
          resolve(undefined)
        })
      })
    }
  }
}

/**
 * Returns the JDK folder from the VS Code setting `java.jdt.ls.java.home`, or `undefined` if it is not set.
 *
 * The Red Hat Java extension, which JavaWiz requires, runs on the JDK in this setting. Using the same
 * JDK means that a user who configured Java for VS Code does not have to set up PATH as well.
 * Like the Red Hat Java extension, a leading `~` stands for the user's home folder.
 * The setting is read on every start, so a changed value applies to the next JavaWiz session.
 */
function configuredJavaHome(): string | undefined {
  const javaHome = vscode.workspace.getConfiguration('java').get<string>('jdt.ls.java.home')?.trim()
  if (!javaHome) {
    return undefined
  }
  return javaHome.startsWith('~') ? os.homedir() + javaHome.slice(1) : javaHome
}
