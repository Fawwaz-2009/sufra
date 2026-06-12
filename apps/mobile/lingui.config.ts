import { defineConfig } from '@lingui/cli';

// ADR 0020: English + Arabic. Catalogs compile to TS modules (compileNamespace) so Metro/Hermes
// import them like any source file — no @lingui/metro-transformer, which would have to compose
// with the custom NativeWind CSS transformer (metro-css-transformer.js).
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'ar'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  compileNamespace: 'ts',
});
