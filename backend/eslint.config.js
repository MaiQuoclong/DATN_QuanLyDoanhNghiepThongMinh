const js = require('@eslint/js');
const globals = require('globals');
const jest = require('eslint-plugin-jest');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    ...jest.configs['flat/recommended'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      // Hàm trợ giúp *Ok tự expect bên trong; expect trong beforeEach/afterEach dùng để kiểm tra dọn dữ liệu
      'jest/expect-expect': ['error', { assertFunctionNames: ['expect', '*Ok'] }],
      'jest/no-standalone-expect': 'off',
      'jest/no-conditional-expect': 'off',
    },
  },
  prettier,
];
