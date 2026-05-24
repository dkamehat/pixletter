import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import {
  emails,
  opens,
  links,
  clicks,
  optouts,
  apiKeys,
  users,
  tenants,
} from '@pixletter/db';
import { createDb } from '../lib/db';
import type { Env } from '../lib/types';

const app = new Hono<{
  Bindings: Env;
  Variables: { tenantId: string; userId: string };
}>();

/**
 * DELETE /api/account/data
 * GDPR 第17条: データ削除リクエスト（FR-P2-34）。
 * 認証済みユーザーの全トラッキングデータを削除する。
 * テナント自体は soft-delete（isSuspended=true）。
 */
app.delete('/data', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  // 削除順序: FK制約に従って子テーブルから削除
  // 1. clicks (→ links.id)
  const tenantLinks = await db
    .select({ id: links.id })
    .from(links)
    .where(eq(links.tenantId, tenantId));
  for (const link of tenantLinks) {
    await db.delete(clicks).where(eq(clicks.linkId, link.id));
  }

  // 2. opens (→ emails.id)
  await db.delete(opens).where(eq(opens.tenantId, tenantId));

  // 3. links (→ emails.id)
  await db.delete(links).where(eq(links.tenantId, tenantId));

  // 4. emails
  await db.delete(emails).where(eq(emails.tenantId, tenantId));

  // 5. optouts
  await db.delete(optouts).where(eq(optouts.tenantId, tenantId));

  // 6. apiKeys
  await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));

  // 7. users (pixletter users table)
  await db.delete(users).where(eq(users.tenantId, tenantId));

  // 8. tenant → soft delete (preserve record for audit)
  await db
    .update(tenants)
    .set({
      isSuspended: true,
      name: '[deleted]',
      monthlyEmailCount: 0,
    })
    .where(eq(tenants.id, tenantId));

  // Note: Better Auth の ba_user/session/account テーブルは
  // Better Auth の API 経由で削除する（auth.api.deleteUser）

  return c.json({
    message: 'All tracking data has been deleted. Account suspended.',
    deletedResources: [
      'emails',
      'opens',
      'clicks',
      'links',
      'optouts',
      'apiKeys',
      'users',
    ],
  });
});

/**
 * GET /api/account/data
 * GDPR データポータビリティ: ユーザーの全データをJSON形式でエクスポート。
 */
app.get('/data', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  const [tenantData, emailData, openData, linkData, clickData, optoutData] =
    await Promise.all([
      db.select().from(tenants).where(eq(tenants.id, tenantId)).get(),
      db.select().from(emails).where(eq(emails.tenantId, tenantId)),
      db.select().from(opens).where(eq(opens.tenantId, tenantId)),
      db.select().from(links).where(eq(links.tenantId, tenantId)),
      db.select().from(clicks).where(eq(clicks.tenantId, tenantId)),
      db.select().from(optouts).where(eq(optouts.tenantId, tenantId)),
    ]);

  return c.json({
    exportedAt: new Date().toISOString(),
    tenant: tenantData,
    emails: emailData,
    opens: openData,
    links: linkData,
    clicks: clickData,
    optouts: optoutData,
  });
});

/**
 * GET /api/account/usage
 * FR-P2-13: 利用状況（月間送信数 / 上限）を返却。
 */
app.get('/usage', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  const tenant = await db
    .select({
      plan: tenants.plan,
      monthlyEmailLimit: tenants.monthlyEmailLimit,
      monthlyEmailCount: tenants.monthlyEmailCount,
      resetAt: tenants.resetAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  return c.json(tenant);
});

export default app;
