import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { emails, opens, links, clicks, optouts } from '@mailtrack/db';
import { createDb } from '../lib/db';
import { hashIp } from '../lib/hash';
import { notifySlack } from '../lib/notify';
import { TRANSPARENT_GIF } from '../lib/pixel';
import type { Env } from '../lib/types';

const app = new Hono<{ Bindings: Env }>();

/**
 * ピクセル開封ハンドラ（共通ロジック）。
 * FR-P3-01: /i/:id（難読化パス）と /pixel/:id（後方互換）で共有。
 */
async function handlePixel(c: any) {
  const raw = c.req.param('trackingId');
  const trackingId = raw.endsWith('.gif') ? raw.slice(0, -4) : raw;
  const db = createDb(c.env.DB);

  const email = await db
    .select({ id: emails.id, tenantId: emails.tenantId })
    .from(emails)
    .where(eq(emails.trackingId, trackingId))
    .get();

  if (email) {
    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    const userAgent = c.req.header('User-Agent') ?? '';
    const isGmailProxy = userAgent.includes('GoogleImageProxy');

    c.executionCtx.waitUntil(
      hashIp(ip).then(async (ipHash) => {
        await db.insert(opens).values({
          tenantId: email.tenantId,
          emailId: email.id,
          userAgent,
          ipHash,
          isGmailProxy,
        });
        await notifySlack(db, email.id, c.env.SLACK_WEBHOOK_URL);
      }),
    );
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

// FR-P3-01: 難読化パス（推奨）
app.get('/i/:trackingId', handlePixel);
// 後方互換パス
app.get('/pixel/:trackingId', handlePixel);

/**
 * GET /r/:id
 * 原 URL に 302 リダイレクトし、クリックログを記録する（FR-API-03）。
 *
 * Phase 2: link.tracking_id でグローバル検索、tenant_id は結果から取得。
 */
app.get('/r/:id', async (c) => {
  const trackingId = c.req.param('id');
  const db = createDb(c.env.DB);

  const link = await db
    .select({
      id: links.id,
      tenantId: links.tenantId,
      originalUrl: links.originalUrl,
      emailId: links.emailId,
    })
    .from(links)
    .where(eq(links.trackingId, trackingId))
    .get();

  if (!link) {
    return c.json({ error: 'Link not found' }, 404);
  }

  // optout チェック
  const email = await db
    .select({ recipient: emails.recipient })
    .from(emails)
    .where(eq(emails.id, link.emailId))
    .get();

  if (email) {
    const optout = await db
      .select({ id: optouts.id })
      .from(optouts)
      .where(eq(optouts.recipientEmail, email.recipient))
      .get();

    if (!optout) {
      const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
      const userAgent = c.req.header('User-Agent') ?? '';

      c.executionCtx.waitUntil(
        hashIp(ip).then((ipHash) =>
          db.insert(clicks).values({
            tenantId: link.tenantId,
            linkId: link.id,
            userAgent,
            ipHash,
          }),
        ),
      );
    }
  }

  return c.redirect(link.originalUrl, 302);
});

export default app;
