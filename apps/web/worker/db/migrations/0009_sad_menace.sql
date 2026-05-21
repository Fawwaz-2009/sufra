ALTER TABLE `meal` ADD `saved_at` integer;--> statement-breakpoint
CREATE INDEX `meal_user_saved_idx` ON `meal` (`user_id`,`saved_at`);