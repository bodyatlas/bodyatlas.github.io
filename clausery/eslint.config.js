import js from '@eslint/js';

const browserGlobals = { window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly', history: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', indexedDB: 'readonly', fetch: 'readonly', Blob: 'readonly', File: 'readonly', FileReader: 'readonly', URL: 'readonly', Intl: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', requestAnimationFrame: 'readonly', console: 'readonly', Node: 'readonly', structuredClone: 'readonly', Response: 'readonly', caches: 'readonly', self: 'readonly', globalThis: 'readonly', Buffer: 'readonly', process: 'readonly', crypto: 'readonly' };

export default [
  { ignores: ['node_modules/**', 'vendor/**', 'test-results/**', 'playwright-report/**', 'assets/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browserGlobals }, rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] } },
];
