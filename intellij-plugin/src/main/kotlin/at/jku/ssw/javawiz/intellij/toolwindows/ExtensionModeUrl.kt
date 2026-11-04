package at.jku.ssw.javawiz.intellij.toolwindows

/**
 * Returns the frontend URL that starts JavaWiz in extension mode with the given ports.
 * The frontend talks to the plugin on [pluginPort] and to the backend on [backendPort].
 * This function uses no IntelliJ services, so plain unit tests can call it.
 *
 * Example: `buildExtensionModeUrl("http://localhost", 43210, "/", 43211, 43212)`
 * returns `http://localhost:43210/extensionMode?pluginPort=43211&backendPort=43212`.
 */
internal fun buildExtensionModeUrl(host: String, frontendPort: Int, endpointRoot: String, pluginPort: Int, backendPort: Int): String =
  "$host:$frontendPort${endpointRoot}extensionMode?pluginPort=$pluginPort&backendPort=$backendPort"
