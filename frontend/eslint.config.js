import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  { ignores: ['**/dist'] },
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      // do not set parser: ts.parser here, as this breaks linting for the <template> blocks in .vue files
      ecmaVersion: "latest",
      globals: { // to enable console.xyz(), HTML element types, etc. --> https://eslint.org/docs/latest/use/configure/language-options#predefined-global-variables
        ...globals.browser
      },
      parserOptions: {
        ecmaVersion: "latest"
      }
    },
    rules: {
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'vue/script-indent': ['error', 2, { 'switchCase': 1 }],
      'vue/html-indent': ['error', 2],
      'no-tabs': ['error'],
      'space-before-function-paren': ["error", {
        "anonymous": "never",
        "named": "always",
        "asyncArrow": "always"
      }],

      'quote-props': ['error', 'as-needed'],
      'quotes': ['error', 'single'],
      'vue/multi-word-component-names': 'off',

      'newline-per-chained-call': ['error', { 'ignoreChainWithDepth': 2 }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          'vars': 'all',
          'args': 'all',
          'caughtErrors': 'all',
          'varsIgnorePattern': '^_.*',
          'argsIgnorePattern': '^_.*',
          'caughtErrorsIgnorePattern': '^_',
        }
      ],
      // D3 makes heavy use of complex generics that are difficult to type precisely.
      // `any` occurrences in this project are largely D3-related and are accepted.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'vue/html-closing-bracket-newline': ['error', {
        'singleline': 'never',
        'multiline': 'never'
      }],

      'vue/max-attributes-per-line': ['error', {
        'singleline': 4,
        'multiline': 4
      }],

      'vue/max-len': ['error', {
        'code': 180,
        'template': 180,
        'tabWidth': 2,
        'comments': 180,
        'ignorePattern': '',
        'ignoreComments': true,
        'ignoreTrailingComments': true,
        'ignoreUrls': true,
        'ignoreStrings': false,
        'ignoreTemplateLiterals': true,
        'ignoreRegExpLiterals': true,
        'ignoreHTMLAttributeValues': false,
        'ignoreHTMLTextContents': false
      }]
    }
  },
  // Tell eslint to use the TypeScript parser for .vue files only for the <script lang="ts"> blocks
  // This is done by setting the parserOptions.parser
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        ecmaVersion: "latest"
      }
    }
  }
)