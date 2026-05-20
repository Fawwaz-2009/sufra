# Sufra eval harness

Single-file [promptfoo](https://www.promptfoo.dev) eval that runs **the production estimator function directly** via a custom provider — same code path as the Worker, no `response_format` / chat-completions divergence to debug.

## Files (the whole thing)

```
evals/
  promptfooconfig.ts          THE orchestrator. Imports MealAnalysis (Zod),
                              getSystemPrompt, MODELS from worker/meals/estimator/.
                              Generates a provider matrix from MODELS × test variants.
  estimator-provider.ts       Custom ApiProvider class. Decodes the data-URL image
                              and calls estimateMeal(env, photo, opts) directly.
                              Same function the Worker uses in prod.
  dishes.ts                   10 Nutrition5K dishes with measured GT + a
                              pre-baked `userContext` portion-hint string.
  report.ts                   /tmp/promptfoo-results.json → RESULTS.md
  scorers/
    kcal-mape.ts              `1 - |est - truth| / truth` on total kcal
    macro-mape.ts             same, averaged across P/C/F
    decomposition.ts          deterministic token matcher → identification /
                              portion / density sub-scores
    locale-check.ts           verifies foods[].name + clarifications[].question
                              are in the target locale (Arabic-script check)
    _parse.ts                 handles "output may already be an object"
  fixtures/images/*.jpg       10 N5K dish photos
  package.json, README.md, RESULTS.md, tsconfig.json
```

## Architecture rule

Every concept either lives in `worker/meals/estimator/` (production code) or is generated from it. The eval has no duplicated prompt, no duplicated schema, no duplicated model list. **Crucially, the eval *calls* the same `estimateMeal()` function the Worker calls in prod** — same prompts, same Zod schema, same error handling, same headers. Any model that works in prod works in eval; any prompt or schema change flows through automatically.

The earlier `openai:chat:` provider pattern was retired because it routed through OpenRouter's OpenAI-compatible Chat Completions API with `response_format: json_schema` — under that path, models with thinking enabled (Gemini 3.5, etc.) leak reasoning tokens into the JSON and break parsing. The production code uses AI SDK's `Output.object({ schema })` which uses tool-call structured output and dodges that whole class of issue.

## Setup

```bash
cd evals
pnpm install                 # also builds better-sqlite3 native binding
cp .env.example .env         # paste OpenRouter API key
```

**Requires Node 22.22+.** Use `nvm use` (reads `.nvmrc`) if your shell defaults lower.

## Commands

```bash
pnpm eval                    # full matrix, ~$0.30
pnpm report                  # post-process /tmp/promptfoo-results.json → RESULTS.md
pnpm eval:view               # interactive web UI at http://localhost:15500
pnpm typecheck               # verify TS
```

To triage a single model/dish without running the full matrix:

```bash
pnpm eval --filter-providers "<model-slug>" --filter-pattern "<dish-key>.*bare"
```

Telemetry is disabled via `PROMPTFOO_DISABLE_TELEMETRY=1` baked into the `pnpm eval` script — matches Sufra PRD §3 ("no telemetry phoning home").

## Adjusting

- **Add a dish** — drop image in `fixtures/images/`, add an entry to `DISHES` in `dishes.ts` (with per-ingredient masses).
- **Add a model** — edit `worker/meals/estimator/models.ts`. Both `bare` and `with-hints` variants appear automatically (provider matrix is generated from `MODELS`). Triage with the single-row command above (filtered eval) to verify the slug + prod path before running the full matrix.
- **Add a scorer** — drop a file in `scorers/`, add an entry to `defaultTest.assert` in `promptfooconfig.ts`.

## Ground truth source

10 dishes from [**Nutrition5K**](https://github.com/google-research-datasets/Nutrition5k) (Google Research, 2021). Each dish was physically prepared, weighed on an electronic scale, and per-ingredient mass × USDA nutrients were logged. No hand-curated GT. See `fixtures/IMAGE_SOURCES.md`.

**Caveat:** all 10 dishes are Western cafeteria food. No measured-GT dataset exists for Middle Eastern cuisine. A separate MENA eval (hand-photographed + weighed) is needed before locking the default model on the cultural-recognition claim in PRD §4.

## What we measure

Two variants per dish:
- `bare` — image only, model has to estimate everything from scratch
- `with-hints` — image + a pre-baked user message confirming the actual portions on the plate (passed as `userText` to the estimator; the custom provider strips the standard prompt prefix so it's pure extra context)

The lift from `bare → with-hints` directly tests PRD §6.4 (the clarification flow, now implemented in production as the Refinement feature).

Plus one Arabic-locale row on the first dish per model — verifies the locale instruction is honored without re-running the full matrix in every language.

Four scorers per row (all deterministic — no LLM judge):
- **kcal-mape** — total calorie accuracy
- **macro-mape** — average across protein / carbs / fat
- **decomposition** — splits the meal into three sub-skills via a normalized-token matcher:
  - *identification* — fraction of GT ingredients the model named
  - *portion* — per-ingredient grams MAPE (matched ingredients only)
  - *density* — per-ingredient kcal/g MAPE (model's implied vs USDA's value)
- **locale-check** — for `locale=ar` rows, verifies foods[].name + clarifications[].question contain Arabic-script characters
