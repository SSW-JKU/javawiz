import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  
  { ignores: ['**/dist'] },
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    },
    rules: {
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'vue/script-indent': ['error', 2, { 'switchCase': 1 }],
      'vue/html-indent': ['error', 2],
      'no-tabs': ['error'],

      'quote-props': ['error', 'consistent'],
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'vue/multi-word-component-names': 'off',

      'newline-per-chained-call': ['error', { 'ignoreChainWithDepth': 2 }],
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 'vars': 'all', 
          'args': 'all', 
          'caughtErrors': 'all', 
          'varsIgnorePattern': '^_.*', 
          'argsIgnorePattern': '^_.*',
          'caughtErrorsIgnorePattern': '^_',
        }
      ],
      '@typescript-eslint/no-explicit-any': 'off',
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
        'ignoreTemplateLiterals': false,
        'ignoreRegExpLiterals': true,
        'ignoreHTMLAttributeValues': false,
        'ignoreHTMLTextContents': false
      }]
    }
  })