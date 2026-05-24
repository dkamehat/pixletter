import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { emails, optouts } from '@pixletter/db';
import { createDb } from '../lib/db';
import { checkAutoBan } from '../lib/abuse';
import type { Env } from '../lib/types';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /optout/:emailId
 * 受信者がブラウザでアクセスする opt-out ページ（FR-P2-30）。
 * /api/* 外に配置し、認証不要。
 */
app.get('/:emailId', async (c) => {
  const emailId = c.req.param('emailId');
  const db = createDb(c.env.DB);

  const email = await db
    .select({ id: emails.id, recipient: emails.recipient, tenantId: emails.tenantId })
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!email) {
    return c.html(page('Not Found', '<p>This tracking link is no longer valid.</p>'), 404);
  }

  // 既にオプトアウト済みか確認
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
    return c.html(page('Already Opted Out',
      '<p>You have already opted out of email tracking from this sender.</p>' +
      '<p>No further tracking data will be collected for your email address.</p>'));
  }

  return c.html(page('Opt Out of Email Tracking',
    `<p>Click the button below to stop this sender from tracking whether you open their emails.</p>` +
    `<form method="POST" action="/optout/${emailId}">` +
    `<button type="submit" style="background:#dc2626;color:#fff;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">` +
    `Stop Tracking My Emails</button></form>`));
});

/**
 * POST /optout/:emailId
 * opt-out を実行する。
 */
app.post('/:emailId', async (c) => {
  const emailId = c.req.param('emailId');
  const db = createDb(c.env.DB);

  const email = await db
    .select({ recipient: emails.recipient, tenantId: emails.tenantId })
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!email) {
    return c.html(page('Not Found', '<p>This tracking link is no longer valid.</p>'), 404);
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

  if (!existing) {
    await db.insert(optouts).values({
      tenantId: email.tenantId,
      recipientEmail: email.recipient,
      reason: 'recipient_optout',
    });

    // ADR-003 §4: opt-out 10件超で自動凍結
    await checkAutoBan(db, email.tenantId);
  }

  return c.html(page('Opted Out',
    '<p>You have been successfully opted out.</p>' +
    '<p>This sender will no longer be able to track whether you open their emails.</p>'));
});

/** Minimal HTML page wrapper */
function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — pixletter</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:0 16px;color:#333;}
h1{font-size:1.5rem;}a{color:#2563eb;}</style></head>
<body><h1>${title}</h1>${body}
<p style="margin-top:32px;font-size:12px;color:#999;">
<a href="/privacy">Privacy Policy</a></p>
</body></html>`;
}

export default app;
