#!/usr/bin/env node
// scripts/bootstrap.mjs
//
// Interactive provisioner for Sufra. Walks the host through Cloudflare
// resource creation, secret generation, schema migrations, and the first
// deploy. Re-runnable — safe to invoke multiple times.
//
// Run from the repo root:   pnpm bootstrap

import {
  intro,
  outro,
  text,
  password,
  confirm,
  isCancel,
  log,
  spinner,
  note,
  cancel,
} from "@clack/prompts"
import { spawn } from "node:child_process"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { applyEdits, modify } from "jsonc-parser"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const WRANGLER_JSONC = resolve(ROOT, "apps/web/wrangler.jsonc")

// -- Tiny helpers -----------------------------------------------------------

// Forest green, pulled from the app's --primary (oklch 0.527 0.154 150)
// converted to sRGB. The CLI shares this accent with marketing + the
// deployed app so the brand reads as one across surfaces. Used sparingly —
// brand bookends only (wordmark, deployed URL, /admin reference). The
// functional UI relies on clack's defaults.
const accent = (s) => `\x1b[38;2;82;140;81m${s}\x1b[0m`
const mute = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

function die(msg) {
  cancel(msg)
  process.exit(1)
}

function bail() {
  cancel("Cancelled. Nothing changed on Cloudflare.")
  process.exit(0)
}

// Run a command async — returns a Promise. Critical: spawnSync blocks Node's
// event loop, which freezes clack's spinner animation mid-frame. Async spawn
// keeps the event loop free so the spinner stays alive during long-running
// operations like `wrangler deploy`.
function run(cmd, args, { input, capture = true, cwd = ROOT } = {}) {
  return new Promise((resolveP) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: capture ? ["pipe", "pipe", "pipe"] : "inherit",
    })

    let stdout = ""
    let stderr = ""
    if (capture) {
      child.stdout?.on("data", (d) => {
        stdout += d.toString()
      })
      child.stderr?.on("data", (d) => {
        stderr += d.toString()
      })
    }

    if (input !== undefined && child.stdin) {
      child.stdin.write(input)
      child.stdin.end()
    }

    child.on("close", (code) => {
      resolveP({ status: code ?? -1, stdout, stderr })
    })
    child.on("error", (err) => {
      resolveP({ status: -1, stdout, stderr: stderr + err.message })
    })
  })
}

const wrangler = (args, opts) =>
  run("pnpm", ["--filter", "@sufra/web", "exec", "wrangler", ...args], opts)

function patchJsonc(path, edits) {
  let text = readFileSync(path, "utf8")
  for (const [pathParts, value] of edits) {
    const edits = modify(text, pathParts, value, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    })
    text = applyEdits(text, edits)
  }
  writeFileSync(path, text)
}

// -- Steps ------------------------------------------------------------------

async function preflight() {
  const s = spinner()
  s.start("Checking your toolchain")

  // node version
  const major = Number(process.versions.node.split(".")[0])
  if (major < 22) {
    s.stop("Node version is too old")
    die(
      `Sufra needs Node 22 or newer (you have ${process.versions.node}). Try: \`fnm use 22\` or \`nvm use 22\`.`,
    )
  }

  // wrangler reachable + logged in
  const who = await wrangler(["whoami"])
  if (who.status !== 0) {
    s.stop("Not signed in to Cloudflare")
    note(
      `Run \`pnpm --filter @sufra/web exec wrangler login\` in another terminal,\nthen re-run \`pnpm bootstrap\`.`,
      "Sign in",
    )
    process.exit(1)
  }

  // pull email out of whoami output
  const emailMatch = who.stdout.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
  const email = emailMatch ? emailMatch[0] : "your account"

  s.stop(`Signed in as ${mute(email)}`)
}

async function chooseNames() {
  const workerName = await text({
    message: "What should we call this Worker?",
    placeholder: "sufra",
    initialValue: "sufra",
    validate: (v) => {
      if (!v) return "Required"
      if (!/^[a-z0-9-]+$/.test(v))
        return "Lowercase letters, numbers, hyphens only"
      if (v.length > 63) return "Too long (max 63 chars)"
    },
  })
  if (isCancel(workerName)) bail()

  return {
    workerName,
    dbName: workerName,
    bucketName: `${workerName}-photos`,
  }
}

async function provisionD1(dbName) {
  const s = spinner({ indicator: "timer" })
  s.start(`Looking for a D1 database named ${bold(dbName)}`)

  const list = await wrangler(["d1", "list", "--json"])
  let dbId = null
  if (list.status === 0) {
    try {
      const dbs = JSON.parse(list.stdout)
      const existing = dbs.find((d) => d.name === dbName)
      if (existing) {
        dbId = existing.uuid
        s.stop(`Reusing existing D1 ${mute(`(${dbId.slice(0, 8)}…)`)}`)
        return dbId
      }
    } catch {
      // fall through to create
    }
  }

  s.message(`Creating D1 database ${bold(dbName)}`)
  const create = await wrangler(["d1", "create", dbName])
  if (create.status !== 0) {
    s.stop("D1 creation failed")
    log.error(create.stderr || create.stdout)
    die("Could not create D1 database.")
  }

  const uuidMatch = create.stdout.match(
    /"?database_id"?\s*[:=]\s*"?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"?/i,
  )
  if (!uuidMatch) {
    s.stop("D1 created but couldn't read the ID")
    log.error(create.stdout)
    die("Wrangler returned an unexpected format. Run with --verbose and check.")
  }
  dbId = uuidMatch[1]
  s.stop(`Created D1 database ${mute(`(${dbId.slice(0, 8)}…)`)}`)
  return dbId
}

async function provisionR2(bucketName) {
  const s = spinner({ indicator: "timer" })
  s.start(`Looking for an R2 bucket named ${bold(bucketName)}`)

  const list = await wrangler(["r2", "bucket", "list"])
  if (list.status === 0 && list.stdout.includes(`name: ${bucketName}`)) {
    s.stop(`Reusing existing R2 bucket`)
    return
  }

  s.message(`Creating R2 bucket ${bold(bucketName)}`)
  const create = await wrangler(["r2", "bucket", "create", bucketName])
  if (create.status !== 0 && !create.stderr.includes("already exists")) {
    s.stop("R2 creation failed")
    log.error(create.stderr || create.stdout)
    die("Could not create R2 bucket.")
  }
  s.stop("R2 bucket ready")
}

function patchWranglerConfig({ workerName, dbName, dbId, bucketName }) {
  if (!existsSync(WRANGLER_JSONC)) {
    die(`Could not find ${WRANGLER_JSONC}. Are you in the repo root?`)
  }

  patchJsonc(WRANGLER_JSONC, [
    [["name"], workerName],
    [["d1_databases", 0, "database_name"], dbName],
    [["d1_databases", 0, "database_id"], dbId],
    [["r2_buckets", 0, "bucket_name"], bucketName],
  ])
  log.success("apps/web/wrangler.jsonc updated")
}

async function setSecrets() {
  const orKey = await password({
    message: "OpenRouter API key",
    mask: "•",
    validate: (v) => {
      if (!v) return "Required — get one at https://openrouter.ai/keys"
      if (!v.startsWith("sk-or-"))
        return "Doesn't look like an OpenRouter key (should start with sk-or-)"
    },
  })
  if (isCancel(orKey)) bail()

  const authSecret = randomBytes(32).toString("base64")

  const s = spinner({ indicator: "timer" })

  s.start("Setting BETTER_AUTH_SECRET (auto-generated, 32 bytes)")
  const a = await wrangler(["secret", "put", "BETTER_AUTH_SECRET"], {
    input: authSecret,
  })
  if (a.status !== 0) {
    s.stop("Failed to set BETTER_AUTH_SECRET")
    log.error(a.stderr || a.stdout)
    die("Could not set BETTER_AUTH_SECRET.")
  }
  s.stop("BETTER_AUTH_SECRET set")

  s.start("Setting OPENROUTER_API_KEY")
  const b = await wrangler(["secret", "put", "OPENROUTER_API_KEY"], {
    input: orKey,
  })
  if (b.status !== 0) {
    s.stop("Failed to set OPENROUTER_API_KEY")
    log.error(b.stderr || b.stdout)
    die("Could not set OPENROUTER_API_KEY.")
  }
  s.stop("OPENROUTER_API_KEY set")
}

// Three separate stages instead of one chained `pnpm run deploy`. Why:
// (1) the user sees which stage is running and how long it's taken so far
// via clack's timer indicator, and (2) errors surface against the right
// step so debugging is straightforward.
async function deploy() {
  // Stage 1 — build (vite first, then tsc; see apps/web/package.json)
  let s = spinner({ indicator: "timer" })
  s.start("Building worker bundle")
  const build = await run("pnpm", ["--filter", "@sufra/web", "run", "build"])
  if (build.status !== 0) {
    s.stop("Build failed")
    log.error((build.stdout + build.stderr).trim())
    die("Build failed. See output above.")
  }
  s.stop("Worker bundle built")

  // Stage 2 — migrations
  s = spinner({ indicator: "timer" })
  s.start("Applying database migrations to D1")
  const migrate = await wrangler(["d1", "migrations", "apply", "DB", "--remote"])
  if (migrate.status !== 0) {
    s.stop("Migrations failed")
    log.error(migrate.stderr || migrate.stdout)
    die("Migration apply failed. See output above.")
  }
  s.stop("Migrations applied")

  // Stage 3 — deploy
  s = spinner({ indicator: "timer" })
  s.start("Deploying to Cloudflare")
  const dep = await wrangler(["deploy"])
  if (dep.status !== 0) {
    s.stop("Deploy failed")
    log.error(dep.stderr || dep.stdout)
    die("Deploy failed. See output above.")
  }

  const urlMatch = dep.stdout.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)
  const url = urlMatch ? urlMatch[0] : null
  s.stop(url ? `Deployed → ${accent(url)}` : "Deployed (no URL detected)")
  return url
}

// -- Main -------------------------------------------------------------------

async function main() {
  console.log()
  intro(bold(accent("Sufra")) + mute("  ·  one-time setup"))

  note(
    `Sufra deploys to ${bold("your own")} Cloudflare account, calls ${bold("your own")}\nOpenRouter key, and never phones home. This script sets that up.\n\nYou'll need:\n  ·  A Cloudflare account (free tier is enough)\n  ·  An OpenRouter API key — ${mute("https://openrouter.ai/keys")}`,
    "Welcome",
  )

  const proceed = await confirm({
    message: "Continue?",
    initialValue: true,
  })
  if (isCancel(proceed) || !proceed) bail()

  await preflight()

  const { workerName, dbName, bucketName } = await chooseNames()

  const dbId = await provisionD1(dbName)
  await provisionR2(bucketName)
  patchWranglerConfig({ workerName, dbName, dbId, bucketName })

  await setSecrets()

  const url = await deploy()

  console.log()
  outro(
    url
      ? `${bold("Done.")}\n\n   Open ${accent(url)}\n   to finish setup — name your Sufra, pick a username, you're in.\n\n   To add Members later, go to ${accent("/admin")} on the deployed Worker.`
      : `${bold("Done.")}\n\n   Find your Worker URL on the Cloudflare dashboard,\n   then visit it to finish setup.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
