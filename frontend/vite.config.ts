import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@Shared': resolve(__dirname, '../shared/src')
    }
  },
  plugins: [
    vue(),
    ...(mode === 'analyze'
      ? [visualizer({
        filename: 'dist/bundle-report.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true
      })]
      : [])
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'monaco-editor',
              test: /node_modules[\\/]monaco-editor/,
            },
          ],
        },
      },
    },
  },
}))
