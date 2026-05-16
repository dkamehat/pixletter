import { createMiddleware } from 'hono/factory';
import type { Env } from '../lib/types';

/**
 * Phase 1: シンプルな API キー認証。
 * Authorization: Bearer <key> ヘッダーで照合。
 * Phase 2 では Better Auth + tenant_id ベースに移行する。
 *
 * API_KEY が未設定の場合はスキップ（ローカル開発用）。
 */
export const apiKeyAuth = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const expectedKey = c.env.API_KEY;

    // API_KEY が未設定ならスキップ（開発モード）
    if (!expectedKey) {
      await next();
      return;
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7);
    if (token !== expectedKey) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    await next();
  },
);
