import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Attachment } from "../models/attachment.ts"
import { makeTable } from "./table.ts"
import { type Command } from "./sql.ts"

/**
 * The attachments repository — one polymorphic media table. CRUD comes from `makeTable`; the custom
 * reads are `forSlot` (the at-most-one file in an owner's named slot — `has_one_attached`, replaced on
 * re-upload) and `allForRecord` (every slot of a record, for the destroy/purge path).
 */
const make = Effect.gen(function* () {
  const { sql, create, update, updateWhere, delete: del } = yield* makeTable(Attachment, "attachments")

  const forSlot = (slot: {
    readonly recordType: string
    readonly recordId: string
    readonly name: string
  }): Command<Option.Option<typeof Attachment.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, key, recordType, recordId, name, filename, contentType, byteSize, createdAt, updatedAt
      FROM attachments
      WHERE recordType = ${slot.recordType} AND recordId = ${slot.recordId} AND name = ${slot.name}
      ORDER BY createdAt DESC
      LIMIT 1
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(Attachment.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const allForRecord = (rec: {
    readonly recordType: string
    readonly recordId: string
  }): Command<ReadonlyArray<typeof Attachment.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, key, recordType, recordId, name, filename, contentType, byteSize, createdAt, updatedAt
      FROM attachments
      WHERE recordType = ${rec.recordType} AND recordId = ${rec.recordId}
      ORDER BY createdAt ASC
    `),
    decode: (rows) => Schema.decodeUnknownEffect(Schema.Array(Attachment.select))(rows).pipe(Effect.orDie)
  })

  return { create, update, updateWhere, delete: del, forSlot, allForRecord } as const
})

export interface AttachmentsRepo extends Effect.Success<typeof make> {}
export const AttachmentsRepo = Context.Service<AttachmentsRepo>("app/attachments/AttachmentsRepo")
export const AttachmentsRepoLayer = Layer.effect(AttachmentsRepo, make)
