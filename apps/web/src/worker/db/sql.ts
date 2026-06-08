import * as Effect from "effect/Effect"
import * as D1Client from "@effect/sql-d1/D1Client"
import type * as Statement from "effect/unstable/sql/Statement"

/**
 * Build the Effect `SqlClient` from a request-time D1 binding.
 *
 * `D1Client.layer({ db })` takes a concrete config (no `Config` wrapper) and provides BOTH the
 * `D1Client` tag and the generic `SqlClient` tag, so downstream code can depend on
 * `SqlClient.SqlClient`.
 */
export const SqlLayer = (db: D1Database) => D1Client.layer({ db })

/**
 * A write COMMAND — an UN-RUN statement paired with how to decode its result. Because it hasn't
 * executed, the same command works both ways:
 *
 *   const row = yield* run(repo.create(props))                  // execute + decode → the typed row
 *   yield* atomically([repo.delete(ref), repo.create(props)])   // one D1 batch, atomic
 *
 * The decoder rides ALONG (the repo knows its own shape), so `run` needs no codec at the call
 * site. A `Statement<A>` is itself an `Effect<ReadonlyArray<A>, SqlError>`; the command wraps the
 * *builder* (`Effect<Statement>`, so a `.make`/encode/guard throw is a defect, not an escape) plus
 * the `rows → A` decode. `db/table.ts` builds these for CRUD; `command()` is the escape hatch for
 * a custom write.
 */
export interface Command<A> {
  readonly statement: Effect.Effect<Statement.Statement<any>, never, never>
  readonly decode: (rows: ReadonlyArray<unknown>) => Effect.Effect<A, never, never>
}

/** A custom VOID command from a raw statement thunk — for writes that don't fit the generic CRUD.
 *  The thunk runs inside `Effect.sync`, so a construction throw becomes a defect. */
export const command = (build: () => Statement.Statement<any>): Command<void> => ({
  statement: Effect.sync(build),
  decode: () => Effect.void
})

/** Run ONE command: execute its statement (`flatten`: a Statement IS an Effect of its rows), then
 *  apply the command's own decoder. Infra failures become defects. */
export const run = <A>(cmd: Command<A>): Effect.Effect<A, never, never> =>
  cmd.statement.pipe(Effect.flatten, Effect.orDie, Effect.flatMap(cmd.decode))

/**
 * Run several commands as ONE atomic unit — all commit, or none. `Effect.all` constructs every
 * statement first (so any construction defect surfaces HERE, never mid-array-literal), then we
 * compile each to `[sql, params]` and hand the lot to D1's `batch()` (one implicit transaction —
 * the only atomicity primitive on D1). Decoders are IGNORED: a batch returns no typed rows by
 * design; if you need a row back, that's a single `run`.
 *
 *   yield* atomically([
 *     attachments.delete({ recordType, recordId, name }),
 *     attachments.create(next)
 *   ])
 */
export const atomically = (commands: ReadonlyArray<Command<any>>) =>
  Effect.gen(function* () {
    const stmts = yield* Effect.all(commands.map((c) => c.statement))
    const db = (yield* D1Client.D1Client).config.db
    const prepared = stmts.map((statement) => {
      const [query, params] = statement.compile()
      return db.prepare(query).bind(...params)
    })
    yield* Effect.tryPromise(() => db.batch(prepared)).pipe(Effect.orDie)
  })
