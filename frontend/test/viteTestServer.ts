import { createServer, type InlineConfig, type ViteDevServer } from 'vite'

/**
 * Starts the Vite server a test uses to load frontend modules with `ssrLoadModule`, so their `@/` aliases,
 * Vue files, and D3 imports resolve. Pass only what a test needs in addition, for example plugins:
 *
 *   const vite = await createTestServer({ plugins: [memoryViewStoreMocks()] })
 *   try { ... await vite.ssrLoadModule('/src/...') ... } finally { await vite.close() }
 *
 * Vite's dependency scan is always turned off. It prepares packages for the browser, which these tests
 * don't use, and it runs in the background in native code. A test that finishes quickly closes the server
 * while the scan is still running, and Node can then crash (for example with SIGSEGV or a V8 "Internal
 * field out of bounds" error) instead of reporting the test result.
 */
export function createTestServer (options: InlineConfig = {}): Promise<ViteDevServer> {
  return createServer({
    ...options,
    server: { middlewareMode: true, hmr: false, ...options.server },
    appType: 'custom',
    optimizeDeps: { ...options.optimizeDeps, noDiscovery: true }
  })
}
