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
  ERASE_TO_LINE_END: CSI + 'K',
  SAVE_CURSOR: CSI + 's',
  RESTORE_CURSOR: CSI + 'u',
  CURSOR_BLINK_ON: CSI + '?12h',
  CURSOR_BLINK_OFF: CSI + '?12l',
  CLEAR: CSI + '2J' + CSI + '3J' + CSI + ';H',
  NEWLINE: '\n\r',
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
  DIM: CSI + '2m',
  //BLACK: CSI + '30m',
  GREEN: CSI + '32m',
  RED: CSI + '31m'
}

const TERMINAL_NAME = 'Javawiz I/O terminal'
const INPUT_HINT = 'Type your input and press Enter'

const WELCOME_MSG = `${COLOR.CYAN}Javawiz I/O Terminal${ACTIONS.RESET_SGR}${ACTIONS.NEWLINE}${ENABLE_INSERT_MODE}`

export class Console {
  private static terminal: vscode.Terminal;
  private static writingEnabled = false;
  private static writeEmitter: vscode.EventEmitter<string>;
  private static changeNameEmitter: vscode.EventEmitter<string>;
  private static existsTerminal = false;

  private static inputLine: string; // the part of the current line that was supplied by the user
  private static cursorIndex: number; // index of the cursor within the inputLine

  private static compileError = false;

  // Number of characters (output, error output and input) in the console history last shown.
  // See changeConsoleHistory.
  private static shownTextLength = 0;

  // Whether the dim input hint is shown after the cursor; the first key the user presses erases it.
  private static hintShown = false;

  private static inputBuffer: InputBuffer;

  public static initialize(): void {
    Console.compileError = false // clear compile error flag from potential previous run
    Console.shownTextLength = 0 // a new session starts with an empty console
    if (Console.existsTerminal) {
      return
    }
    Console.existsTerminal = true


    Console.inputLine = ''
    Console.cursorIndex = 0
    Console.inputBuffer = new InputBuffer()

    Console.writeEmitter = new vscode.EventEmitter<string>()
    Console.changeNameEmitter = new vscode.EventEmitter<string>()
    const pty: vscode.Pseudoterminal = {
      onDidWrite: Console.writeEmitter.event,
      // Lets setWritingEnabled rename the terminal tab while the program waits for input.
      onDidChangeName: Console.changeNameEmitter.event,
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
        if (Console.hintShown) {
          Console.write(ACTIONS.ERASE_TO_LINE_END)
          Console.hintShown = false
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
        // After the user deleted everything they typed, show the hint again, like a placeholder.
        // Not after Enter: the input was just sent, and the next redraw decides.
        if (input !== KEYS.ENTER && Console.inputLine === '') {
          Console.showInputHint()
        }
      }
    }
    Console.terminal = vscode.window.createTerminal({
      name: TERMINAL_NAME,
      pty: pty
    })
  }

  public static closeIfNoCompileError(): void {
    if(!this.compileError) {
      Console.terminal?.dispose()
      Console.writeEmitter?.dispose()
      Console.changeNameEmitter?.dispose()
      Console.existsTerminal = false
    }
  }

  public static setWritingEnabled(enabled: boolean): void {
    if (!Console.writingEnabled && enabled) {
      Console.terminal.show()
    }
    if (Console.writingEnabled !== enabled) {
      // While the program waits for input, the tab name says so and the cursor blinks.
      Console.changeNameEmitter.fire(enabled ? `${TERMINAL_NAME} – waiting for input` : TERMINAL_NAME)
      Console.write(enabled ? ACTIONS.CURSOR_BLINK_ON : ACTIONS.CURSOR_BLINK_OFF)
    }
    Console.writingEnabled = enabled
  }

  public static showCompileError(error: string): void {
    Console.compileError = true
    Console.write(ACTIONS.CLEAR)
    Console.write(COLOR.RED)
    Console.write(error)
  }

  public static changeConsoleHistory(newHistory: ConsoleLine[]): void {
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

    // While the program waits for input, show the hint where the user types.
    Console.hintShown = false
    if (Console.writingEnabled) {
      Console.showInputHint()
    }

    // Bring the terminal to the front when new text appeared, for example when the program printed
    // something while the user had hidden the panel. show(true) keeps the focus where it is, so the
    // user can keep stepping with the keyboard; input requests take the focus in setWritingEnabled.
    // The frontend resends the whole history after every step: it stays the same when a step adds
    // nothing and gets shorter when the user steps back, so only a longer text counts as new.
    const textLength = newHistory.reduce((sum, line) => sum + line.output.length + line.input.length + line.error.length, 0)
    if (textLength > Console.shownTextLength) {
      Console.terminal.show(true)
    }
    Console.shownTextLength = textLength
  }

  /**
   * Shows the dim hint "Type your input and press Enter" right after the cursor, where the user
   * types, like a placeholder. The cursor is saved and restored around it, so typing starts at the
   * right position; handleInput erases the hint with the next key.
   */
  private static showInputHint(): void {
    Console.write(ACTIONS.SAVE_CURSOR + COLOR.DIM + INPUT_HINT + ACTIONS.RESET_SGR + COLOR.GREEN + ACTIONS.RESTORE_CURSOR)
    Console.hintShown = true
  }

  public static show(): void {
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
