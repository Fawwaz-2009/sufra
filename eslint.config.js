import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/node_modules',
    'apps/web/src/routeTree.gen.ts',
    'apps/web/worker-configuration.d.ts',
    'apps/web/worker/db/migrations/**',
    // The pre-Effect Hono/Drizzle worker (port-reference, deleted in Slice 5) + the deferred frontend
    // route trees moved out of the compiled tree (restored + reshaped in Slices 3-5).
    'apps/web/worker/**',
    'apps/web/deferred-frontend/**',
    '.turbo',
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
    // TanStack Router route files export `Route` alongside the inline route component; shadcn `ui/*`
    // components export their `cva` variants alongside the component. Fast Refresh can't preserve state
    // for those, but a full reload is acceptable here.
    files: ['apps/web/src/routes/**/*.{ts,tsx}', 'apps/web/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // The Effect + Cloudflare worker (ADR 0009+) carries house-style idioms that the default
    // `recommended` rules flag as smells but are settled conventions (fawwaz-coding-style):
    //  - the DERIVED repo interface `export interface XRepo extends Effect.Success<typeof make> {}`
    //    (no-empty-object-type) — the single-source-of-truth pattern, nothing to declare;
    //  - the low-level Command generic `Statement.Statement<any>` in db/sql.ts + db/table.ts
    //    (no-explicit-any) — the un-run-statement carrier, deliberately opaque;
    //  - the middleware's unused `_options` param (no-unused-vars) — part of the HttpApiMiddleware
    //    function signature, kept for documentation.
    files: ['apps/web/src/worker/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // ADR 0005 — physical isomorphism boundary.
    //
    // Two surfaces share one rule: any file that gets compiled into the SPA
    // bundle (`apps/web/src/**`) AND any file that may also be imported from
    // the SPA (`apps/web/worker/**/isomorphic/**`) must not value-import from
    // worker-runtime modules. Doing so would pull drizzle / drizzle-zod /
    // Hono / the AI SDK into the client bundle. Type imports remain free
    // under `verbatimModuleSyntax: true`.
    //
    // The ban list enumerates the worker-runtime files explicitly because
    // ESLint v9's no-restricted-imports uses gitignore-style matching where
    // re-including a file under an ignored directory isn't reliable. Files
    // under `worker/<domain>/isomorphic/**` and `worker/meals/estimator/schema`
    // (the zod-only `MealAnalysis` schema) stay freely value-importable
    // because they are NOT in the ban list.
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'apps/web/worker/**/isomorphic/**/*.{ts,tsx}',
    ],
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
