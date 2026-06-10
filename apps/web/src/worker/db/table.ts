import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { command, type Command } from "./sql.ts"

/**
 * `makeTable` — the uniform persistence surface every repository is built on. Every write returns
 * a `Command` (see `db/sql.ts`): an UN-RUN statement + how to decode it. One shape:
 *
 *   create(props)         — INSERT … RETURNING *; `Command<Model>` (decodes the row).
 *   update(id, set)       — UPDATE … WHERE id = ? RETURNING *; `Command<Model>`.
 *   updateWhere(ref, set) — UPDATE … WHERE <ref>; `Command<void>` (no RETURNING).
 *   delete(ref)           — DELETE … WHERE <ref>; `Command<void>`.
 *
 * Because a command is un-run, the SAME value goes either way: `run(repo.create(props))` executes
 * it and hands back the decoded model (you ask for a row, you get a row — no re-read, no codec at
 * the call site, the decoder rides along), and `atomically([repo.create(props), …])` composes it
 * into one D1 batch with other writes. The domain maps the model to a view as a SEPARATE step.
 * `.make`/encode happen inside the builder, so a throw is a defect, not an escape.
 *
 * `set` / `ref` are typed against the model ROW (`Model.select.Encoded`): `undefined` in a `set`
 * leaves that column alone, `null` writes SQL NULL; `ref` is an AND-of-equalities (`{ id }`,
 * `{ recordId }`), never an arbitrary clause. `create` takes DOMAIN props (encoded via `.make`);
 * `update`/`updateWhere` take ROW-encoded values — the deliberate low-level path. Reads sit on top
 * as named read commands.
 */
export const makeTable = <
  Insert extends Schema.Codec<any, any, never, never>,
  Select extends Schema.Codec<any, any, never, never>
>(
  model: { readonly insert: Insert; readonly select: Select },
  table: string
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    type Row = Select["Encoded"]

    const where = (ref: Partial<Row>) => {
      const clauses = Object.entries(ref).map(([col, val]) => sql`${sql(col)} = ${val}`)
      if (clauses.length === 0) throw new Error(`empty where ref on "${table}"`)
      return sql.and(clauses)
    }
    const assignments = (set: Partial<Row>) => {
      const set2 = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined))
      if (Object.keys(set2).length === 0) throw new Error(`empty update set on "${table}"`)
      return set2
    }

    const decodeRow = (rows: ReadonlyArray<unknown>) =>
      Schema.decodeUnknownEffect(model.select)(rows[0]).pipe(Effect.orDie)

    const create = (props: Insert["~type.make.in"]): Command<Select["Type"]> => ({
      statement: Effect.sync(() => {
        const record = model.insert.make(props)
        return sql`INSERT INTO ${sql(table)} ${sql.insert(
          Schema.encodeSync(model.insert)(record) as Record<string, unknown>
        )} RETURNING *`
      }),
      decode: decodeRow
    })

    const update = (id: string, set: Partial<Row>): Command<Select["Type"]> => ({
      statement: Effect.sync(
        () =>
          sql`UPDATE ${sql(table)} SET ${sql.update(assignments(set))} WHERE ${sql("id")} = ${id} RETURNING *`
      ),
      decode: decodeRow
    })

    const updateWhere = (ref: Partial<Row>, set: Partial<Row>) =>
      command(() => sql`UPDATE ${sql(table)} SET ${sql.update(assignments(set))} WHERE ${where(ref)}`)

    const remove = (ref: Partial<Row>) => command(() => sql`DELETE FROM ${sql(table)} WHERE ${where(ref)}`)

    return { sql, create, update, updateWhere, delete: remove } as const
  })
