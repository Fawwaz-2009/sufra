/**
 * App-wide tunables — the worker's ROOT CONFIG. One place for the knobs that are neither
 * secrets/bindings (those are `env.ts` / `wrangler.jsonc`) nor a single feature's private
 * concern. Plain typed constants: change here, redeploy.
 */

/**
 * MAX_REQUEST_BYTES — the hard ceiling on a WRITE request's body, checked from `Content-Length`
 * at the worker entry (`src/server.ts`) BEFORE the body is ever read.
 *
 * A COARSE, app-wide backstop against an authed memory/CPU DoS — a huge POST the worker would
 * otherwise fully buffer + JSON-parse + base64-decode before any per-field cap could fire. It is
 * NOT the per-upload limit: each attachment slot's real size cap is its `Kind.maxBytes`, enforced
 * in the domain.
 *
 * Keep it comfortably ABOVE the largest legitimate worker-proxied write: a meal photo rides as
 * base64 (≈ +33%) inside a JSON envelope, so a 4 MB image is ≈ 5.3 MB on the wire. 20 MB leaves
 * ample headroom on a 128 MB isolate.
 */
export const MAX_REQUEST_BYTES = 20 * 1024 * 1024
