import {
  adminAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access"
import { createAccessControl } from "better-auth/plugins/access"

const statement = { ...defaultStatements } as const

export const ac = createAccessControl(statement)

export const host = ac.newRole({ ...adminAc.statements })
export const user = ac.newRole({ ...userAc.statements })
