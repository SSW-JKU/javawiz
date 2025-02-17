import * as vscode from 'vscode'
// from '@Shared/Shared' is not working - it compiles, but the files are later not found in the running extension
import { ConsoleLine } from '../../shared/src/Protocol'
import { Communication } from './Communication'
import { Extension } from './extension'



// pseudoterminal console based on
// https://github.com/ShMcK/vscode-pseudoterminal/blob/master/src/extension.ts
// and https://github.com/microsoft/vscode-extension-samples/blob/main/extension-terminal-sample/src/extension.ts

const CSI = '\x1b[' //Control Sequence Initiator
const ENABLE_INSERT_MODE = CSI + '4h' // see https://www.xfree86.org/current/ctlseqs.html

const KEYS = {
  ENTER: '\r',
  BACKSPACE: '\x7f',
  ENDOFTEXT: '\x03', //ctrl + c
  ENTF: CSI + '3~'
}

const ACTIONS = {
  DELETE_CHAR: CSI + 'P',
  CLEAR: CSI + '2J' + CSI + '3J' + CSI + ';H',
  NEWLINE: '\n\r',
  //CURSOR_SLOW_BLINK: CSI + '12h', //CSI + '5m',
  //CURSOR_NO_BLINK: CSI + '25m',
  RESET_SGR: CSI + '0m'
}

const CURSOR = {
  UP: CSI + 'A',
  DOWN: CSI + 'B',
  FORWARD: CSI + 'C',
  BACKWARD: CSI + 'D',
  HOME: CSI + 'H', //pos1
  ACK: CSI + 'F' //End
}

const COLOR = {
  CYAN: CSI + '36m',
  //BLACK: CSI + '30m',
  GREEN: CSI + '32m',
  RED: CSI + '31m'
}

const WELCOME_MSG = `${COLOR.CYAN}Javawiz I/O Terminal${ACTIONS.RESET_SGR}${ACTIONS.NEWLINE}${ENABLE_INSERT_MODE}`

export class Console {
  private static terminal: vscode.Terminal;
  private static writingEnabled = false;
  private static writeEmitter: vscode.EventEmitter<string>;
  private static existsTerminal = false;

  private static inputLine: string; // the part of the current line that was supplied by the user
  private static cursorIndex: number; // index of the cursor within the inputLine

  private static compileError = false;

  private static inputBuffer: InputBuffer;

  public static initialize() {
    Console.compileError = false // clear compile error flag from potential previous run
    if (Console.existsTerminal) {
      return
    }
    Console.existsTerminal = true


    Console.inputLine = ''
    Console.cursorIndex = 0
    Console.inputBuffer = new InputBuffer()

    Console.writeEmitter = new vscode.EventEmitter<string>()
    const pty: vscode.Pseudoterminal = {
      onDidWrite: Console.writeEmitter.event,
      open: () => {
        Console.write(WELCOME_MSG)
      },
      close: () => {
        Console.existsTerminal = false
        Extension.endDebug()
      },
      handleInput: input => {
        if (!Console.writingEnabled) {
          return
        }
        switch (input) {
          case KEYS.ENTER:
            Communication.sendConsoleInput(Console.inputLine)
            Console.write(ACTIONS.NEWLINE)
            Console.inputBuffer.append(Console.inputLine)
            Console.inputLine = ''
            Console.cursorIndex = 0
            break
          case KEYS.BACKSPACE:
            if (Console.cursorIndex > 0) {
              Console.inputLine = Console.inputLine.substring(0, Console.cursorIndex - 1) + Console.inputLine.substring(Console.cursorIndex)
              Console.cursorIndex--
              Console.write(CURSOR.BACKWARD)
              Console.write(ACTIONS.DELETE_CHAR)
            }
            break
          case KEYS.ENTF:
            Console.inputLine = Console.inputLine.substring(0, Console.cursorIndex) + Console.inputLine.substring(Console.cursorIndex + 1)
            Console.write(ACTIONS.DELETE_CHAR)
            break
          case CURSOR.UP:
            Console.substituteInputLine(Console.inputBuffer.getUp())
            break
          case CURSOR.DOWN:
            Console.substituteInputLine(Console.inputBuffer.getDown())
            break
          case CURSOR.FORWARD:
            if (Console.cursorIndex < Console.inputLine.length) {
              Console.write(CURSOR.FORWARD)
              Console.cursorIndex++
            }
            break
          case CURSOR.BACKWARD:
            if (Console.cursorIndex > 0) {
              Console.write(CURSOR.BACKWARD)
              Console.cursorIndex--
            }
            break
          case CURSOR.HOME:
            Console.moveCursorToInputStart()
            break
          case CURSOR.ACK:
            Console.moveCursorToInputEnd()
            break
          default:
            if (input.length !== 1) {
              return
            }
            Console.write(input)
            Console.inputLine = Console.inputLine.substring(0, Console.cursorIndex) + input + Console.inputLine.substring(Console.cursorIndex)
            Console.cursorIndex++
            break
        }
      }
    }
    Console.terminal = vscode.window.createTerminal({
      name: 'Javawiz I/O terminal',
      pty: pty
    })
  }

  public static closeIfNoCompileError() {
    if(!this.compileError) {
      Console.terminal?.dispose()
      Console.writeEmitter?.dispose()
      Console.existsTerminal = false
    }
  }

  public static setWritingEnabled(enabled: boolean) {
    if (!Console.writingEnabled && enabled) {
      Console.terminal.show()
      //TODO: check if there is a way to make the cursor blink
    }
    Console.writingEnabled = enabled
  }

  public static showCompileError(error: string) {
    Console.compileError = true
    Console.write(ACTIONS.CLEAR)
    Console.write(COLOR.RED)
    Console.write(error)
  }

  public static changeConsoleHistory(newHistory: ConsoleLine[]) {
    Console.write(ACTIONS.CLEAR)
    Console.inputBuffer = new InputBuffer()
    Console.inputLine = ''
    Console.cursorIndex = 0

    Console.write(WELCOME_MSG)

    newHistory.forEach(line => {
      Console.write(ACTIONS.RESET_SGR + Console.replaceNewLines(line.output))
      Console.write(COLOR.RED + Console.replaceNewLines(line.error))
      Console.write(COLOR.GREEN + Console.replaceNewLines(line.input) + ACTIONS.RESET_SGR)


      if (!line.input.match(/([^\n]+\n)?/g)) {
        console.error('input doesn\'t have the expected shape.')
        return
      }
      if (line.input.length > 0) {
        Console.inputBuffer.append(line.input.replace(/\n/g, ''))
      }

    })

    Console.write(COLOR.GREEN) //for user input
  }

  public static show() {
    Console.terminal.show(true)
  }

  private static write(text: string) { //if an external write() command writes control character sequences, the cursorIndex might lose its meaning
    Console.writeEmitter.fire(text) //we can't use terminal.sendText() as this would be handled like user input
  }

  private static moveCursorToInputStart() {
    const steps = Console.cursorIndex
    if (steps !== 0) { //going 0 steps would have the same effect as going one step in control sequences for some reason
      Console.write(`${CSI}${Console.cursorIndex}D`)
    }
    Console.cursorIndex = 0
  }

  private static moveCursorToInputEnd() {
    const steps = Console.inputLine.length - Console.cursorIndex
    if (steps !== 0) {
      Console.write(`${CSI}${steps}C`)
    }

    Console.cursorIndex = Console.inputLine.length
  }

  private static eraseInput() {
    Console.moveCursorToInputStart()
    Console.write(`${CSI}K`)
    Console.inputLine = ''
  }

  private static substituteInputLine(newInput: string) {
    Console.eraseInput()
    Console.write(newInput)
    Console.inputLine = newInput
    Console.cursorIndex = Console.inputLine.length
  }

  private static replaceNewLines(text: string): string {
    return text.replace(/\n/g, ACTIONS.NEWLINE)
  }
}

class InputBuffer {
  buffer: string[];
  index: number; //index may go from 0 up to buffer.length; buffer.length signals that we are at the lower end

  constructor() {
    this.buffer = []
    this.index = 1
  }

  append(line: string) {
    this.buffer.push(line)
    this.index = this.buffer.length
  }

  getUp(): string {
    if (this.index > 0) {
      this.index--
    }
    return this.buffer[this.index] || ''
  }

  getDown(): string {
    if (this.index < this.buffer.length) { //this is not an off by one error
      this.index++
    }
    return this.buffer[this.index] || ''
  }
}
