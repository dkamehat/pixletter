/**
 * Cloudflare Workers environment bindings.
 * Hono の Context で env.DB 等にアクセスするための型定義。
 */
export interface Env {
  DB: D1Database;
  HOSTING_MODE: string; // "self" | "hosted"
  API_KEY?: string;
  SENTRY_DSN?: string;
  SLACK_WEBHOOK_URL?: string;
  PIXEL_DOMAIN?: string;
  ALLOWED_ORIGINS?: string; // カンマ区切り。例: "https://dashboard.kame-lift.workers.dev,http://localhost:5173"
  // Phase 2: Better Auth
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Phase 3: Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRO_PRICE_ID?: string; // Stripe Price ID for Pro plan
}

/**
 * 認証済みリクエストのコンテキスト変数。
 * Hono の c.get('tenant') / c.get('userId') でアクセスする。
 */
export interface AuthContext {
  tenantId: string;
  userId: string;
}
