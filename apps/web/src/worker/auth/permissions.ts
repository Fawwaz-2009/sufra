import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access"
import { createAccessControl } from "better-auth/plugins/access"

/**
 * The Better Auth admin-plugin access controller and the two Sufra roles. This governs the admin
 * plugin's OWN endpoints (who may call `admin.createUser`, etc.) — NOT the app's resource
 * authorization, which is uniform 404 scoping (ADR 0013). Browser-safe: imported by the worker
 * auth instance AND the frontend auth-client, so they agree on the role set.
 *
 * `host` carries the admin statements (provisions Members, resets passwords); `member` carries the
 * default user statements. The schema role values are `host | member`.
 */
const statement = { ...defaultStatements } as const

export const ac = createAccessControl(statement)

export const host = ac.newRole({ ...adminAc.statements })
export const member = ac.newRole({ ...userAc.statements })
