import { it } from "@effect/vitest"
import { expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Upload, sniffImageType } from "../../../src/worker/contract/upload.ts"

/**
 * `Upload.data` (`Uint8ArrayFromBase64`) crosses the wire BOTH ways: the request tests exercise the
 * server DECODE (base64 → Uint8Array), but the client ENCODE (Uint8Array → base64) is a separate
 * transform a request test never runs. A green request suite that only decodes is a false signal — so
 * cover the encode direction here (the derived `HttpApiClient`'s exact path, no Worker needed).
 */
it.effect("Upload encodes a file to { filename, base64 } — the client's wire shape", () =>
  Effect.gen(function* () {
    const wire = yield* Schema.encodeEffect(Upload)({ filename: "meal.png", data: new Uint8Array([1, 2, 3]) })
    expect(wire.filename).toBe("meal.png")
    expect(typeof wire.data).toBe("string") // Uint8ArrayFromBase64 → base64 on the wire
  })
)

it("sniffs PNG / JPEG / WEBP from magic bytes, null otherwise", () => {
  expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
  expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg")
  expect(
    sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))
  ).toBe("image/webp")
  expect(sniffImageType(new Uint8Array([1, 2, 3, 4, 5]))).toBe(null)
})
