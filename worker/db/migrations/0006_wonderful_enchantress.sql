CREATE TABLE `password_link` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_link_user_id_unique` ON `password_link` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `password_link_token_unique` ON `password_link` (`token`);--> statement-breakpoint
ALTER TABLE `app_settings` ADD `family_name` text DEFAULT 'My' NOT NULL;