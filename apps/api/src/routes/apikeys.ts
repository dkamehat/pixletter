import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { apiKeys } from '@pixletter/db';
import { createId } from '@paralleldrive/cuid2';
import { createDb } from '../lib/db';
import { hashApiKey } from '../middleware/tenant';
import type { Env } from '../lib/types';

const app = new Hono<{
  Bindings: Env;
  Variables: { tenantId: string; userId: string };
}>();

/**
 * POST /api/keys
 * 新しい API キーを生成する（FR-P2-04）。
 * 生キーはレスポンスでのみ返却。以降はハッシュ値で照合。
 */
app.post('/', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json<{ name?: string }>().catch(() => ({}));

  // 生キーを生成: "mt_" prefix + CUID2
  const rawKey = `mt_${createId()}${createId()}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 7); // "mt_xxxx" — UI表示用

  await db.insert(apiKeys).values({
    tenantId,
    userId,
    keyHash,
    keyPrefix,
    name: (body as { name?: string }).name || 'Default',
  });

  return c.json(
    {
      key: rawKey, // 生キーは一度だけ返却
      prefix: keyPrefix,
      name: (body as { name?: string }).name || 'Default',
      message: 'Save this key — it will not be shown again.',
    },
    201,
  );
});

/**
 * GET /api/keys
 * 自テナントの API キー一覧を取得する（生キーは含まない）。
 */
app.get('/', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  const keys = await db
    .select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      isRevoked: apiKeys.isRevoked,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId));

  return c.json({ data: keys });
});

/**
 * DELETE /api/keys/:id
 * API キーを無効化（revoke）する。物理削除はしない。
 */
app.delete('/:id', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');
  const keyId = c.req.param('id');

  const result = await db
    .update(apiKeys)
    .set({ isRevoked: true })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)))
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Key not found' }, 404);
  }

  return c.json({ message: 'Key revoked' });
});

export default app;
