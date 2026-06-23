import js from '@eslint/js'
import ts from 'typescript-eslint'
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  { ignores: ['**/out', '**/img'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: ts.parser,
      ecmaVersion: "latest",
      globals: { // to enable console.xyz(), HTML element types, etc. --> https://eslint.org/docs/latest/use/configure/language-options#predefined-global-variables
        ...globals.node
      }
    },
    rules: {
      'indent': ['error', 2, { 'SwitchCase': 1 }],
      'no-tabs': ['error'],

      'quote-props': ['error', 'as-needed'],
      'quotes': ['error', 'single'],


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
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
)
