const path = require("node:path")
const { unstable_transformerPath } = require("expo/metro-config")
const postcss = require("postcss")
const tailwindcss = require("@tailwindcss/postcss")
const { compile } = require("react-native-css/compiler")

const expoTransformer = require(unstable_transformerPath)
const reactNativeCssMetroDir = path.dirname(require.resolve("react-native-css/metro"))
const { getNativeInjectionCode } = require(path.join(reactNativeCssMetroDir, "injection-code.js"))

function isAppNativeCss(projectRoot, filePath, options) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath)
  return options.platform !== "web" && absolutePath === path.resolve(__dirname, "src/global.css")
}

function removeAtRuleBlocks(css, pattern) {
  let output = css
  let match = pattern.exec(output)

  while (match) {
    const start = match.index
    let depth = 0
    let end = -1

    for (let index = start; index < output.length; index++) {
      const char = output[index]
      if (char === "{") {
        depth += 1
      } else if (char === "}") {
        depth -= 1
        if (depth === 0) {
          end = index + 1
          break
        }
      }
    }

    if (end === -1) {
      return output.slice(0, start)
    }

    output = output.slice(0, start) + output.slice(end)
    pattern.lastIndex = 0
    match = pattern.exec(output)
  }

  return output
}

function stripBrowserOnlyTailwindCss(css) {
  return removeAtRuleBlocks(removeAtRuleBlocks(css, /@property\s+--tw-[\w-]+\s*\{/g), /@layer\s+properties\s*\{/g)
    .replace(/@layer\s+properties\s*;/g, "")
}

function extractRootTheme(css) {
  const match = /:root\s*,\s*:host\s*\{/.exec(css)
  if (!match) {
    return { css, variables: {} }
  }

  const start = match.index
  const bodyStart = start + match[0].length
  let depth = 1
  let end = -1

  for (let index = bodyStart; index < css.length; index++) {
    const char = css[index]
    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }

  if (end === -1) {
    return { css, variables: {} }
  }

  const variables = {}
  const body = css.slice(bodyStart, end)
  body.replace(/--([\w-]+):\s*([^;{}]+)\s*;?/g, (_, name, value) => {
    variables[name] = value.trim()
    return ""
  })

  return {
    css: css.slice(0, start) + css.slice(end + 1),
    variables,
  }
}

function inlineStaticThemeVariables(css) {
  const rootTheme = extractRootTheme(css)
  const variables = rootTheme.variables
  let output = rootTheme.css
    .replace(/\/\*! tailwindcss[^*]*\*\/\n?/, "")

  for (let i = 0; i < 5; i++) {
    output = output.replace(
      /var\(--([\w-]+),\s*var\(--([\w-]+)\)\)/g,
      (_, name, fallbackName) => variables[name] ?? variables[fallbackName] ?? "initial"
    )
    output = output.replace(
      /var\(--([\w-]+)(?:,\s*([^)]+))?\)/g,
      (_, name, fallback) => variables[name] ?? fallback ?? "initial"
    )
  }

  return output
}

module.exports.transform = async function transform(config, projectRoot, filePath, data, options) {
  if (isAppNativeCss(projectRoot, filePath, options)) {
    const result = await postcss([tailwindcss({})]).process(data.toString(), { from: filePath })
    const css = inlineStaticThemeVariables(stripBrowserOnlyTailwindCss(result.css))
    const stylesheet = compile(css, {
      ...options.reactNativeCSS,
      filename: filePath,
      projectRoot,
    }).stylesheet()
    const js = getNativeInjectionCode([], [stylesheet])
    return expoTransformer.transform(config, projectRoot, `${filePath}.js`, js, options)
  }

  return expoTransformer.transform(config, projectRoot, filePath, data, options)
}
