import js from '@eslint/js'
import ts from 'typescript-eslint'
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: ts.parser,
      ecmaVersion: "latest",
      globals: { // to enable console.xyz(), HTML element types, etc. --> https://eslint.org/docs/latest/use/configure/language-options#predefined-global-variables
        ...globals.es2022
      }
    },
  },
)