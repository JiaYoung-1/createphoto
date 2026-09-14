CREATE TABLE `edit_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`parent` text NOT NULL,
	`prompt` text NOT NULL,
	`references` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`version` text,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`project`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `jobs_project` ON `edit_jobs` (`project`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_running_edit` ON `edit_jobs` (`status`) WHERE "edit_jobs"."status" = 'running';