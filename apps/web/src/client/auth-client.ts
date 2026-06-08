import { createAuthClient } from "better-auth/react"
import { adminClient, usernameClient } from "better-auth/client/plugins"
import { ac, host, member } from "../worker/auth/permissions.ts"

/**
 * Better Auth's browser client, matching the server's no-email username + admin setup (ADR 0010). The
 * `ac` / roles come from the SAME browser-safe `worker/auth/permissions.ts` the worker instance uses, so
 * client and server agree on the role set. No email plugin — sign-in is `authClient.signIn.username`.
 */
export const authClient = createAuthClient({
  plugins: [usernameClient(), adminClient({ ac, roles: { host, member } })]
})

export type Session = typeof authClient.$Infer.Session
