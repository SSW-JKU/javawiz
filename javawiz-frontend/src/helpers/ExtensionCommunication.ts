import _ from 'lodash'
import {
  ConsoleLine,
  ExtensionToFrontendMessage,
  FrontendToExtensionMessage,
  GetFileContentsResponseData,
  Response
} from '@Shared/Protocol'
import shared from '@Shared/Shared'
import { useGeneralStore } from '@/store/GeneralStore'

export class ExtensionCommunication {
  private static webSocket: WebSocket

  private static generalStore: ReturnType<typeof useGeneralStore>

  private static sendConsoleInputTextCallback: () => void

  public static active (): boolean {
    return this.webSocket && this.webSocket.readyState === this.webSocket.OPEN
  }

  public static sendNotification (type: 'information' | 'error' | 'warning', message: string) {
    ExtensionCommunication.send({ kind: 'notification', type, message })
  }

  public static sendCompileError (message: string) {
    ExtensionCommunication.send({ kind: 'compileError', message })
  }

  public static sendHighlightLine (line: number, uri: string): void {
    ExtensionCommunication.send({ kind: 'highlightLine', line, uri })
      .catch(_why => {
      }) // we don't currently do any error handling in this case
  }

  public static sendHoverLine (line: number, uri: string): void {
    ExtensionCommunication.send({ kind: 'hoverLine', line, uri })
      .catch(_why => {
      }) // we don't currently do any error handling in this case
  }

  public static async sendGetFileContents (): Promise<GetFileContentsResponseData> {
    const response = await this.send({ kind: 'getFileContents' })
    if (response.error) {
      // TODO react to error flag set by extension
    }
    console.log({ response })
    return (response.data as GetFileContentsResponseData)!
  }

  public static sendSetConsoleEnabled (enabled: boolean) {
    this.send({ kind: 'consoleEnabled', consoleEnabled: enabled })
      .catch(_why => {
      })
  }

  public static sendChangeConsoleHistory (newHistory: ConsoleLine[]) {
    this.send({ kind: 'changeConsoleHistory', newConsoleHistory: newHistory.filter(line => (line.input + line.output + line.error) !== '') })
      .catch(_why => {
      })
  }

  public static connectToExtension (sendInput: () => void, port: number): Promise<void> {
    ExtensionCommunication.sendConsoleInputTextCallback = sendInput
    ExtensionCommunication.webSocket = new WebSocket(`ws://localhost:${port}`)
    ExtensionCommunication.generalStore = useGeneralStore()
    if (shared.DEBUG) {
      ExtensionCommunication.webSocket.addEventListener('message', event => {
        shared.logDebug('Message Received: ' + JSON.stringify(JSON.parse(event.data)))
      })
    }

    ExtensionCommunication.webSocket.addEventListener('message', event => {
      const message = Object.freeze(JSON.parse(event.data))
      if (message.kind) { // make sure that incoming message is not a response
        const response = ExtensionCommunication.receive(message as ExtensionToFrontendMessage)
        ExtensionCommunication.respond(response)
      }
    })

    return new Promise((resolve) => {
      function handle () {
        ExtensionCommunication.webSocket.removeEventListener('open', handle)
        resolve()
      }

      ExtensionCommunication.webSocket.addEventListener('open', handle)
    })
  }

  private static send (message: FrontendToExtensionMessage): Promise<Response> {
    const unavailableError = new Error('No WebSocket available')
    const notConnectedError = new Error('Websocket connection not currently open')
    const connectionDiedError = new Error('Connection to websocket died while waiting for response')
    if (!ExtensionCommunication.webSocket) {
      return Promise.reject(unavailableError)
    }
    if (ExtensionCommunication.webSocket.readyState !== WebSocket.OPEN) {
      return Promise.reject(notConnectedError)
    }

    ExtensionCommunication.webSocket.send(JSON.stringify(message))
    shared.logDebug('Message sent: ' + JSON.stringify(message))

    return new Promise((resolve, reject) => {
      function handleClose () {
        reject(connectionDiedError)
      }

      function handle (event: MessageEvent<string>) {
        const data = JSON.parse(event.data)
        shared.logDebug(
          'Response Listener for message ' +
          JSON.stringify(message) +
          ' checking incoming response ' +
          JSON.stringify(data) +
          ' with message ' +
          JSON.stringify(data.message)
        )
        if (data.message && _.isEqual(data.message, message)) { // check if we got a response to the correct message
          if (ExtensionCommunication.webSocket) {
            ExtensionCommunication.webSocket.removeEventListener('message', handle) // remove the listeners since the Promise is resolved
            ExtensionCommunication.webSocket.removeEventListener('close', handleClose)
          }
          shared.logDebug('Listener accepted message.')
          resolve(data as Response)
        }
      }

      ExtensionCommunication.webSocket.addEventListener('close', handleClose)
      ExtensionCommunication.webSocket.addEventListener('message', handle)
    })
  }

  private static respond (response: Response) {
    if (ExtensionCommunication.webSocket) {
      shared.logDebug('Sending response to VSCode extension: ' + JSON.stringify(response))
      ExtensionCommunication.webSocket.send(JSON.stringify(response))
    }
  }

  private static receive (msg: ExtensionToFrontendMessage): Response {
    shared.logDebug('Processing message received from VSCode extension: ' + msg)
    const successResponse: Response = {
      message: msg,
      result: 'SUCCESS'
    }
    switch (msg.kind) {
      case 'consoleInput':
        ExtensionCommunication.generalStore.inputValue = msg.consoleInput
        ExtensionCommunication.sendConsoleInputTextCallback()
        return successResponse
    }
  }
}
