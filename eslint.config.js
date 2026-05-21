import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts',
    'worker-configuration.d.ts',
    'worker/db/migrations/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // TanStack Router route files export `Route` alongside the inline route
    // component. Fast Refresh can't preserve state for locally-defined route
    // components, but a full route reload is acceptable here.
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // ADR 0005 — physical isomorphism boundary.
    //
    // Two surfaces share one rule: any file that gets compiled into the SPA
    // bundle (`src/**`) AND any file that may also be imported from the SPA
    // (`worker/**/isomorphic/**`) must not value-import from worker-runtime
    // modules. Doing so would pull drizzle / drizzle-zod / Hono / the AI SDK
    // into the client bundle. Type imports remain free under
    // `verbatimModuleSyntax: true`.
    //
    // The ban list enumerates the worker-runtime files explicitly because
    // ESLint v9's no-restricted-imports uses gitignore-style matching where
    // re-including a file under an ignored directory isn't reliable. Files
    // under `worker/<domain>/isomorphic/**` and `worker/meals/estimator/schema`
    // (the zod-only `MealAnalysis` schema) stay freely value-importable
    // because they are NOT in the ban list.
    files: ['src/**/*.{ts,tsx}', 'worker/**/isomorphic/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: [
            // Whole-directory bans — every file under these is worker-runtime.
            '**/worker/db/**',
            '**/worker/routes/**',
            // Specific worker-runtime files.
            '**/worker/index',
            '**/worker/types',
            '**/worker/errors',
            '**/worker/auth/index',
            '**/worker/auth/middleware',
            '**/worker/auth/password-link',
            '**/worker/profile/operations',
            '**/worker/profile/schema',
            '**/worker/meals/index',
            '**/worker/meals/operations',
            '**/worker/meals/schema',
            '**/worker/meals/estimator/index',
            '**/worker/meals/estimator/errors',
            '**/worker/meals/estimator/prompts',
          ],
          allowTypeImports: true,
          message:
            'Worker-runtime modules cannot be value-imported from the SPA or from an isomorphic file — use `import type`, or move runtime values into a worker/<domain>/isomorphic/ leaf. See ADR 0005.',
        }],
      }],
    },
  },
])
