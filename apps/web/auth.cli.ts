import { betterAuth } from "better-auth"
import { admin, username } from "better-auth/plugins"
import Database from "better-sqlite3"

/**
 * GENERATION-ONLY Better Auth config, used solely by `better-auth generate` to emit the SQL
 * for Better Auth's own tables. NEVER imported by the worker.
 *
 * The real runtime config (src/worker/auth/instance.ts) binds to `env.DB`, a D1 binding that
 * only exists during a request — the CLI can't see it. So here we point Better Auth at a
 * throwaway local SQLite file (better-sqlite3, auto-detected as the "sqlite" dialect) purely so
 * the generator knows which SQL flavor to emit.
 *
 * IMPORTANT: keep the providers/plugins below in lockstep with src/worker/auth/instance.ts —
 * they determine which tables/columns are generated. `secondaryStorage` (KV sessions) is a
 * runtime concern and is intentionally omitted (it does not affect the schema; the `session`
 * table is generated either way).
 *
 * Regenerate after any Better Auth upgrade or new plugin:
 *   pnpm --filter @sufra/web run auth:generate   # -> migrations/0001_better_auth.sql
 */
export const auth = betterAuth({
  database: new Database("./.auth-cli.sqlite"),
  // Lockstep with instance.ts. The core "user" model is renamed to "identities" (the credential);
  // the app owns a separate `users` person table (ADR 0010). No email is ever sent, but
  // emailAndPassword stays enabled — sign-in is by username (the username plugin), and the
  // non-routable <username>@sufra.local address satisfies Better Auth's required email column.
  emailAndPassword: { enabled: true },
  user: { modelName: "identities" },
  // username() adds username/displayUsername; admin() adds role/banned/banReason/banExpires on
  // identities and impersonatedBy on session. The ac/roles config is runtime authz, not schema,
  // so it is omitted here.
  plugins: [username(), admin()]
})
