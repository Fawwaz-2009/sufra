import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/** Branded id for the `attachments` table — a UUID v7 generated on insert. */
export const AttachmentId = Schema.String.pipe(Schema.brand("AttachmentId"))
export type AttachmentId = typeof AttachmentId.Type

/**
 * An attachment — a blob of media (today: a meal photo) belonging to SOME record. It collapses Active
 * Storage's two tables (`blobs` + `attachments`) into ONE polymorphic table: `recordType` + `recordId`
 * name the owner (Rails' `attachable_type` / `attachable_id`), `name` is the logical slot, so the same
 * table can later carry other media slots without a new table per owner.
 *
 * The bytes live in R2 under `key` (the `Blobs` service puts/gets/deletes them); this row is the
 * metadata + the pointer. `key` is SERVER-MINTED — never part of a client payload (`FieldExcept`).
 */
export class Attachment extends Model.Class<Attachment>("Attachment")({
  id: Model.UuidV7Insert(AttachmentId),

  key: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // The polymorphic owner: (type, id). For a meal photo: recordType = "meal", recordId = the meal id.
  recordType: Schema.String,
  recordId: Schema.String,

  // The logical SLOT this file occupies on the owner (Active Storage's attachment name), e.g. "photo".
  // A slot holds ONE media (has_one_attached) — re-upload REPLACES it — so reads/replace key on
  // (recordType, recordId, name).
  name: Schema.String,

  filename: Schema.String,
  contentType: Schema.String,
  byteSize: Schema.Int,

  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}
