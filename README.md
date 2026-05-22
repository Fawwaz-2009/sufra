<p align="center">
  <img src="apps/web/public/favicon.png" alt="" width="96" height="96" />
</p>

<h1 align="center">Sufra</h1>

<p align="center"><em>A photo-first calorie tracker for the people at your table.</em></p>

<p align="center">
  <code>v0.1</code> · <code>MIT</code> · <code>dogfooding</code>
</p>

---

A _sufra_ (سفرة) is a table set for the people you love. Sufra the app is calorie tracking for the people at yours. Open-source, deployed to your own Cloudflare account, no email, no telemetry. You photograph a meal, the model recognises the dish (kabsa, fattoush, mansaf, not "rice with chicken"), and the day's number updates. The estimate carries an "Improve" button coloured by the model's own confidence; tap it and the AI's specific uncertainties become questions you can answer.

This is the README for hosts: the person who deploys Sufra for a household. If you're reading because someone deployed it for you, you don't need anything here. Open the URL they gave you, set your password, take a photo.

## What isn't here

- No ads, no surveillance, no analytics
- No email infrastructure. No magic links, no password-reset emails, no SMTP server to run
- No native apps. PWA only. Add to Home Screen and live there
- No support for non-Cloudflare deploy targets in v1

## Deploy

You need: a Cloudflare account (free tier covers a family-sized instance) and an [OpenRouter API key](https://openrouter.ai/keys) (they give $1 free credit on signup, which covers hundreds of meals).

```bash
git clone https://github.com/Fawwaz-2009/sufra && cd sufra
pnpm install
pnpm bootstrap
```

`pnpm bootstrap` walks you through everything. It checks your toolchain, provisions D1 and R2 in your Cloudflare account, generates a session secret (you never see it), prompts for your OpenRouter key, applies migrations, and deploys. About 90 seconds end to end. Re-runnable, so it's safe to invoke if something goes wrong partway through.

## After it's deployed

1. **Setup wizard.** Open the deployed URL. The wizard runs once and only once. Name your Sufra (e.g. "The Alharbi"), pick a username and password. You're signed in as Host.
2. **Add Members.** Go to `/admin` → "Add Member" → type a username → hit Add. A password link is copied to your clipboard with a ready-to-share message. Paste it into WhatsApp, iMessage, a sticky note on the fridge. The Member opens the link, sets their own password, signs in.
3. **Install the PWA.** On the deployed URL, your phone's browser will offer "Add to Home Screen." On iOS, use Share → Add to Home Screen. From there, Sufra opens like any other app.

That's the whole story.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 19 + TanStack Router + Tailwind v4 + shadcn (PWA, English only in v1) |
| Backend | Hono on Cloudflare Workers. Single Worker serves the SPA and `/api/*` |
| Database | Cloudflare D1 (SQLite) via Drizzle |
| Storage | Cloudflare R2. Meal photos served via authenticated Worker routes, never publicly |
| Auth | better-auth + scrypt. No email, host-provisioned accounts only |
| Inference | OpenRouter (host's key). Gemini 3 Flash by default, switchable from `/admin` |

The full architecture and the reasoning behind each decision live in [`PRD.md`](PRD.md). The domain vocabulary is in [`CONTEXT.md`](CONTEXT.md).

## Cost expectations

For a family-sized instance (1 Host + 3-4 Members, ~150 meals/month total):

- **Cloudflare:** free tier. D1 + R2 + Workers all fit comfortably under the free limits.
- **OpenRouter:** roughly $1-3/month depending on the vision model. Default is Gemini 3 Flash (~$0.10 per 100 meals). Switch models from `/admin`.

You pay only for what your household actually runs.

## Develop

| | |
|---|---|
| Orientation | [`CLAUDE.md`](CLAUDE.md) |
| Product decisions | [`PRD.md`](PRD.md) |
| Domain glossary | [`CONTEXT.md`](CONTEXT.md) |
| Architecture decisions | [`docs/adr/`](docs/adr/) |

```bash
pnpm dev               # local dev (vite + workerd on one port)
pnpm typecheck         # tsc across all packages
pnpm db:migrate:local  # apply migrations to local D1
pnpm eval              # run the AI eval harness against Nutrition5K
```

The repo is a pnpm + Turborepo monorepo. `apps/web` is the deployed Worker + SPA; `apps/marketing` is this landing page; `apps/evals` is the promptfoo harness that imports the production estimator. Three packages, one tree.

## What this is, honestly

A personal project, shared publicly. It's the food app for my own kitchen. If you deploy it for yours and it's useful, that's enough.

Bugs go in [GitHub Issues](https://github.com/Fawwaz-2009/sufra/issues). I won't promise responsiveness; this is one person's hobby project, not a company. The license is MIT, so fork it freely if I'm asleep at the wheel.

## License

MIT. See [`LICENSE`](LICENSE).
