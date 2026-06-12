// This file exists ONLY to add Lingui's macro plugin (ADR 0020); the preset stays Expo's default
// (what Metro used before this file existed). JS-only — no prebuild.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['@lingui/babel-plugin-lingui-macro'],
  };
};
