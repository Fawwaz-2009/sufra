const { getDefaultConfig } = require("expo/metro-config")
const { withNativewind } = require("nativewind/metro")
const path = require("node:path")

const config = getDefaultConfig(__dirname)
const nativewindConfig = withNativewind(config)

module.exports = {
  ...nativewindConfig,
  transformerPath: path.resolve(__dirname, "metro-css-transformer.js"),
}
