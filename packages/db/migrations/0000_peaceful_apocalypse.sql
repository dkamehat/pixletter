CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`name` text,
	`last_used_at` integer,
	`expires_at` integer,
	`is_revoked` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_tenant_idx` ON `api_keys` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `clicks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`link_id` text NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`clicked_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clicks_tenant_idx` ON `clicks` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `clicks_link_idx` ON `clicks` (`link_id`);--> statement-breakpoint
CREATE INDEX `clicks_clicked_at_idx` ON `clicks` (`clicked_at`);--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tracking_id` text NOT NULL,
	`subject` text,
	`recipient` text NOT NULL,
	`recipient_name` text,
	`gmail_message_id` text,
	`thread_id` text,
	`tag` text,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_tracking_id_unique` ON `emails` (`tracking_id`);--> statement-breakpoint
CREATE INDEX `emails_tenant_idx` ON `emails` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `emails_user_idx` ON `emails` (`user_id`);--> statement-breakpoint
CREATE INDEX `emails_tracking_idx` ON `emails` (`tracking_id`);--> statement-breakpoint
CREATE INDEX `emails_sent_at_idx` ON `emails` (`sent_at`);--> statement-breakpoint
CREATE INDEX `emails_recipient_idx` ON `emails` (`recipient`);--> statement-breakpoint
CREATE INDEX `emails_tenant_sent_at_idx` ON `emails` (`tenant_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email_id` text NOT NULL,
	`tracking_id` text NOT NULL,
	`original_url` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_tracking_id_unique` ON `links` (`tracking_id`);--> statement-breakpoint
CREATE INDEX `links_tenant_idx` ON `links` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `links_email_idx` ON `links` (`email_id`);--> statement-breakpoint
CREATE INDEX `links_tracking_idx` ON `links` (`tracking_id`);--> statement-breakpoint
CREATE TABLE `opens` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email_id` text NOT NULL,
	`user_agent` text,
	`ip_hash` text,
	`is_gmail_proxy` integer DEFAULT false,
	`opened_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opens_tenant_idx` ON `opens` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `opens_email_idx` ON `opens` (`email_id`);--> statement-breakpoint
CREATE INDEX `opens_opened_at_idx` ON `opens` (`opened_at`);--> statement-breakpoint
CREATE TABLE `optouts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `optouts_tenant_idx` ON `optouts` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `optouts_recipient_idx` ON `optouts` (`recipient_email`);--> statement-breakpoint
CREATE INDEX `optouts_tenant_recipient_idx` ON `optouts` (`tenant_id`,`recipient_email`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`plan` text DEFAULT 'self' NOT NULL,
	`monthly_email_limit` integer DEFAULT 500 NOT NULL,
	`monthly_email_count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer DEFAULT (unixepoch() + 2592000) NOT NULL,
	`is_suspended` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tenants_plan_idx` ON `tenants` (`plan`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`oauth_provider` text,
	`oauth_id` text,
	`slack_webhook_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `users_oauth_idx` ON `users` (`oauth_provider`,`oauth_id`);