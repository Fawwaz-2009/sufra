import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"

/**
 * Turn a scoped lookup's `Option.none` (absent-or-not-yours) into a typed `NotFound` — the one line
 * that closes every scoped read into a uniform 404 (ADR 0013). `run` already turns infra failures into
 * defects, so this is the ONLY thing piped onto a load (never `Effect.orDie` first). `support/` is the
 * home for tiny cross-cutting helpers — explicitly NOT the concerns drawer.
 */
export const orNotFound = <A, E, R>(
  self: Effect.Effect<Option.Option<A>, E, R>
): Effect.Effect<A, E | HttpApiError.NotFound, R> =>
  Effect.flatMap(
    self,
    Option.match({
      onNone: () => Effect.fail(new HttpApiError.NotFound()),
      onSome: Effect.succeed
    })
  )
