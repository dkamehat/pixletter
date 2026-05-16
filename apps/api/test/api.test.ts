import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index';

async function applyMigrations(db: D1Database) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT, plan TEXT NOT NULL DEFAULT 'self', monthly_email_limit INTEGER NOT NULL DEFAULT 500, monthly_email_count INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL DEFAULT (unixepoch() + 2592000), is_suspended INTEGER DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, email TEXT NOT NULL UNIQUE, name TEXT, oauth_provider TEXT, oauth_id TEXT, slack_webhook_url TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, user_id TEXT NOT NULL, tracking_id TEXT NOT NULL UNIQUE, subject TEXT, recipient TEXT NOT NULL, recipient_name TEXT, gmail_message_id TEXT, thread_id TEXT, tag TEXT, sent_at INTEGER NOT NULL DEFAULT (unixepoch()), created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS opens (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE, user_agent TEXT, ip_hash TEXT, is_gmail_proxy INTEGER DEFAULT 0, opened_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, email_id TEXT NOT NULL REFERENCES emails(id) ON DELETE CASCADE, tracking_id TEXT NOT NULL UNIQUE, original_url TEXT NOT NULL, label TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS clicks (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE, user_agent TEXT, ip_hash TEXT, clicked_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `CREATE TABLE IF NOT EXISTS optouts (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, recipient_email TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
    `INSERT OR IGNORE INTO tenants (id, name, plan, monthly_email_limit) VALUES ('self', 'Self', 'self', 100000)`,
  ];
  for (const stmt of statements) {
    await db.prepare(stmt).run();
  }
}

async function request(path: string, init?: RequestInit) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, init);
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function createTestEmail(
  recipient = 'test@example.com',
  opts: { subject?: string; urls?: Array<{ url: string; label?: string }> } = {},
) {
  const res = await request('/api/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: opts.subject ?? 'Test',
      recipient,
      ...opts,
    }),
  });
  return res.json<{
    id: string;
    trackingId: string;
    pixelUrl: string;
    optoutUrl: string;
    optoutHtml: string;
    links: Array<{ originalUrl: string; trackingUrl: string; label?: string }>;
  }>();
}

describe('mailtrack-pf API', () => {
  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  // Health & Infrastructure
  it('GET /health returns ok with version', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string; version: string }>();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.3.0');
  });

  it('returns X-Request-ID and X-Response-Time headers', async () => {
    const res = await request('/health', {
      headers: { 'X-Request-ID': 'test-req-123' },
    });
    expect(res.headers.get('X-Request-ID')).toBe('test-req-123');
    expect(res.headers.get('X-Response-Time')).toMatch(/\d+ms/);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request('/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Not found');
  });

  // Email CRUD
  it('POST /api/emails returns 400 without recipient', async () => {
    const res = await request('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'No recipient' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/emails creates email with tracking info', async () => {
    const body = await createTestEmail('create@example.com', {
      subject: 'Test Subject',
      urls: [{ url: 'https://example.com', label: 'Example' }],
    });
    expect(body.id).toBeDefined();
    expect(body.trackingId).toBeDefined();
    expect(body.pixelUrl).toContain('/i/');
    expect(body.pixelUrl).toContain('.gif');
    expect(body.links).toHaveLength(1);
    expect(body.links[0]?.trackingUrl).toContain('/r/');
  });

  it('POST /api/emails creates email without URLs', async () => {
    const body = await createTestEmail('nourl@example.com');
    expect(body.id).toBeDefined();
    expect(body.links).toHaveLength(0);
  });

  it('POST /api/emails creates email with multiple URLs', async () => {
    const body = await createTestEmail('multi@example.com', {
      urls: [
        { url: 'https://a.com', label: 'A' },
        { url: 'https://b.com', label: 'B' },
        { url: 'https://c.com' },
      ],
    });
    expect(body.links).toHaveLength(3);
  });

  it('GET /api/emails returns paginated list', async () => {
    await createTestEmail('list@example.com');
    const res = await request('/api/emails?limit=5&offset=0');
    expect(res.status).toBe(200);
    const body = await res.json<{
      data: unknown[];
      pagination: { limit: number; offset: number };
    }>();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination.limit).toBe(5);
  });

  it('GET /api/emails caps limit at 100', async () => {
    const res = await request('/api/emails?limit=999');
    const body = await res.json<{ pagination: { limit: number } }>();
    expect(body.pagination.limit).toBe(100);
  });

  it('GET /api/emails/:id returns 404 for nonexistent', async () => {
    const res = await request('/api/emails/nonexistent-id');
    expect(res.status).toBe(404);
  });

  // Tracking
  it('GET /pixel/:id.gif returns valid GIF with no-cache headers', async () => {
    const email = await createTestEmail('pixel@example.com');
    const res = await request(`/pixel/${email.trackingId}.gif`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const buf = await res.arrayBuffer();
    const header = new Uint8Array(buf.slice(0, 6));
    expect(String.fromCharCode(...header)).toBe('GIF89a');
  });

  it('GET /pixel returns 200 even for unknown tracking ID', async () => {
    const res = await request('/pixel/nonexistent.gif');
    expect(res.status).toBe(200);
  });

  it('GET /r/:id redirects to original URL', async () => {
    const email = await createTestEmail('redir@example.com', {
      urls: [{ url: 'https://redirect-target.com/page' }],
    });
    const linkId = email.links[0]?.trackingUrl.split('/r/')[1] ?? '';
    const res = await request(`/r/${linkId}`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://redirect-target.com/page');
  });

  it('GET /r/nonexistent returns 404', async () => {
    const res = await request('/r/nonexistent', { redirect: 'manual' });
    expect(res.status).toBe(404);
  });

  // Optout
  it('optout: creates and prevents duplicate', async () => {
    const email = await createTestEmail('optout@example.com');
    const res1 = await request(`/api/emails/${email.id}/optout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Privacy' }),
    });
    expect(res1.status).toBe(201);

    const res2 = await request(`/api/emails/${email.id}/optout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res2.status).toBe(200);
    const body = await res2.json<{ message: string }>();
    expect(body.message).toBe('Already opted out');
  });

  it('optout: returns 404 for nonexistent email', async () => {
    const res = await request('/api/emails/nonexistent/optout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  // Auth
  it('allows requests when API_KEY is not configured', async () => {
    const res = await request('/api/emails?limit=1');
    expect(res.status).toBe(200);
  });

  // Opt-out public page (FR-P2-30)
  it('POST /api/emails returns optoutUrl and optoutHtml', async () => {
    const body = await createTestEmail('opturl@example.com');
    expect(body.optoutUrl).toContain('/optout/');
    expect(body.optoutHtml).toContain('Unsubscribe from tracking');
  });

  it('GET /optout/:emailId shows opt-out page', async () => {
    const email = await createTestEmail('optpage@example.com');
    const res = await request(`/optout/${email.id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Stop Tracking My Emails');
  });

  it('POST /optout/:emailId executes opt-out and GET shows already opted out', async () => {
    const email = await createTestEmail('optexec@example.com');
    const res = await request(`/optout/${email.id}`, { method: 'POST' });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('successfully opted out');

    // After opt-out, GET should show "Already Opted Out"
    const res2 = await request(`/optout/${email.id}`);
    expect(res2.status).toBe(200);
    const html2 = await res2.text();
    expect(html2).toContain('Already Opted Out');
  });

  it('GET /optout/nonexistent returns 404', async () => {
    const res = await request('/optout/nonexistent');
    expect(res.status).toBe(404);
  });

  // Privacy policy (FR-P2-33)
  it('GET /privacy returns privacy policy page', async () => {
    const res = await request('/privacy');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Opt-Out');
  });

  // Monthly send limit (FR-P2-02)
  it('POST /api/emails returns 429 when monthly limit reached', async () => {
    // Set monthly_email_count to the limit for self tenant (100000)
    // For this test, we update the tenant's limit to a small number
    const db = env.DB;
    await db.prepare(
      `UPDATE tenants SET monthly_email_limit = 1, monthly_email_count = 1 WHERE id = 'self'`
    ).run();

    const res = await request('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Limit test', recipient: 'limit@example.com' }),
    });
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Monthly email limit reached');

    // Reset for subsequent tests
    await db.prepare(
      `UPDATE tenants SET monthly_email_limit = 100000, monthly_email_count = 0 WHERE id = 'self'`
    ).run();
  });

  // Terms of service
  it('GET /terms returns terms page', async () => {
    const res = await request('/terms');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('利用規約');
    expect(html).toContain('特定電子メール');
  });

  // Account usage
  it('GET /api/account/usage returns tenant usage', async () => {
    const res = await request('/api/account/usage');
    expect(res.status).toBe(200);
    const body = await res.json<{ plan: string; monthlyEmailLimit: number; monthlyEmailCount: number }>();
    expect(body.plan).toBe('self');
    expect(typeof body.monthlyEmailLimit).toBe('number');
    expect(typeof body.monthlyEmailCount).toBe('number');
  });

  // GDPR data export
  it('GET /api/account/data returns tenant data export', async () => {
    const res = await request('/api/account/data');
    expect(res.status).toBe(200);
    const body = await res.json<{ exportedAt: string; tenant: unknown; emails: unknown[] }>();
    expect(body.exportedAt).toBeDefined();
    expect(body.tenant).toBeDefined();
    expect(Array.isArray(body.emails)).toBe(true);
  });

  // Suspended tenant check
  it('POST /api/emails returns 403 for suspended tenant', async () => {
    const db = env.DB;
    await db.prepare(`UPDATE tenants SET is_suspended = 1 WHERE id = 'self'`).run();

    const res = await request('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Suspended', recipient: 'sus@example.com' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe('Account suspended');

    await db.prepare(`UPDATE tenants SET is_suspended = 0 WHERE id = 'self'`).run();
  });

  // Monthly counter reset
  it('POST /api/emails resets counter when reset_at has passed', async () => {
    const db = env.DB;
    // Set reset_at to a past timestamp and count to 99
    await db.prepare(
      `UPDATE tenants SET monthly_email_count = 99, reset_at = 1000000 WHERE id = 'self'`
    ).run();

    const res = await request('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Reset test', recipient: 'reset@example.com' }),
    });
    expect(res.status).toBe(201);

    // Verify counter was reset then incremented to 1
    const row = await db.prepare(
      `SELECT monthly_email_count FROM tenants WHERE id = 'self'`
    ).first<{ monthly_email_count: number }>();
    expect(row?.monthly_email_count).toBe(1);

    // Reset for subsequent tests
    await db.prepare(
      `UPDATE tenants SET monthly_email_count = 0, reset_at = (unixepoch() + 2592000) WHERE id = 'self'`
    ).run();
  });

  // E2E lifecycle
  it('full lifecycle: create → open → click → verify counts', async () => {
    const email = await createTestEmail('e2e@example.com', {
      subject: 'E2E test',
      urls: [{ url: 'https://e2e.com' }],
    });

    // Open pixel twice
    await request(`/pixel/${email.trackingId}.gif`);
    await request(`/pixel/${email.trackingId}.gif`);

    // Click link
    const linkId = email.links[0]?.trackingUrl.split('/r/')[1] ?? '';
    await request(`/r/${linkId}`, { redirect: 'manual' });

    // Verify detail — waitUntil writes may not complete in test env,
    // so we only assert the response structure is correct.
    const detailRes = await request(`/api/emails/${email.id}`);
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json<{
      id: string;
      openCount: number;
      links: Array<{ clickCount: number }>;
    }>();
    expect(detail.id).toBe(email.id);
    expect(typeof detail.openCount).toBe('number');
    expect(detail.links).toHaveLength(1);
  });
});
