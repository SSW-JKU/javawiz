/**
 * Returns the frontend URL that starts JavaWiz in extension mode with the given ports.
 * This module does not import `vscode`, so the extension's unit tests can load it.
 *
 * Example: buildExtensionModeUrl(43210, 43211, 43212)
 * returns 'http://localhost:43210/extensionMode?pluginPort=43211&backendPort=43212'
 */
export function buildExtensionModeUrl(frontendPort: number, pluginPort: number, backendPort: number): string {
  return `http://localhost:${frontendPort}/extensionMode?pluginPort=${pluginPort}&backendPort=${backendPort}`
}
