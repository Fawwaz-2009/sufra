# Media via the attachable model, served through the authenticated proxy

Sufra adopts the house style's `attachable` media model — one polymorphic `attachments` table (Blob and Attachment collapsed into a single row), a `Blobs` transport service over R2, the shared `attachable` concern (`has_one_attached`), the slot declared on the model, and base64-JSON typed upload with server-side magic-byte sniffing and typed errors (`UnsupportedMedia` / image-too-large). The Meal declares an optional `photo` slot (`recordType "meal"`, name `"photo"`); "a photo is required" is a create-time rule, not a `NOT NULL` constraint. Two deliberate deviations for Sufra: (a) photos serve via the authenticated Worker proxy `GET /meals/:id/photo` (owner-scoped → 404, per ADR 0013), NOT presigned-direct-from-R2; (b) the photo enters via `POST /meals`, so the `photo` sub-resource carries only `show` today.

## Why

Follow the style — it is the considered default — for storage shape: one polymorphic `attachments` table, the `Blobs` service, the `attachable` concern, slot-on-the-model.

The slot is **optional** because that is forward-looking. A future "meal from description, add the photo later" feature keeps **one Meal shape** with no migration — the alternative (`photoR2Key NOT NULL`) would force two Meal shapes the moment description-meals land. Rails attaches `has_one_attached` at create routinely; "required at create" is enforced in the create rule, not the column.

**Proxy serve** is the right deviation for Sufra. It fits the no-public-bucket stance the project has held since M3 (R2 reached only through authenticated Worker routes). It is **more private** for personal food photos — each request re-authenticates against the session and is owner-scoped, versus handing out a bearer signed URL that anyone holding it can replay until it expires. And it is **simpler**: the view emits a stable proxy URL, so we drop `signGetUrl`, aws4fetch / R2 S3 credentials, the `BlobsLive` / `BlobsLocal` env-swap, the `/files` dev route, the effectful view-signing, and the TTL==`staleTime` freshness rule. Images are small (no videos), comfortably under a ~20 MB ceiling, so there is no scale reason to leave the byte path and go direct-from-R2.

**base64-JSON upload** kills the raw-`fetch` escape hatch (the multipart upload was one of the two `fetch` holes ADR 0015 closes) and is Workers-correct — there is no filesystem to stream a multipart body to disk.

## Mechanism

- **`attachments` table** — polymorphic: `recordType` + `recordId` address the owning row, `name` is the slot. One row per attached blob; Blob and Attachment are not two tables here.
- **`Blobs` service** — `put` / `get` / `delete` only. The R2 binding (`BUCKET`) lives behind it; no S3 signing surface, no env-swapped implementations.
- **`attachable` concern** (`domain/concerns/attachable.ts`) — `has_one_attached`; the Meal aggregate imports it and declares its `Photo` slot.
- **Upload** — base64 in the create JSON. The server **sniffs magic bytes** (does not trust the client's content-type), rejecting non-images with `UnsupportedMedia` and oversized images with a typed too-large error.
- **Serve** — `GET /meals/:id/photo` loads the meal through `CurrentUser` (404 on a non-owner or missing meal, per ADR 0013), reads the slot via `Blobs.get`, and streams the bytes with `X-Content-Type-Options: nosniff` and `Content-Disposition: inline` hardening. The meal view emits the **stable proxy path** as `photoUrl` (non-effectful; `null` when no photo) — no signing, no per-render freshness.
- **Clone** — copies the attachment row and the underlying bytes (server-side), so the source and clone have independent media lifecycles (preserves ADR 0008's clone-copies-bytes invariant).
- **Destroy** — meal `destroy` calls `purgeRecord` to drop the attachment row and its bytes.

## Considered alternatives

- **A `photoR2Key` column on `meal`.** Rejected — forces `NOT NULL` and two Meal shapes the moment description-meals land. The "promote an optional photo at create" argument was re-litigating a considered convention; the optional slot keeps one shape.
- **Presigned-direct-from-R2 serving (the style's headline mode).** Rejected — contradicts the no-public-bucket stance; weaker privacy for personal food photos (a replayable signed URL vs per-request re-auth); needless signing + freshness infrastructure at household scale where images are small.
- **Multipart upload.** Rejected — Workers have no filesystem to stream a multipart body to disk, and it leaves a raw-`fetch` escape hatch that the typed contract is meant to close.

## Consequences

- New files: `models/attachment.ts`, `db/attachments.ts`, `domain/concerns/attachable.ts`, and `blobs/` (`put` / `get` / `delete`).
- The Meal model declares the optional `Photo` slot; the meal view gains `photoUrl` (stable proxy path or `null`).
- Clone copies the attachment (row + bytes); destroy purges the record.
- We drop the entire signing path: `signGetUrl`, aws4fetch / R2 S3 creds, the `BlobsLive` / `BlobsLocal` env-swap, the `/files` dev route, effectful view-signing, and the TTL==`staleTime` rule.
- The `photo` sub-resource exposes only `show` now; it gains `create` / `destroy` when description-meals land.
- Skill-sharpening note to push back: media serve has two legitimate modes — **presigned-direct** (scale) and **authenticated-proxy** (no-public-bucket / strictly-private); the proxy mode drops the signing + freshness machinery, and required-at-create-but-optional-in-schema media is a slot attached at create, not a `NOT NULL` column.
