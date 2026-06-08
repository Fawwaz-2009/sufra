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
  // NOTE: the old ADR 0005 `no-restricted-imports` isomorphism rule (anchored to the deleted Hono/Drizzle
  // `worker/**`) is gone. The browser-safe boundary is now enforced structurally by the split tsconfigs —
  // server-only `src/worker/*` can't compile under the frontend's DOM scope, and the frontend only imports
  // the browser-safe `src/worker/{contract,models,views}`. An explicit ESLint boundary rule for the new
  // stack is a known, deliberate gap (fawwaz-coding-style "Known gaps").
])
