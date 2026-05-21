CREATE TABLE `inference_run` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`model_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`prompt_tokens` integer NOT NULL,
	`completion_tokens` integer NOT NULL,
	`cost_usd` real NOT NULL,
	`latency_ms` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inference_run_created_idx` ON `inference_run` (`created_at`);
