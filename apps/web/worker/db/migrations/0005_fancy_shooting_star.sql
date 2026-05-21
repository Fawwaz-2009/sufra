PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`vision_model_id` text NOT NULL,
	`default_language` text DEFAULT 'en' NOT NULL,
	`deficit_safety_warning_enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK("__new_app_settings"."id" = 1)
);
--> statement-breakpoint
INSERT INTO `__new_app_settings`("id", "vision_model_id", "default_language", "deficit_safety_warning_enabled", "updated_at") SELECT "id", "vision_model_id", "default_language", "deficit_safety_warning_enabled", "updated_at" FROM `app_settings`;--> statement-breakpoint
DROP TABLE `app_settings`;--> statement-breakpoint
ALTER TABLE `__new_app_settings` RENAME TO `app_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- One-time bump: rows stuck on the stale schema default get moved to the new
-- canonical default. Hosts who explicitly picked a different model are left
-- alone.
UPDATE `app_settings` SET `vision_model_id` = 'google/gemini-3-flash-preview' WHERE `vision_model_id` = 'google/gemini-2.5-flash';