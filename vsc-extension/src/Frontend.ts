import {Extension, listenAsync} from './extension'
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as http_server from 'http-server'
import * as http from 'http'
import Shared from '../../shared/src/Shared'

const FRONTEND_PATH_SEGMENTS = ['out', 'assets', 'frontend']

export class Frontend {
  private static running = false
  private static server: http.Server

  static async start(extensionPath: vscode.Uri, port: number) {
    if (Frontend.running) {
      return
    }
    Frontend.running = true;

    const frontendPath = vscode.Uri.joinPath(extensionPath, ...FRONTEND_PATH_SEGMENTS).fsPath

    if (!fs.existsSync(frontendPath)) {
      throw new Error(`Frontend not found under the file name ${frontendPath}`)
    }
    // http-server --proxy http://localhost:8080?
    Frontend.server = http_server.createServer({
      root: frontendPath,
      proxy: `http://localhost:${port}?`, // necessary because we provide the port through routing
      logFn: (_req, _res, err) => {
        if (err) {
          Shared.logDebug(`Frontend error: ${err.message}`)
          Extension.endDebug();
        }
      }
    }) as http.Server

    /*Frontend.server.listen(port, () => { 
          DEBUG_CONSOLE?.log(`Frontend server running at port ${port}`) 
          Frontend.server.on('close', () => Extension.endDebug())
        })
        DEBUG_CONSOLE?.log('listening comprehension')
        */
    await listenAsync(Frontend.server, port)
    // console.log(`Websocket server for frontend hosting listening on port ${port}`)
    Shared.logDebug(`Websocket server for frontend hosting listening on port ${port}`)
    // TODO: react to server closing
  }

  static end() {
    // console.log('Frontend.end called')
    Frontend.server?.close() // ignored error callback
    Frontend.running = false
  }
}
