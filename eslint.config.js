import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Baseline (P0): existing violations are reported as warnings only.
// Only react-hooks/rules-of-hooks is enforced as an error.
const asWarnings = (rules = {}) =>
  Object.fromEntries(Object.entries(rules).map(([name, value]) => [name, Array.isArray(value) ? ['warn', ...value.slice(1)] : value === 'off' || value === 0 ? value : 'warn']));

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'vite.config.js', 'vite.config.d.ts'] },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.audioWorklet },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...asWarnings(js.configs.recommended.rules),
      ...Object.assign({}, ...tseslint.configs.recommended.map((config) => asWarnings(config.rules))),
      ...asWarnings(reactHooks.configs.recommended?.rules ?? reactHooks.configs['recommended-latest']?.rules),
      'react-hooks/rules-of-hooks': 'error',
    },
  },
);
