import * as Schema from "effect/Schema"

/**
 * Upload — the reusable, declarative shape of an INCOMING file, and the house convention for how
 * files cross the wire here.
 *
 * A file is an ORDINARY schema field: `data` is a `Uint8Array` in the handler and a base64 string
 * on the wire (`Schema.Uint8ArrayFromBase64`). So an upload is a plain, strongly-typed JSON payload
 * — NOT multipart/form-data, no `FormData`, no streams, no filesystem (Workers have none). The
 * derived `HttpApiClient` takes a plain `{ filename, data }` object and ENCODES it; the server
 * DECODES it on the way in.
 *
 * `Upload` is STRUCTURAL only — it carries no content-type and no validation. The client neither
 * sends nor CLAIMS a content type: the server SNIFFS the real type from the bytes (`sniffImageType`),
 * the slot's `Kind` owns the allowlist + size cap, and the DOMAIN runs the check and fails with the
 * TYPED, DECLARED errors at the bottom of this file.
 */
export const Upload = Schema.Struct({
  filename: Schema.String.check(Schema.isMinLength(1)),
  data: Schema.Uint8ArrayFromBase64
})
export type Upload = typeof Upload.Type

/**
 * Sniff an image's REAL type from its leading magic bytes, or `null` when the bytes match none of
 * the image kinds we ship. The client never claims a content type, so the bytes are the ONLY source
 * of truth: we decide the type from them and persist + later serve THAT, so what we store is provably
 * the type we say it is. A `Kind` hands this in as its `sniff`.
 *
 *   PNG  → first 8 bytes are 89 50 4E 47 0D 0A 1A 0A
 *   JPEG → first 3 bytes are FF D8 FF
 *   WEBP → a RIFF container ("RIFF" at 0, "WEBP" at 8)
 */
export const sniffImageType = (bytes: Uint8Array): string | null => {
  const at = (i: number): number => bytes[i] ?? -1
  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return "image/png"
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return "image/webp"
  }
  return null
}

/**
 * A KIND of upload — the constraints on a slot's file, plus the SNIFFER that derives a file's real
 * type from its bytes. The DOMAIN runs it on attach (`attach(owner, file, kind)`).
 */
export interface Kind {
  readonly contentTypes: ReadonlyArray<string>
  readonly maxBytes: number
  readonly sniff: (bytes: Uint8Array) => string | null
}

/**
 * A declared media SLOT — the polymorphic owner type + the slot's logical name + its validation
 * `Kind`, all in one value (`has_one_attached`). It lives ON THE MODEL (the single source of truth);
 * the three places that touch the slot reference it rather than re-typing literals — the DOMAIN binds
 * the operations (`Attachable.one(slot)`), the proxy serve reads it, and the endpoint declares its
 * typed errors. `recordType` is the owner's record type (e.g. `"meal"`); `name` is the slot (`"photo"`).
 */
export interface Slot extends Kind {
  readonly recordType: string
  readonly name: string
}

/**
 * The two DECLARED, typed media errors a slot can produce — raised by the DOMAIN (`attach`), DECLARED
 * by the resource (an endpoint's `error:` union), rendered to the client by its human `message`. The
 * `httpApiStatus` annotation (3rd arg, the way the framework's own `HttpApiError` classes set theirs)
 * makes the runtime render 415/413 and lets the typed client decode the response back into THIS
 * instance (whose `message` the UI shows verbatim — no policy string on the client).
 */
export class UnsupportedMedia extends Schema.TaggedErrorClass<UnsupportedMedia>()(
  "UnsupportedMedia",
  { message: Schema.String },
  { httpApiStatus: 415 }
) {}

export class MediaTooLarge extends Schema.TaggedErrorClass<MediaTooLarge>()(
  "MediaTooLarge",
  { message: Schema.String },
  { httpApiStatus: 413 }
) {}
