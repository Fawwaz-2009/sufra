// ESLint flat config for the Expo / React Native app.
//
// This app is linted by `eslint-config-expo` — the RN/Expo-aware config — NOT the repo-root
// config. The root config targets the Effect/Cloudflare worker + the web SPA, where banning
// `require()` (@typescript-eslint/no-require-imports) is correct. React Native loads static
// assets via `require('./x.png')` (Metro resolves these to an asset reference at build time), so
// that rule is wrong here; eslint-config-expo permits it. Keeping a standalone config is the
// monorepo idiom (cf. apps/marketing/eslint.config.js).
//
// CommonJS on purpose: apps/mobile/package.json has no "type":"module", so a `.js` config is CJS.
// Shape per the Expo docs: https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    rules: {
      // eslint's import resolver treats `[id]` bracket syntax as a glob character class and
      // misreports dynamic route segments as unresolved. TypeScript resolves them correctly.
      'import/no-unresolved': ['error', { ignore: ['\\[id\\]'] }],
    },
  },
])
