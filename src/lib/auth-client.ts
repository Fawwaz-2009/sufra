import { createAuthClient } from "better-auth/react"
import {
  adminClient,
  inferAdditionalFields,
  usernameClient,
} from "better-auth/client/plugins"

import { ac, host, user } from "../../worker/auth/isomorphic/permissions"
import type { createAuth } from "../../worker/auth"

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient({ ac, roles: { host, user } }),
    inferAdditionalFields<ReturnType<typeof createAuth>>(),
  ],
})

export type Session = typeof authClient.$Infer.Session
