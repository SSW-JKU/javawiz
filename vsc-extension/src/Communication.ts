import * as ws from 'websocket'
import * as _ from 'lodash'
import * as http from 'http';
// from '@Shared/Shared' is not working - it compiles, but the files are later not found in the running extension
import * as protocol from '../../shared/src/Protocol'
import { Console } from './Console'
import { Extension, getAllFilesWithContents, listenAsync } from './extension';
import * as vscode from 'vscode'
import Shared from '../../shared/src/Shared'

export class Communication {
  private static websocketServer: ws.server
  private static javawizConnection: ws.connection

  private static httpServer: http.Server

  private static running = false

  public static async start(port: number) { // server listen is awaited
    if (Communication.running) {
      return //don't start a new server if we already have one
    }
    Communication.running = true

    Communication.httpServer = http.createServer()
    await listenAsync(Communication.httpServer, port)
    Communication.websocketServer = new ws.server({
      httpServer: Communication.httpServer,
      autoAcceptConnections: true
    })
    Communication.websocketServer.on('connect', connection => {
      Communication.javawizConnection = connection
      Shared.logDebug('Connected to Frontend Server')
      Communication.javawizConnection.on('message', async msg => {
        const data = JSON.parse((msg as ws.IUtf8Message).utf8Data!)
        if (data.kind) { // check that message wasn't a Response
          const response = await Communication.receive(data as protocol.FrontendToExtensionMessage)
          Communication.respond(response)
        }
      })
      // TODO?: handle connection close
    })
    Communication.httpServer.on('close', () => {
      const _noawait = Extension.endDebug()
    })
  }

  public static end() {
    Communication.websocketServer?.shutDown()
    Communication.httpServer?.close(e => {
      if(e) {
        Shared.logDebug('shutting down websocket server for frontend communication caused an error: ')
        Shared.logDebug(`${e}`)
      }
    })
    Communication.running = false
  }

  public static sendConsoleInput(input: string) {
    Communication.send({ kind: 'consoleInput', consoleInput: input })
  }

  private static send(message: protocol.ExtensionToFrontendMessage): Promise<protocol.Response> { // TODO: handle error responses
    Shared.logDebug('Message Sent: ' + JSON.stringify(message))
    Communication.javawizConnection.send(JSON.stringify(message))
    return new Promise(resolve => {
      function handle(msg: ws.Message) {
        const data = JSON.parse((msg as ws.IUtf8Message).utf8Data!)

        if (data.message && _.isEqual(data.message, message)) {
          Communication.javawizConnection.removeListener('message', handle)
          resolve(data as protocol.Response)
        }
      }
      Communication.javawizConnection.addListener('message', handle)
    })
  }

  private static respond(response: protocol.Response | undefined) {
    Shared.logDebug('Response Sent: ' + JSON.stringify(response))
    Communication.javawizConnection.send(JSON.stringify(response))
  }

  private static async receive(message: protocol.FrontendToExtensionMessage): Promise<protocol.Response | undefined> {
    Shared.logDebug('Message received: ' + JSON.stringify(message))
    const defaultResponse: protocol.Response = { message, result: 'SUCCESS' }
    switch (message.kind) {
      case 'highlightLine': {
        await Extension.editors.highlightLine(message.line, message.uri)
        return defaultResponse
      }
        
      case 'hoverLine':
        Extension.editors.hoverLine(message.line, message.uri)
        return defaultResponse
      case 'getFileContents': {
        const internalClassPatterns = vscode.workspace.getConfiguration().get<string[]>('javawiz.hideClassPatterns')
        return {
          message: message, 
          result: 'SUCCESS', 
          data: { 
            fileContents: await getAllFilesWithContents(),
            internalClassPatterns,
            openEditorLocalUri: Extension.openTextDocumentLocalUri
          } 
        }
      }
      case 'consoleEnabled':
        Console.setWritingEnabled(message.consoleEnabled)
        return defaultResponse
      case 'changeConsoleHistory':
        Console.changeConsoleHistory(message.newConsoleHistory)
        return defaultResponse
      case 'notification':
        if(Extension.state !== 'shutdown') { // suppress disconnected error during shutdown
          showInformationMessage(message.type, message.message)
        }
        return defaultResponse
      case 'compileError':
        Console.showCompileError(message.message)
        Extension.endDebug()
        return defaultResponse
    }
  }
}

function showInformationMessage(type: 'information' | 'warning' | 'error', message: string) {
  switch (type) {
    case 'information':
      vscode.window.showInformationMessage(message)
      break
    case 'warning':
      vscode.window.showWarningMessage(message)
      break
    case 'error':
      vscode.window.showErrorMessage(message)
  }
}