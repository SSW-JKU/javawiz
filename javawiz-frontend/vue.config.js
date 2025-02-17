const path = require('path')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin')

const crypto = require('crypto')

// According to https://stackoverflow.com/a/72219174/2938364
// this prevents the error error:0308010C:digital envelope routines::unsupported
/**
 * The MD4 algorithm is not available anymore in Node.js 17+ (because of library SSL 3).
 * In that case, silently replace MD4 by the MD5 algorithm.
 */
try {
  crypto.createHash('md4')
} catch (_e) {
  console.warn('Crypto "MD4" is not supported anymore by this Node.js version')
  const origCreateHash = crypto.createHash
  crypto.createHash = (alg, opts) => {
    return origCreateHash(alg === 'md4' ? 'md5' : alg, opts)
  }
}

module.exports = {
  configureWebpack: {
    plugins: [
      new MonacoWebpackPlugin({
        // available options are documented at https://github.com/Microsoft/monaco-editor-webpack-plugin#options
        languages: ['java']
      })
    ],
    // vue.config.js and tsconfig.json must be in sync!
    // https://stackoverflow.com/questions/54561799/vue-typescript-error-with-webpack-alias-path-not-found:
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@Shared': path.resolve(__dirname, '../shared/src'),
        'splitpanes-raw': path.resolve(__dirname, 'node_modules/splitpanes/src/components/splitpanes') // regular distribution of splitpanes fails in production build
      }
    }
    // devtool: 'source-map'
  },
  css: {
    sourceMap: true
  },
  publicPath: '/',
  devServer: {
    client: {
      overlay: false
    },
    historyApiFallback: true,
    watchFiles: ['src/**/*.vue', 'src/**/*.ts', 'src/**/*.js']
  }
}

console.log('vue.config.js:')
console.log(JSON.stringify(module.exports, null, 2))
