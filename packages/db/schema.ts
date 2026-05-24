/**
 * pixletter Database Schema
 *
 * Database: Cloudflare D1 (SQLite)
 * ORM: Drizzle ORM
 *
 * Phase 1: シングルテナント運用 (tenant_id = "self")
 * Phase 2: マルチテナント運用 (tenant_id = 認証ユーザーごと)
 *
 * Phase 2 を見据えて、Phase 1 段階から tenant_id カラムを含める。
 * これにより Phase 2 でのマイグレーションは tenants テーブル投入のみで済む。
 * ADR-003 参照。
 *
 * Migrations: `pnpm drizzle-kit generate` で packages/db/migrations/ に生成。
 * Cloudflare D1 適用: `wrangler d1 execute pixletter-db --file=...`
 */

import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// =====================================================
// tenants: テナント（Phase 1 は "self" のみ、Phase 2 でユーザー単位）
// =====================================================
export const tenants = sqliteTable(
  'tenants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name'),
    plan: text('plan', { enum: ['free', 'pro', 'self'] })
      .default('self')
      .notNull(),
    monthlyEmailLimit: integer('monthly_email_limit').default(500).notNull(),
    monthlyEmailCount: integer('monthly_email_count').default(0).notNull(),
    resetAt: integer('reset_at', { mode: 'timestamp' })
      .default(sql`(unixepoch() + 2592000)`)
      .notNull(),
    isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    planIdx: index('tenants_plan_idx').on(t.plan),
  }),
);

// =====================================================
// users: 認証ユーザー
// =====================================================
export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    name: text('name'),

    // Phase 2: OAuth 統合用
    oauthProvider: text('oauth_provider', {
      enum: ['google', 'github', 'email'],
    }),
    oauthId: text('oauth_id'),

    slackWebhookUrl: text('slack_webhook_url'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
    tenantIdx: index('users_tenant_idx').on(t.tenantId),
    oauthIdx: index('users_oauth_idx').on(t.oauthProvider, t.oauthId),
  }),
);

// =====================================================
// apiKeys: Chrome 拡張機能用 API キー
// =====================================================
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(),
    name: text('name'),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    isRevoked: integer('is_revoked', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('api_keys_tenant_idx').on(t.tenantId),
    keyHashIdx: index('api_keys_key_hash_idx').on(t.keyHash),
  }),
);

// =====================================================
// emails: 送信メールのメタデータ
// =====================================================
export const emails = sqliteTable(
  'emails',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    trackingId: text('tracking_id')
      .notNull()
      .unique()
      .$defaultFn(() => createId()),

    subject: text('subject'),
    recipient: text('recipient').notNull(),
    recipientName: text('recipient_name'),
    gmailMessageId: text('gmail_message_id'),
    threadId: text('thread_id'),
    tag: text('tag'),

    sentAt: integer('sent_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('emails_tenant_idx').on(t.tenantId),
    userIdx: index('emails_user_idx').on(t.userId),
    trackingIdx: index('emails_tracking_idx').on(t.trackingId),
    sentAtIdx: index('emails_sent_at_idx').on(t.sentAt),
    recipientIdx: index('emails_recipient_idx').on(t.recipient),
    tenantSentAtIdx: index('emails_tenant_sent_at_idx').on(t.tenantId, t.sentAt),
  }),
);

// =====================================================
// opens, links, clicks, optouts: 全テーブルに tenant_id 適用
// =====================================================
export const opens = sqliteTable(
  'opens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    emailId: text('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),

    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    isGmailProxy: integer('is_gmail_proxy', { mode: 'boolean' }).default(false),

    openedAt: integer('opened_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('opens_tenant_idx').on(t.tenantId),
    emailIdx: index('opens_email_idx').on(t.emailId),
    openedAtIdx: index('opens_opened_at_idx').on(t.openedAt),
  }),
);

export const links = sqliteTable(
  'links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    emailId: text('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),

    trackingId: text('tracking_id')
      .notNull()
      .unique()
      .$defaultFn(() => createId()),

    originalUrl: text('original_url').notNull(),
    label: text('label'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('links_tenant_idx').on(t.tenantId),
    emailIdx: index('links_email_idx').on(t.emailId),
    trackingIdx: index('links_tracking_idx').on(t.trackingId),
  }),
);

export const clicks = sqliteTable(
  'clicks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    linkId: text('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),

    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),

    clickedAt: integer('clicked_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('clicks_tenant_idx').on(t.tenantId),
    linkIdx: index('clicks_link_idx').on(t.linkId),
    clickedAtIdx: index('clicks_clicked_at_idx').on(t.clickedAt),
  }),
);

export const optouts = sqliteTable(
  'optouts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    recipientEmail: text('recipient_email').notNull(),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (t) => ({
    tenantIdx: index('optouts_tenant_idx').on(t.tenantId),
    recipientIdx: index('optouts_recipient_idx').on(t.recipientEmail),
    tenantRecipientIdx: index('optouts_tenant_recipient_idx').on(
      t.tenantId,
      t.recipientEmail,
    ),
  }),
);

// =====================================================
// Type exports
// =====================================================
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export type Open = typeof opens.$inferSelect;
export type NewOpen = typeof opens.$inferInsert;

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;

export type Click = typeof clicks.$inferSelect;
export type NewClick = typeof clicks.$inferInsert;

export type Optout = typeof optouts.$inferSelect;
export type NewOptout = typeof optouts.$inferInsert;

// =====================================================
// 集計用の型（ダッシュボード API レスポンス）
// =====================================================
export interface EmailWithStats extends Email {
  openCount: number;
  firstOpenedAt: Date | null;
  lastOpenedAt: Date | null;
  clickCount: number;
  isOpened: boolean;
}

export interface DailyStats {
  date: string;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  openRate: number;
  clickRate: number;
}

// =====================================================
// Phase 1 初期データ（self テナント）
//
// Phase 1 着手時、Day 1 のマイグレーション後に以下を INSERT する:
//   INSERT INTO tenants (id, name, plan, monthly_email_limit, reset_at)
//   VALUES ('self', 'Self', 'self', 100000, unixepoch() + 2592000);
// =====================================================
export const SELF_TENANT_ID = 'self' as const;
export const SELF_TENANT_DEFAULTS = {
  id: SELF_TENANT_ID,
  name: 'Self',
  plan: 'self' as const,
  monthlyEmailLimit: 100000,
} satisfies NewTenant;
