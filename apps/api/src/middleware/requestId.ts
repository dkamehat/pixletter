import { createMiddleware } from 'hono/factory';
import type { Env } from '../lib/types';

/**
 * リクエスト ID ミドルウェア（NFR-OBS-01 準備）。
 * 各リクエストにユニーク ID を付与し、レスポンスヘッダーに含める。
 * ログの相関分析とデバッグに使用する。
 */
export const requestId = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const id =
      c.req.header('X-Request-ID') ??
      crypto.randomUUID();

    c.set('requestId' as never, id);
    c.header('X-Request-ID', id);

    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    c.header('X-Response-Time', `${duration}ms`);
  },
);
