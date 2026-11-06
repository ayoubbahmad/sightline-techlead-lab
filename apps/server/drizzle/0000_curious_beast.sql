CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scan_run_id` text NOT NULL,
	`first_seen_scan_run_id` text NOT NULL,
	`category` text NOT NULL,
	`tool` text NOT NULL,
	`rule_id` text,
	`severity` text NOT NULL,
	`file` text,
	`line` integer,
	`message` text NOT NULL,
	`fingerprint` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`status` text NOT NULL,
	`ignore_reason` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_seen_scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`framework` text NOT NULL,
	`rn_version` text,
	`expo_sdk_version` text,
	`package_manager` text NOT NULL,
	`has_typescript` integer NOT NULL,
	`created_at` text NOT NULL,
	`last_visited_at` text,
	`last_scanned_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE TABLE `scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`new_finding_count` integer DEFAULT 0 NOT NULL,
	`fixed_finding_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tool_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_run_id` text NOT NULL,
	`tool` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`duration_ms` real,
	`error` text,
	FOREIGN KEY (`scan_run_id`) REFERENCES `scan_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
