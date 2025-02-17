module.exports = {
  'root': true,
  'parserOptions': {
    'ecmaVersion': 'latest',
    'parser': '@typescript-eslint/parser'
  },
  'env': {
    'es6': true
  },
  'extends': [
    'plugin:vue/recommended',
    'plugin:vue/vue3-recommended',
    '@vue/standard',
    '@vue/typescript'
  ],
  'rules': {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'vue/script-indent': ['error', 2, { 'switchCase': 1 }],
    '@typescript-eslint/indent': ['error', 2, { 'SwitchCase': 1 }],
    'vue/html-indent': ['error', 2],
    'no-tabs': ['error'],

    'quote-props': ['error', 'consistent'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],

    'no-useless-constructor': 'off',
    'vue/multi-word-component-names': 'off',

    'newline-per-chained-call': ['error', { 'ignoreChainWithDepth': 2 }],

    // 'no-unused-vars': ['error', { 'varsIgnorePattern': '^_.*', 'argsIgnorePattern': '^_.*' }],
    'no-unused-vars': 'off', // Since we use the following rule, see https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-unused-vars.md ("note you must disable the base rule as it can report incorrect errors")
    '@typescript-eslint/no-unused-vars': ['error', { 'vars': 'all', 'args': 'all', 'caughtErrors': 'all', 'varsIgnorePattern': '^_.*', 'argsIgnorePattern': '^_.*' }],
    '@typescript-eslint/type-annotation-spacing': ['error'],
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
    }],
    'vue/no-v-for-template-key-on-child': 'off' // Invalid vor vue 2: https://eslint.vuejs.org/rules/no-v-for-template-key-on-child.html
  },
  'overrides': [
    {
      files: ['*.html'],
      rules: {
        'vue/comment-directive': 'off'
      }
    }
  ]
}
