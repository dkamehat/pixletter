import { createMiddleware } from 'hono/factory';
import type { Env } from '../lib/types';

/**
 * 簡易レート制限ミドルウェア（FR-API-07）。
 *
 * D1 を使ったシンプルなスライディングウィンドウ方式。
 * Phase 1 では Workers KV やカウンターなしで D1 のみで実現する。
 *
 * ピクセル/リダイレクトエンドポイントは除外（正常な開封・クリック）。
 * API エンドポイント（/api/*）にのみ適用。
 *
 * 制限: 同一 IP から 100 req/min。
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

// メモリ内カウンター（Workers インスタンスごと、リセットされてもOK）
const counters = new Map<string, { count: number; windowStart: number }>();

export const rateLimit = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const ip =
      c.req.header('CF-Connecting-IP') ??
      c.req.header('X-Forwarded-For') ??
      'unknown';
    const now = Date.now();

    let entry = counters.get(ip);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      entry = { count: 0, windowStart: now };
      counters.set(ip, entry);
    }

    entry.count++;

    if (entry.count > MAX_REQUESTS) {
      return c.json(
        { error: 'Too many requests. Please try again later.' },
        429,
      );
    }

    // メモリリーク防止: 古いエントリを定期的にクリーンアップ
    if (counters.size > 10_000) {
      for (const [key, val] of counters) {
        if (now - val.windowStart > WINDOW_MS * 2) {
          counters.delete(key);
        }
      }
    }

    await next();
  },
);
