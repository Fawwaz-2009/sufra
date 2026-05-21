import { eq } from "drizzle-orm"

import { createDb } from "../db"
import { appSettings, passwordLink, user } from "../db/schema"
import { ERROR_CODES } from "../errors"

export const PASSWORD_LINK_TTL_MS = 24 * 60 * 60 * 1000

type Db = ReturnType<typeof createDb>

export async function upsertPasswordLink(args: {
  db: Db
  userId: string
  createdBy: string
}) {
  const token = generateToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PASSWORD_LINK_TTL_MS)
  await args.db
    .insert(passwordLink)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      token,
      createdBy: args.createdBy,
      createdAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: passwordLink.userId,
      set: {
        token,
        createdBy: args.createdBy,
        createdAt: now,
        expiresAt,
      },
    })
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function loadValidLink(
  db: Db,
  token: string
): Promise<
  | { ok: false; error: string }
  | { ok: true; userId: string; username: string; familyName: string }
> {
  const [link] = await db
    .select({ userId: passwordLink.userId, expiresAt: passwordLink.expiresAt })
    .from(passwordLink)
    .where(eq(passwordLink.token, token))
  if (!link) return { ok: false, error: ERROR_CODES.LINK_INVALID }
  if (link.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: ERROR_CODES.LINK_EXPIRED }
  }
  const [u] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, link.userId))
  if (!u?.username) return { ok: false, error: ERROR_CODES.LINK_INVALID }

  const [settings] = await db
    .select({ familyName: appSettings.familyName })
    .from(appSettings)
    .where(eq(appSettings.id, 1))

  return {
    ok: true,
    userId: link.userId,
    username: u.username,
    familyName: settings?.familyName ?? "My",
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  // base64url — no padding, URL-safe alphabet.
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
