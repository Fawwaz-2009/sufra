import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { AttachmentsRepo } from "../../db/attachments.ts"
import { Blobs } from "../../blobs/blobs.ts"
import { atomically, run } from "../../db/sql.ts"
import { MediaTooLarge, UnsupportedMedia, type Kind, type Slot, type Upload } from "../../contract/upload.ts"

/**
 * Attachable — the SHARED `has_one_attached` concern: attach/read/purge/copy for ONE piece of media in
 * a named SLOT, generalized over the polymorphic owner `(recordType, recordId)` + the slot `name`. An
 * aggregate binds it to its own record + slot via `one(slot)`; consumers call the aggregate, never this
 * concern directly.
 *
 * Sufra's deviation from the house style (ADR 0014): the bytes serve through the authenticated proxy,
 * not presigned URLs — so there is no signing here. Instead `read` (bytes + type, for the proxy serve /
 * refine) and `copy` (duplicate the slot to another owner, for clone) join the standard attach/purge.
 */

interface Owner {
  readonly recordType: string
  readonly recordId: string
  readonly name: string
}

const mintKey = (owner: Owner): string =>
  `${owner.recordType}s/${owner.recordId}/${owner.name}/${crypto.randomUUID()}`

/**
 * Validate a file against a slot's `Kind` — the trust boundary. SNIFF the real type from the bytes (the
 * client claims none), check the allowlist + size cap, fail TYPED (`UnsupportedMedia` 415 /
 * `MediaTooLarge` 413). Returns the sniffed content type. (`return yield* Effect.fail(...)` so TS
 * narrows past the guard.)
 */
export const validate = Effect.fn("Attachable.validate")(function* (file: Upload, kind: Kind) {
  const contentType = kind.sniff(file.data)
  if (contentType === null || !kind.contentTypes.includes(contentType)) {
    return yield* Effect.fail(new UnsupportedMedia({ message: `Use one of: ${kind.contentTypes.join(", ")}.` }))
  }
  if (file.data.byteLength > kind.maxBytes) {
    return yield* Effect.fail(
      new MediaTooLarge({ message: `Must be under ${Math.round(kind.maxBytes / 1024 / 1024)} MB.` })
    )
  }
  return contentType
})

/**
 * attach — set (or replace) the owner's slot to `file`. Validate, put the new bytes under a fresh key,
 * then swap the row in one atomic batch (drop the old by SLOT, insert the new) so concurrent replaces
 * can't both survive. The R2 delete of the old blob is best-effort (a stranded blob is harmless — the
 * row is the source of truth, only a referenced key is ever served).
 */
export const attach = Effect.fn("Attachable.attach")(function* (owner: Owner, file: Upload, kind: Kind) {
  const attachments = yield* AttachmentsRepo
  const blobs = yield* Blobs

  const contentType = yield* validate(file, kind)
  const existing = yield* run(attachments.forSlot(owner))

  const key = mintKey(owner)
  yield* blobs.put(key, { body: file.data, contentType })

  yield* atomically([
    attachments.delete({ recordType: owner.recordType, recordId: owner.recordId, name: owner.name }),
    attachments.create({
      key,
      recordType: owner.recordType,
      recordId: owner.recordId,
      name: owner.name,
      filename: file.filename,
      contentType,
      byteSize: file.data.byteLength
    })
  ])

  if (Option.isSome(existing)) yield* blobs.delete(existing.value.key).pipe(Effect.ignore)
})

/** read — the slot's bytes + content type (for the proxy serve, refine re-estimate). None when empty. */
export const read = Effect.fn("Attachable.read")(function* (owner: Owner) {
  const attachments = yield* AttachmentsRepo
  const blobs = yield* Blobs
  const existing = yield* run(attachments.forSlot(owner))
  if (Option.isNone(existing)) return Option.none<{ bytes: Uint8Array; contentType: string }>()
  const bytes = yield* blobs.get(existing.value.key)
  if (bytes === null) return Option.none<{ bytes: Uint8Array; contentType: string }>()
  return Option.some({ bytes, contentType: existing.value.contentType })
})

/**
 * copy — duplicate the source slot's bytes + row to a new owner (clone). The clone gets its OWN key, so
 * source and clone have INDEPENDENT media lifecycles (ADR 0008's clone-copies-bytes invariant). A no-op
 * when the source slot is empty.
 */
export const copy = Effect.fn("Attachable.copy")(function* (from: Owner, to: Owner) {
  const attachments = yield* AttachmentsRepo
  const blobs = yield* Blobs
  const existing = yield* run(attachments.forSlot(from))
  if (Option.isNone(existing)) return
  const bytes = yield* blobs.get(existing.value.key)
  if (bytes === null) return
  const key = mintKey(to)
  yield* blobs.put(key, { body: bytes, contentType: existing.value.contentType })
  yield* run(
    attachments.create({
      key,
      recordType: to.recordType,
      recordId: to.recordId,
      name: to.name,
      filename: existing.value.filename,
      contentType: existing.value.contentType,
      byteSize: existing.value.byteSize
    })
  )
})

/** purgeRecord — clear EVERY slot of a record (its media), for the owner's destroy path (Rails'
 *  `dependent: :purge_later`). Delete the rows, then the blobs best-effort; a no-op when empty. */
export const purgeRecord = Effect.fn("Attachable.purgeRecord")(function* (recordType: string, recordId: string) {
  const attachments = yield* AttachmentsRepo
  const blobs = yield* Blobs
  const all = yield* run(attachments.allForRecord({ recordType, recordId }))
  if (all.length === 0) return
  yield* atomically(all.map((row) => attachments.delete({ id: row.id })))
  yield* Effect.forEach(all, (row) => blobs.delete(row.key).pipe(Effect.ignore), { concurrency: "unbounded" })
})

/**
 * one — bind a declared SLOT (the model's `Slot`) to its operations (`has_one_attached`). The aggregate
 * binds it in one line and exposes the bound API; consumers call `Meal.photo.attach(...)`, never this
 * concern. The slot IS a `Kind`, so the bound ops carry the validation + its typed media errors.
 */
export const one = (slot: Slot) =>
  ({
    attach: (recordId: string, file: Upload) =>
      attach({ recordType: slot.recordType, recordId, name: slot.name }, file, slot),
    validate: (file: Upload) => validate(file, slot),
    read: (recordId: string) => read({ recordType: slot.recordType, recordId, name: slot.name }),
    copy: (fromRecordId: string, toRecordId: string) =>
      copy(
        { recordType: slot.recordType, recordId: fromRecordId, name: slot.name },
        { recordType: slot.recordType, recordId: toRecordId, name: slot.name }
      )
  }) as const
