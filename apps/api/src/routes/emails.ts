import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  emails,
  links,
  opens,
  clicks,
  optouts,
  tenants,
} from '@pixletter/db';
import { createId } from '@paralleldrive/cuid2';
import { createDb } from '../lib/db';
import { checkAutoBan } from '../lib/abuse';
import type { Env } from '../lib/types';

/** Sign up 後 24h は送信上限を制限（ADR-003 §4） */
const NEWBIE_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEWBIE_LIMIT = 10;

const app = new Hono<{
  Bindings: Env;
  Variables: { tenantId: string; userId: string };
}>();

/**
 * POST /api/emails
 * メール送信メタデータを登録し、tracking_id と各リンクの tracking URL を返却する（FR-API-01）。
 * Phase 1: tenant_id = "self", userId は固定ダミー値。
 */
app.post('/', async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json<{
    subject?: string;
    recipient: string;
    recipientName?: string;
    gmailMessageId?: string;
    threadId?: string;
    tag?: string;
    urls?: Array<{ url: string; label?: string }>;
  }>();

  if (!body.recipient) {
    return c.json({ error: 'recipient is required' }, 400);
  }

  const tenantId = c.get('tenantId');
  const userId = c.get('userId');

  // FR-P2-02: 月間送信上限チェック（self プランは実質無制限）
  const tenant = await db
    .select({
      plan: tenants.plan,
      monthlyEmailLimit: tenants.monthlyEmailLimit,
      monthlyEmailCount: tenants.monthlyEmailCount,
      resetAt: tenants.resetAt,
      createdAt: tenants.createdAt,
      isSuspended: tenants.isSuspended,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 403);
  }

  if (tenant.isSuspended) {
    return c.json({ error: 'Account suspended' }, 403);
  }

  const now = new Date();

  // reset_at を過ぎたらカウンタリセット
  if (tenant.resetAt && now > tenant.resetAt) {
    await db
      .update(tenants)
      .set({
        monthlyEmailCount: 0,
        resetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(tenants.id, tenantId));
    tenant.monthlyEmailCount = 0;
  }

  // Sign up 後 24h 制限（ADR-003 §4: 新規アカウント abuse 対策）
  const effectiveLimit =
    tenant.createdAt &&
    now.getTime() - tenant.createdAt.getTime() < NEWBIE_WINDOW_MS
      ? Math.min(NEWBIE_LIMIT, tenant.monthlyEmailLimit)
      : tenant.monthlyEmailLimit;

  if (tenant.monthlyEmailCount >= effectiveLimit) {
    return c.json(
      {
        error: 'Monthly email limit reached',
        limit: effectiveLimit,
        count: tenant.monthlyEmailCount,
        resetsAt: tenant.resetAt,
      },
      429,
    );
  }

  const trackingId = createId();
  const emailId = createId();

  await db.insert(emails).values({
    id: emailId,
    tenantId,
    userId,
    trackingId,
    subject: body.subject,
    recipient: body.recipient,
    recipientName: body.recipientName,
    gmailMessageId: body.gmailMessageId,
    threadId: body.threadId,
    tag: body.tag,
  });

  // 月間送信カウンタをインクリメント
  await db
    .update(tenants)
    .set({ monthlyEmailCount: sql`${tenants.monthlyEmailCount} + 1` })
    .where(eq(tenants.id, tenantId));

  // リンク追跡用 URL を生成
  const trackedLinks: Array<{
    originalUrl: string;
    trackingUrl: string;
    label?: string;
  }> = [];

  if (body.urls && body.urls.length > 0) {
    const baseUrl = c.env.PIXEL_DOMAIN
      ? `https://${c.env.PIXEL_DOMAIN}`
      : new URL(c.req.url).origin;

    for (const urlEntry of body.urls) {
      const linkTrackingId = createId();
      const linkId = createId();

      await db.insert(links).values({
        id: linkId,
        tenantId: tenantId,
        emailId,
        trackingId: linkTrackingId,
        originalUrl: urlEntry.url,
        label: urlEntry.label,
      });

      trackedLinks.push({
        originalUrl: urlEntry.url,
        trackingUrl: `${baseUrl}/r/${linkTrackingId}`,
        label: urlEntry.label,
      });
    }
  }

  const baseUrl = c.env.PIXEL_DOMAIN
    ? `https://${c.env.PIXEL_DOMAIN}`
    : new URL(c.req.url).origin;

  // FR-P2-30: opt-out URL を強制返却（Chrome 拡張がフッター HTML をメールに挿入）
  const optoutUrl = `${baseUrl}/optout/${emailId}`;

  const isHosted = (c.env.HOSTING_MODE || 'self') === 'hosted';

  return c.json(
    {
      id: emailId,
      trackingId,
      pixelUrl: `${baseUrl}/i/${trackingId}.gif`,
      optoutUrl,
      optoutHtml: `<div style="font-size:11px;color:#999;margin-top:16px;border-top:1px solid #eee;padding-top:8px;">` +
        `<a href="${optoutUrl}" style="color:#999;">Unsubscribe from tracking</a></div>`,
      forceOptoutFooter: isHosted, // FR-P3-10: hosted版ではフッター強制
      links: trackedLinks,
    },
    201,
  );
});

/**
 * GET /api/emails
 * 送信メール一覧を取得する（FR-API-04）。
 * 開封数・クリック数を集計して返却。
 */
app.get('/', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');
  const limit = Math.min(Number(c.req.query('limit') ?? '50'), 100);
  const offset = Number(c.req.query('offset') ?? '0');

  const results = await db
    .select({
      id: emails.id,
      trackingId: emails.trackingId,
      subject: emails.subject,
      recipient: emails.recipient,
      recipientName: emails.recipientName,
      tag: emails.tag,
      sentAt: emails.sentAt,
      openCount: sql<number>`(SELECT COUNT(*) FROM opens WHERE opens.email_id = emails.id)`,
      clickCount: sql<number>`(SELECT COUNT(*) FROM clicks c JOIN links l ON c.link_id = l.id WHERE l.email_id = emails.id)`,
      firstOpenedAt: sql<number | null>`(SELECT MIN(opened_at) FROM opens WHERE opens.email_id = emails.id)`,
    })
    .from(emails)
    .where(eq(emails.tenantId, tenantId))
    .orderBy(desc(emails.sentAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: results,
    pagination: { limit, offset },
  });
});

/**
 * GET /api/emails/:id
 * 個別メールの詳細を取得する（FR-API-05）。
 * 開封タイムライン・リンク一覧・クリック詳細を含む。
 */
app.get('/:id', async (c) => {
  const emailId = c.req.param('id');
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  const email = await db
    .select()
    .from(emails)
    .where(
      and(eq(emails.id, emailId), eq(emails.tenantId, tenantId)),
    )
    .get();

  if (!email) {
    return c.json({ error: 'Email not found' }, 404);
  }

  const [emailOpens, emailLinks] = await Promise.all([
    db
      .select({
        id: opens.id,
        userAgent: opens.userAgent,
        ipHash: opens.ipHash,
        isGmailProxy: opens.isGmailProxy,
        openedAt: opens.openedAt,
      })
      .from(opens)
      .where(eq(opens.emailId, emailId))
      .orderBy(desc(opens.openedAt)),
    db
      .select({
        id: links.id,
        trackingId: links.trackingId,
        originalUrl: links.originalUrl,
        label: links.label,
        clickCount: sql<number>`(SELECT COUNT(*) FROM clicks WHERE clicks.link_id = ${links.id})`,
      })
      .from(links)
      .where(eq(links.emailId, emailId)),
  ]);

  return c.json({
    ...email,
    opens: emailOpens,
    links: emailLinks,
    openCount: emailOpens.length,
  });
});

/**
 * POST /api/emails/:id/optout
 * 受信者からのオプトアウトリクエストを受け付ける（FR-API-06）。
 * NFR-SEC-05: 追跡停止権を尊重する。
 */
app.post('/:id/optout', async (c) => {
  const emailId = c.req.param('id');
  const db = createDb(c.env.DB);
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}));

  const email = await db
    .select({ recipient: emails.recipient, tenantId: emails.tenantId })
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!email) {
    return c.json({ error: 'Email not found' }, 404);
  }

  // 重複チェック
  const existing = await db
    .select({ id: optouts.id })
    .from(optouts)
    .where(
      and(
        eq(optouts.tenantId, email.tenantId),
        eq(optouts.recipientEmail, email.recipient),
      ),
    )
    .get();

  if (existing) {
    return c.json({ message: 'Already opted out' }, 200);
  }

  await db.insert(optouts).values({
    tenantId: email.tenantId,
    recipientEmail: email.recipient,
    reason: (body as { reason?: string }).reason,
  });

  // ADR-003 §4: opt-out 10件超で自動凍結
  await checkAutoBan(db, email.tenantId);

  return c.json({ message: 'Opted out successfully' }, 201);
});

export default app;
