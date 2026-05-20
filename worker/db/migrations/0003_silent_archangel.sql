PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_meal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`photo_r2_key` text NOT NULL,
	`ai_analysis` text NOT NULL,
	`override` text,
	`kcal_total` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_meal`("id", "user_id", "captured_at", "photo_r2_key", "ai_analysis", "override", "kcal_total", "created_at") SELECT "id", "user_id", "captured_at", "photo_r2_key", "ai_analysis", "override", "kcal_total", "created_at" FROM `meal` WHERE "analysis_status" = 'analyzed' AND "ai_analysis" IS NOT NULL AND "kcal_total" IS NOT NULL;--> statement-breakpoint
DROP TABLE `meal`;--> statement-breakpoint
ALTER TABLE `__new_meal` RENAME TO `meal`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `meal_user_captured_idx` ON `meal` (`user_id`,`captured_at`);