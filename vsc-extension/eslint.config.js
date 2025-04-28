import js from '@eslint/js'
import ts from 'typescript-eslint'

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  { ignores: ['**/out', '**/img'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        ecmaVersion: "latest",
      }
    },
    rules: {
    'indent': ['error', 2, {'SwitchCase': 1}],
    'no-tabs': ['error', {'allowIndentationTabs': true}],

    'quote-props': ['error', 'consistent'],
    'quotes': ['error', 'single', {'allowTemplateLiterals': true}],


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
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
    },
  },
)