# Sufra eval harness

Single-file [promptfoo](https://www.promptfoo.dev) eval that imports the production vision module from `worker/meal-analysis/` directly. One source of truth for the schema and prompt; no drift.

## Files (the whole thing)

```
evals/
  promptfooconfig.ts          THE orchestrator. Imports MealAnalysis (Zod),
                              getSystemPrompt, MODELS from worker/meal-analysis/.
                              Generates 6 provider entries × 20 test rows.
  prompt.ts                   Function-prompt: returns chat messages array
                              as JSON string (image inline as base64 data URL).
  dishes.ts                   10 Nutrition5K dishes with measured GT + a
                              pre-baked `userContext` portion-hint string.
  report.ts                   /tmp/promptfoo-results.json → RESULTS.md
  scorers/
    kcal-mape.ts              `1 - |est - truth| / truth` on total kcal
    macro-mape.ts             same, averaged across P/C/F
    decomposition.ts          deterministic token matcher → identification /
                              portion / density sub-scores
    _parse.ts                 handles "output is sometimes already an object
                              when response_format=json_schema is enforced"
  fixtures/images/*.jpg       10 N5K dish photos
  package.json, README.md, RESULTS.md, tsconfig.json
```

8 source files. No custom providers, no assertion-adapter layer, no LLM-judge, no two-pass orchestration. The clarification flow is modeled as a **second variant per test** (`bare` vs `with-hints`) — same one-call-per-row pattern, just different `userText`.

## Architecture rule

Every concept either lives in `worker/meal-analysis/` (production, shared) or is generated from it. The eval has no duplicated prompt, no duplicated schema, no duplicated model list. Add a model in `worker/meal-analysis/models.ts` and it shows up in the next eval run automatically. Change the schema and the JSON-schema sent to OpenAI updates on the next run (via `zodResponseFormat` at config-load time).

## Setup

```bash
cd evals
pnpm install                 # also builds better-sqlite3 native binding
cp .env.example .env         # paste OpenRouter API key
```

**Requires Node 22.22+.** Use `nvm use` (reads `.nvmrc`) if your shell defaults lower.

## Commands

```bash
pnpm eval                    # 60 rows (10 dishes × 6 providers), ~$0.30
pnpm report                  # post-process /tmp/promptfoo-results.json → RESULTS.md
pnpm eval:view               # interactive web UI at http://localhost:15500
pnpm typecheck               # verify TS
```

Telemetry is disabled via `PROMPTFOO_DISABLE_TELEMETRY=1` baked into the `pnpm eval` script — matches Sufra PRD §3 ("no telemetry phoning home").

## Adjusting

- **Add a dish** — drop image in `fixtures/images/`, add an entry to `DISHES` in `dishes.ts` (with per-ingredient masses). The `userContext` string is generated automatically.
- **Add a model** — edit `worker/meal-analysis/models.ts`. Both `bare` and `with-hints` variants for that model appear in the next run automatically (the provider list in `promptfooconfig.ts` is generated from `MODELS`).
- **Add a scorer** — drop a file in `scorers/`, add an entry to `defaultTest.assert` in `promptfooconfig.ts`.

## Ground truth source

10 dishes from [**Nutrition5K**](https://github.com/google-research-datasets/Nutrition5k) (Google Research, 2021). Each dish was physically prepared, weighed on an electronic scale, and per-ingredient mass × USDA nutrients were logged. No hand-curated GT. See `fixtures/IMAGE_SOURCES.md`.

**Caveat:** all 10 dishes are Western cafeteria food. No measured-GT dataset exists for Middle Eastern cuisine. A separate MENA eval (hand-photographed + weighed) is needed before locking the default model on the cultural-recognition claim in PRD §4.

## What we measure

Two variants per dish:
- `bare` — image only, model has to estimate everything from scratch
- `with-hints` — image + a pre-baked user message confirming the actual portions on the plate

The lift from `bare → with-hints` directly tests PRD §6.4 (the clarification flow), modeled as "optional extra context" rather than a literal two-pass loop. If the model is good at using portion info, `with-hints` scores much higher.

Three scorers per row (all deterministic — no LLM judge):
- **kcal-mape** — total calorie accuracy
- **macro-mape** — average across protein / carbs / fat
- **decomposition** — splits the meal into three sub-skills via a normalized-token matcher:
  - *identification* — fraction of GT ingredients the model named
  - *portion* — per-ingredient grams MAPE (matched ingredients only)
  - *density* — per-ingredient kcal/g MAPE (model's implied vs USDA's value)
