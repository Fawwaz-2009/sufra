# Effect v4-beta + API facts — VERIFIED against `node_modules`

Training data is mostly Effect 3 / older AI SDK and will be WRONG about these. Every fact below was
checked against the installed packages during the re-platform (Slices 2–3); re-verify only on a
version bump. (Migrated from the retired refactor-handoff docs — this is the durable home.)

## Schema

- `Schema.Literals([...])` (enums), `Schema.Finite` (not `Number` for JSON-schema fields), `Schema.Trim`,
  `Schema.fromJsonString(schema)` (JSON-as-TEXT column codec; Encoded = string),
  `Schema.toJsonSchemaDocument(schema, { additionalProperties: false })` → `{ schema, definitions }`
  (draft-2020-12), `Schema.encodeSync`/`decodeUnknownSync`/`decodeUnknownEffect`.
  `Schema.toStandardSchemaV1` exists but is NOT a `StandardJSONSchemaV1`, so it can't go straight into
  AI-SDK `Output.object` — derive a JSON Schema instead.
- Checks: `Schema.Finite.check(Schema.isBetween({ minimum, maximum }))`,
  `Schema.Int.check(Schema.isBetween({ minimum, maximum }))`, `Schema.String.check(Schema.isPattern(/…/))`.
  `isBetween` takes an **options object** `{ minimum, maximum, exclusiveMinimum?, exclusiveMaximum? }`,
  NOT positional args.

## Effect

- NO `Effect.tapBoth`, NO `Effect.catchAll`. Use `Effect.tap` + `Effect.tapError` + `Effect.matchEffect`
  + `Effect.catchTag`. `Option.fromNullishOr` (not `fromNullable`). Service tags are yielded directly
  (`const x = yield* SomeRepo`), no `.asEffect()`.

## Models & persistence

- **`Model.jsonCreate` IS the create payload** when the client sends the columns — it drops
  `UuidV7Insert` ids + `DateTimeInsert`/`DateTimeUpdate` + any `FieldExcept(["jsonCreate",…])`
  (server-set FKs). `select.Type` for a `DateTimeInsert` column decodes to a **DateTime object** (not a
  string) — keep it OUT of plain views, or convert.
- **Upsert (no `makeTable` helper for it):** hand-write `` sql`INSERT INTO t ${sql.insert(row)} ON
  CONFLICT ("a","b") DO UPDATE SET col = excluded.col, … RETURNING *` `` as a named repo command (decode
  `rows[0]`). The conflict target keeps the EXISTING row's id (the SET omits id) — so `run` the upsert
  for an edit to get the real id back; in an `atomically` batch the RETURNING is ignored (decode the
  built row instead).

## HttpApi (contract + handlers)

- GET query params key is **`query`** (not `urlParams`). `HttpApiEndpoint.delete` exists. Binary
  success: `Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array())`. A handler may **return an
  `HttpServerResponse`** (e.g. `HttpServerResponse.uint8Array(bytes, { contentType, headers })`)
  instead of the success value. `HttpServerResponse.fromWeb` carries Set-Cookie through.
- **Controller path params** are read as `({ params })` (e.g. `params.id`), NOT `({ path })`.
- **Middleware path params:** `HttpRouter.schemaPathParams(Schema).pipe(Effect.orDie)` (a middleware
  can't read the handler's typed args). `orNotFound` lives in `support/http.ts`.

## HttpApiClient (frontend)

- Request keys are **`params`** (path), **`query`** (query string), **`payload`** (body) — e.g.
  `client.meals.show({ params: { id } })`, `client.meals.index({ query: { from, to } })`. A scoped 404
  fails with the typed `NotFound` → map it with
  `.pipe(Effect.catchTag("NotFound", () => Effect.succeed(null)))`.

## The frontend gate + cache (load-bearing)

- `ensureQueryData` does **NOT** refetch stale data (`revalidateIfStale` defaults false) — it returns
  cached-if-present. So a mutation that changes gate-relevant state on a route that **doesn't observe**
  that query (e.g. onboarding doesn't `useQuery` `/me`) MUST invalidate with **`refetchType: "all"`**
  and `await` it, or the next `beforeLoad` gate reads stale data and loops. Routes that DO observe the
  query (Profile `useSuspenseQuery(me)`, Day view `useQuery(me)`) refetch on a default (active)
  invalidate.

## Better Auth

- The role-flip at Setup, the password set at redeem, and the credential delete at member-removal use
  `auth.$context.internalAdapter` (no admin session needed).

## AI SDK v6 (`ai@6`, `@openrouter/ai-sdk-provider@2`)

- `import { Output, generateText, jsonSchema } from "ai"`;
  `generateText({ output: Output.object({ schema: jsonSchema(jsonSchema7) }), system, messages:
  [{ role:"user", content:[{type:"text",text},{type:"image",image: Uint8Array}] }] })`; read
  `result.output` (decode it yourself with the Effect schema) + `result.usage.{inputTokens,outputTokens}`.
  **Always load the `ai-sdk` skill + verify against `node_modules/ai/docs` before touching the vision
  call** (`domain/meal/estimatable/`).

## Tooling

- **eslint:** there's a `src/worker/**` override (allows the `Effect.Success<typeof make> {}`
  derived-interface, the `Command<any>` generic, `_options`) and a `components/ui/**`
  react-refresh-off. Extend these, don't fight the rules — the house idioms are settled.
- **VisionTest pattern** (`domain/meal/estimatable/service.ts`): the request pool's
  `OPENROUTER_API_KEY` is a placeholder; the deterministic test layer keeps meal-create tests off the
  network. Mirror it for any new side-effect.
