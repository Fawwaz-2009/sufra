import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core"

import type { MealAnalysis } from "../meal-analysis/schema"

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

export const userProfile = sqliteTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  language: text("language", { enum: ["en", "ar"] })
    .notNull()
    .default("en"),
  numeralSystem: text("numeral_system", { enum: ["western", "eastern"] })
    .notNull()
    .default("western"),
  sex: text("sex", { enum: ["male", "female", "unspecified"] }).notNull(),
  age: integer("age").notNull(),
  heightCm: integer("height_cm").notNull(),
  displayHeightUnit: text("display_height_unit", { enum: ["cm", "imperial"] })
    .notNull()
    .default("cm"),
  weightKg: real("weight_kg").notNull(),
  displayWeightUnit: text("display_weight_unit", { enum: ["kg", "lb"] })
    .notNull()
    .default("kg"),
  activityLevel: text("activity_level", {
    enum: ["sedentary", "light", "moderate", "active"],
  }).notNull(),
  goal: text("goal", { enum: ["lose", "maintain", "gain"] }).notNull(),
  weeklyRateKg: real("weekly_rate_kg"),
  maintenanceKcal: integer("maintenance_kcal").notNull(),
  targetKcal: integer("target_kcal").notNull(),
  onboardedAt: integer("onboarded_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

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
    analysisStatus: text("analysis_status", {
      enum: ["pending", "analyzed", "failed"],
    })
      .notNull()
      .default("pending"),
    aiAnalysis: text("ai_analysis", { mode: "json" }).$type<MealAnalysis>(),
    analysisError: text("analysis_error"),
    override: text("override", { mode: "json" }).$type<MealOverride>(),
    kcalTotal: real("kcal_total"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("meal_user_captured_idx").on(t.userId, t.capturedAt)]
)

export const appSettings = sqliteTable(
  "app_settings",
  {
    id: integer("id").primaryKey(),
    visionModelId: text("vision_model_id")
      .notNull()
      .default("google/gemini-2.5-flash"),
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
