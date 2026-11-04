import assert from 'node:assert/strict'
import test from 'node:test'
import { buildExtensionModeUrl } from './ExtensionModeUrl'

test('names the plugin and backend ports in the extension-mode URL', () => {
  assert.equal(
    buildExtensionModeUrl(43210, 43211, 43212),
    'http://localhost:43210/extensionMode?pluginPort=43211&backendPort=43212'
  )
})
