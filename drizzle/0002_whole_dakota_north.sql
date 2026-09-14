CREATE TABLE `companion` (
	`id` integer PRIMARY KEY NOT NULL,
	`worker` text NOT NULL,
	`state` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `edit_jobs` ADD `phase` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `edit_jobs` ADD `worker` text;--> statement-breakpoint
ALTER TABLE `edit_jobs` ADD `conversation` text;