CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_code` text,
	`to_code` text,
	`max_price` real,
	`min_seats` integer DEFAULT 1,
	`active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`stripe_session_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text,
	`from` text NOT NULL,
	`from_code` text NOT NULL,
	`to` text NOT NULL,
	`to_code` text NOT NULL,
	`departure_at` text NOT NULL,
	`aircraft` text NOT NULL,
	`seats` integer NOT NULL,
	`price` real NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text DEFAULT 'traveller' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);