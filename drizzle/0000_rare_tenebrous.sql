CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`book` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_calls_owner_month` ON `calls` (`owner`,`month`);--> statement-breakpoint
CREATE INDEX `idx_calls_owner_book` ON `calls` (`owner`,`book`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_owner_kind_parent` ON `records` (`owner`,`kind`,`parent`);