CREATE TABLE `market_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`data_date` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_date` ON `market_snapshots` (`data_date`,`created_at`);--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`target_date` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_simulations_created` ON `simulations` (`created_at`);