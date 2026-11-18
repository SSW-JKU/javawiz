import * as vscode from 'vscode'
import * as _ from 'lodash'
import { resolveMainMethods } from './Codelens'

/** Name of the context key read by the `when` clauses of `javawiz.start` in `package.json`. */
const CONTEXT_KEY = 'javawiz.activeFileHasMain'

/** The part of the API exported by the Red Hat Java extension (`redhat.java`) that is used here. */
interface RedHatJavaApi {
  serverReady?: () => Promise<boolean>
}

/**
 * Keeps the context key `javawiz.activeFileHasMain` up to date. The key is `true` while the active
 * editor shows a Java file in which the Java language support finds a main method, and `false`
 * otherwise, also when the language support cannot answer (for example while it is still loading).
 * The menu entries, the Command Palette entry, and the shortcut of "Debug with JavaWiz" are only
 * available while the key is `true`.
 *
 * The key is updated when another editor becomes active, shortly after the active file is edited,
 * and once the Java language support has finished loading.
 *
 * Call it once when the extension is activated:
 *
 *     context.subscriptions.push(watchActiveFileForMainMethod())
 *
 * @returns a disposable that stops listening for editor changes
 */
export function watchActiveFileForMainMethod(): vscode.Disposable {
  // Counts the checks. A check only sets the key if no newer check has started meanwhile, so a slow
  // answer for a previous editor cannot overwrite the answer for the current one.
  let latestRequest = 0

  const update = async (): Promise<void> => {
    const request = ++latestRequest
    const document = vscode.window.activeTextEditor?.document
    let hasMain = false
    if (document?.languageId === 'java') {
      try {
        hasMain = (await resolveMainMethods(document.uri)).length > 0
      } catch (_e) {
        hasMain = false // the Java language support could not answer
      }
    }
    if (request === latestRequest) {
      setHasMain(hasMain)
    }
  }
  // Typing changes the document on every key press; ask the language support only after a short pause.
  const updateAfterEdit = _.debounce(update, 300)

  const subscriptions = [
    vscode.window.onDidChangeActiveTextEditor(() => {
      // Hide the entries of the previous file while the new file is being checked.
      latestRequest++
      setHasMain(false)
      update()
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === vscode.window.activeTextEditor?.document) {
        updateAfterEdit()
      }
    })
  ]

  // `serverReady()` belongs to the API that the Red Hat Java extension exports to other extensions.
  // The returned promise resolves once its language server can answer questions such as "where are
  // the main methods of this file?". It is listed in `extensionDependencies`, so it is activated
  // before JavaWiz and its exports are available here. Before that point, `update()` gets no answer.
  const javaApi = vscode.extensions.getExtension<RedHatJavaApi>('redhat.java')?.exports
  javaApi?.serverReady?.().then(() => update(), () => undefined)

  update()

  return vscode.Disposable.from(...subscriptions, { dispose: () => updateAfterEdit.cancel() })
}

/**
 * Sets the context key. The built-in `setContext` command stores a value under a name of our
 * choice that `when` clauses in `package.json` can read. The value only lives in the running
 * VS Code window and is not saved between sessions.
 */
function setHasMain(value: boolean): void {
  vscode.commands.executeCommand('setContext', CONTEXT_KEY, value)
}
