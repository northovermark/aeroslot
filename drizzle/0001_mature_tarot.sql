CREATE TABLE `alert_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alert_matches_alert_listing` ON `alert_matches` (`alert_id`,`listing_id`);--> statement-breakpoint
CREATE TABLE `source_syncs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`last_success_at` integer,
	`last_attempt_at` integer,
	`last_error` text,
	`imported_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `source` text DEFAULT 'operator' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `source_id` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `currency` text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `arrival_at` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `tail_number` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `from_lat` real;--> statement-breakpoint
ALTER TABLE `listings` ADD `from_lng` real;--> statement-breakpoint
ALTER TABLE `listings` ADD `to_lat` real;--> statement-breakpoint
ALTER TABLE `listings` ADD `to_lng` real;--> statement-breakpoint
CREATE INDEX `idx_listings_live_departure` ON `listings` (`status`,`departure_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_listings_source_id` ON `listings` (`source`,`operator_id`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_listing_user` ON `bookings` (`listing_id`,`user_id`);