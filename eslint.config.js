import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // React Compiler rules — downgrade to warnings until codebase is migrated
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{mjs,js}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      '.output/**',
      '.nitro/**',
      '.vercel/**',
      'node_modules/**',
      '.tanstack/**',
      'vitest.config.ts',
    ],
  },
)
