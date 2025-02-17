// eslint-disable-next-line no-undef
module.exports = {
  'root': true,
  'parserOptions': {
    'ecmaVersion': 'latest'
  },
  'env': {
    'es6': true
  },
  'parser': '@typescript-eslint/parser',
  'plugins': [
    '@typescript-eslint',
  ],
  'extends': [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  'rules': {
    'indent': ['error', 2, {'SwitchCase': 1}],
    'no-tabs': ['error', {'allowIndentationTabs': true}],

    'quote-props': ['error', 'consistent'],
    'quotes': ['error', 'single', {'allowTemplateLiterals': true}],

    'no-unused-vars': 'off',

    '@typescript-eslint/no-unused-vars': ['error', {'varsIgnorePattern': '^_.*', 'argsIgnorePattern': '^_.*'}],
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-non-null-assertion': 0,

    '@typescript-eslint/indent': ['error', 2, {'SwitchCase': 1}],
  }
}

// eslint-disable-next-line no-undef
console.log('.eslintrc.js:')
// console.log(JSON.stringify(module.exports, null, 2))