import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

import type { MealAnalysis } from "../meals/estimator/schema"
import {
  ACTIVITY_LEVELS,
  HEIGHT_UNITS,
  SEX_VALUES,
  WEIGHT_UNITS,
} from "../profile/isomorphic/constants"

export type MealOverride = {
  kcal?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Stored as `<username>@sufra.local`. Non-routable; better-auth requires
  // the column but we never send mail.
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("displayUsername"),
  role: text("role", { enum: ["host", "user"] })
    .notNull()
    .default("user"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("banReason"),
  banExpires: integer("banExpires", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
})

// Append-only history of each Member's profile inputs. Every Onboarding and
// every Profile edit inserts a new row; `effective_from` (Member's local date)
// determines which row is active for any given day. Onboarding inserts a row
// with effective_from = today; subsequent edits insert with
// effective_from = tomorrow (today's plan stays sealed — see ADR 0002).
// There is no separate "current profile" table — the latest row by
// effective_from IS the current state (see ADR 0001).
// Derived values (Maintenance, Target, macro grams) are computed on demand
// from these inputs by the shared formula module (see ADR 0003).
export const profileLog = sqliteTable(
  "profile_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD, Member's local TZ
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    sex: text("sex", { enum: SEX_VALUES }).notNull(),
    birthday: text("birthday").notNull(), // YYYY-MM-DD
    heightCm: integer("height_cm").notNull(),
    displayHeightUnit: text("display_height_unit", { enum: HEIGHT_UNITS })
      .notNull()
      .default("cm"),
    weightKg: real("weight_kg").notNull(),
    displayWeightUnit: text("display_weight_unit", { enum: WEIGHT_UNITS })
      .notNull()
      .default("kg"),
    activityLevel: text("activity_level", {
      enum: ACTIVITY_LEVELS,
    }).notNull(),
    goalWeightKg: real("goal_weight_kg").notNull(),
    weeklyRateKg: real("weekly_rate_kg").notNull().default(0),
  },
  (t) => [
    // UNIQUE(user_id, effective_from): a Member editing twice on the same day
    // both target the same `tomorrow` row; second write overwrites via
    // ON CONFLICT UPDATE.
    uniqueIndex("profile_log_user_effective_idx").on(
      t.userId,
      t.effectiveFrom
    ),
  ]
)

export const weightLog = sqliteTable(
  "weight_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weightKg: real("weight_kg").notNull(),
    loggedAt: text("logged_at").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("weight_log_user_logged_idx").on(t.userId, t.loggedAt)]
)

export const meal = sqliteTable(
  "meal",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    capturedAt: text("captured_at").notNull(),
    photoR2Key: text("photo_r2_key").notNull(),
    aiAnalysis: text("ai_analysis", { mode: "json" })
      .$type<MealAnalysis>()
      .notNull(),
    override: text("override", { mode: "json" }).$type<MealOverride>(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("meal_user_captured_idx").on(t.userId, t.capturedAt)]
)

export const appSettings = sqliteTable(
  "app_settings",
  {
    id: integer("id").primaryKey(),
    visionModelId: text("vision_model_id").notNull(),
    familyName: text("family_name").notNull().default("My"),
    // defaultLanguage retained for the v2 multi-language work; unused in v1.
    defaultLanguage: text("default_language", { enum: ["en", "ar"] })
      .notNull()
      .default("en"),
    deficitSafetyWarningEnabled: integer("deficit_safety_warning_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [check("app_settings_singleton", sql`${t.id} = 1`)]
)

// Single-use, Host-issued URL token that lets a Member set a password.
// Backs both the initial invite (Member has no account row yet) and password
// reset (Member already has an account) flows — see CONTEXT.md "Password link".
// UNIQUE on userId enforces "one active link per Member" — regenerate replaces
// in place via ON CONFLICT UPDATE. Cascade on user deletion: a deleted Member
// loses any pending password link.
export const passwordLink = sqliteTable("password_link", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
})

// Append-only audit log of every estimateMeal() invocation. Decoupled from
// meals and users on purpose — the bill is ground truth, deleting a meal or
// removing a Member must not erase the record of money spent. No FK
// constraints; userId is a soft text column.
export const inferenceRun = sqliteTable(
  "inference_run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    modelId: text("model_id").notNull(),
    kind: text("kind", { enum: ["estimate", "refinement"] }).notNull(),
    status: text("status", { enum: ["ok", "failed"] }).notNull(),
    errorCode: text("error_code"),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    costUsd: real("cost_usd").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("inference_run_created_idx").on(t.createdAt)]
)
