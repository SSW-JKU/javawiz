// eslint-disable-next-line no-undef
module.exports = {
  "parserOptions": {
      "ecmaVersion": "latest"
  },

  "env": {
      "es6": true
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
};