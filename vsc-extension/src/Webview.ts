import * as vscode from 'vscode'
import { Extension } from './extension'



export class Webview {
  private static subscriptions: vscode.Disposable[]
  private static active = false



  static activate(fileName: string, port: number, communicationPort: number, debuggerPort: number) {
    if (Webview.active) {
      return
    }
    Webview.active = true

    Webview.subscriptions = []

    const panel = vscode.window.createWebviewPanel(
      'javawiz',
      `JavaWiz Debugging Session - ${fileName}`,
      vscode.ViewColumn.Beside, // TODO MW: change this to vscode.ViewColumn.One to be in full screen
      {
        enableScripts: true,
        // TODO MW: uncomment the line below to prevent webview reload on move / hide
        // retainContextWhenHidden: true // Note: setting this flag is discouraged as an inactive tab shouldn't consume memory, but it is really convenient to prevent debugger restart on webview move
      }
    )
    Webview.subscriptions.push(panel)
    panel.webview.html = Webview.getHTMLiFrame(`http://localhost:${port}/extensionMode${communicationPort};${debuggerPort}`)
    Webview.subscriptions.push(
      panel.onDidDispose(() => Extension.endDebug())
    )
  }

  static close() {
    Webview.subscriptions?.forEach(resource => resource?.dispose())
    Webview.subscriptions = []
    Webview.active = false
  }

  //using iframes is an ugly way to show the web site in webview, but according to https://github.com/microsoft/vscode/issues/70339 this seems to be the only way to do it
  // maybe look at https://www.codemag.com/article/2107071
  private static getHTMLiFrame(url : string) : string {
    const dateMS = new Date().getTime()
    const name = `javawiz${dateMS}`
    
    return `<!DOCTYPE html>
  <html>
  <head>
  </head>
  <body>
  <!--
  The following will, once loaded, not be seen because the iframe is fullscreen.
  It is needed to prevent VSC from caching this page, at least it seems so.
  Currently it is "visible" (with an opaquness of 1%) for a short term, could be fixed in a future version.
  -->
  <p style="opacity: 0.01;">${dateMS}</p>
  <iframe src="${url}" name="${name}" id="${name}"
    style="
     position: fixed;
     top: 0px;
     right: 0px;
     width: 100%;
     height: 100%;
     border: none;
     margin: 0;
     padding: 0;
     overflow: hidden; 
    ">
  </iframe>
  </body>
  </html>`
  }
}