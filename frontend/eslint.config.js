import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // File page/component có xuất kèm hằng số/hàm dùng chung: chỉ ảnh hưởng hot reload khi dev, không ảnh hưởng chạy thật
      'react-refresh/only-export-components': 'off',
      // Đánh dấu biến dùng làm thẻ JSX (<BieuTuong />) là đã dùng, để no-unused-vars bắt đúng import/hằng thừa
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
    },
  },
  { files: ['vite.config.js'], languageOptions: { globals: { ...globals.node } } },
  prettier,
];
