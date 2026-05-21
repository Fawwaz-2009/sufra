-- M2: replace per-account current-state `user_profile` with an append-only
-- snapshot history table `profile_log`, and drop the denormalized
-- `meal.kcal_total` column. See ADR 0001 + ADR 0003.
--
-- Hand-rolled because drizzle-kit's rename-detection prompt blocks in
-- non-TTY shells. Snapshot regeneration on next `pnpm db:generate` may
-- emit a no-op migration which can be deleted.

DROP TABLE `user_profile`;--> statement-breakpoint
CREATE TABLE `profile_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` integer NOT NULL,
	`sex` text NOT NULL,
	`birthday` text NOT NULL,
	`height_cm` integer NOT NULL,
	`display_height_unit` text DEFAULT 'cm' NOT NULL,
	`weight_kg` real NOT NULL,
	`display_weight_unit` text DEFAULT 'kg' NOT NULL,
	`activity_level` text NOT NULL,
	`goal_weight_kg` real NOT NULL,
	`weekly_rate_kg` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_log_user_effective_idx` ON `profile_log` (`user_id`, `effective_from`);--> statement-breakpoint
ALTER TABLE `meal` DROP COLUMN `kcal_total`;
