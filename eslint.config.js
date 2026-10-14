import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'reports', 'public', 'node_modules', 'test-results', 'playwright-report'],
  },

  // Plain JavaScript (Node scripts and config files).
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // TypeScript with type-aware rules.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Browser application code.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // The simulation core is framework-free and deterministic.
  {
    files: ['src/game/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pixi.js', 'pixi.js/*', '@pixi/*'],
              message: 'The core must not depend on PixiJS.',
            },
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'The core must not depend on React.',
            },
            {
              group: ['**/render/**', '**/ui/**', '**/input/**', '**/audio/**'],
              message: 'The core must not depend on presentation layers.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG from core/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Simulation time comes from step(dt).' },
        { object: 'performance', property: 'now', message: 'Simulation time comes from step(dt).' },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage'],
    },
  },

  prettier,
);
