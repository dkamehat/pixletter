import { createMiddleware } from 'hono/factory';
import { eq, and, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { apiKeys, SELF_TENANT_ID } from '@mailtrack/db';
import { createDb } from '../lib/db';
import { createAuth } from '../auth';
import * as authSchema from '../auth/schema';
import type { Env } from '../lib/types';

/**
 * テナントミドルウェア（ADR-003 §5）。
 *
 * HOSTING_MODE に応じて認証方式を切り替える:
 * - "self": tenant_id="self", userId="self" 固定（OSS版）
 * - "hosted": Better Auth セッション or API Key でテナント特定（公式版）
 *
 * 認証結果は c.set('tenantId') / c.set('userId') に格納する。
 */
export const tenantMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { tenantId: string; userId: string };
}>(async (c, next) => {
  const mode = c.env.HOSTING_MODE || 'self';

  if (mode === 'self') {
    // OSS版: 固定テナント
    c.set('tenantId', SELF_TENANT_ID);
    c.set('userId', 'self');
    await next();
    return;
  }

  // hosted モード: API Key → Better Auth セッション の順で認証
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // 1) API Key 認証（Chrome 拡張機能用: mt_ プレフィックス）
  if (bearerToken?.startsWith('mt_')) {
    const keyHash = await hashApiKey(bearerToken);
    const db = createDb(c.env.DB);

    const key = await db
      .select({
        tenantId: apiKeys.tenantId,
        userId: apiKeys.userId,
        isRevoked: apiKeys.isRevoked,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .get();

    if (key && !key.isRevoked) {
      c.set('tenantId', key.tenantId);
      c.set('userId', key.userId);

      // lastUsedAt 更新（非同期、レスポンスをブロックしない）
      c.executionCtx.waitUntil(
        db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.keyHash, keyHash))
          .run(),
      );

      await next();
      return;
    }

    return c.json({ error: 'Invalid or revoked API key' }, 401);
  }

  // 2) Bearer セッショントークン認証（ダッシュボード用: cross-domain）
  // Better Auth のトークンは "token.signature" 形式。DBには token 部分のみ保存される。
  if (bearerToken) {
    try {
      const authDb = drizzle(c.env.DB, { schema: authSchema });
      // "token.signature" → DB検索には token 部分のみ使用
      const tokenId = bearerToken.split('.')[0] ?? bearerToken;

      const row = await authDb
        .select({ userId: authSchema.session.userId })
        .from(authSchema.session)
        .where(
          and(
            eq(authSchema.session.token, tokenId),
            gt(authSchema.session.expiresAt, new Date()),
          ),
        )
        .get();

      if (row) {
        c.set('tenantId', row.userId);
        c.set('userId', row.userId);
        await next();
        return;
      }
    } catch {
      // セッション検索失敗 → 下のCookie認証へフォールスルー
    }
  }

  // 3) Cookie ベース認証（同一ドメインの場合のfallback）
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (session?.user) {
      c.set('tenantId', session.user.id);
      c.set('userId', session.user.id);
      await next();
      return;
    }
  } catch {
    // セッション取得失敗 → 未認証
  }

  return c.json({ error: 'Authentication required' }, 401);
});

/**
 * API キーを SHA-256 でハッシュ化する（保存・照合用）。
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { hashApiKey };
