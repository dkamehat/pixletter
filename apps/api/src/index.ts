import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './lib/types';
import { rateLimit } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { tenantMiddleware } from './middleware/tenant';
import { createAuth } from './auth';
import emailRoutes from './routes/emails';
import apikeyRoutes from './routes/apikeys';
import trackingRoutes from './routes/tracking';
import optoutRoutes from './routes/optout';
import privacyRoutes from './routes/privacy';
import gdprRoutes from './routes/gdpr';
import billingRoutes, { handleStripeWebhook } from './routes/billing';
import termsRoutes from './routes/terms';

const app = new Hono<{ Bindings: Env }>();

// グローバルミドルウェア
app.use('*', requestId);
app.use('*', logger());

// CORS: 全ルートに適用（Chrome拡張 + ダッシュボード対応）
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      // Chrome拡張 (chrome-extension://) は常に許可
      if (origin.startsWith('chrome-extension://')) return origin;
      const allowed = c.env.ALLOWED_ORIGINS;
      if (!allowed) return origin; // 未設定時は全許可（開発モード）
      const origins = allowed.split(',').map((s: string) => s.trim());
      return origins.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// トラッキングエンドポイント（認証不要: ピクセルとリダイレクト）
app.route('/', trackingRoutes);

// opt-out エンドポイント（認証不要: 受信者がブラウザでアクセス、FR-P2-30）
app.route('/optout', optoutRoutes);

// プライバシーポリシー・利用規約（認証不要、FR-P2-33）
app.route('/privacy', privacyRoutes);
app.route('/terms', termsRoutes);

// Google OAuth: ブラウザからGETでアクセス → Better AuthにPOSTとして中継
app.get('/login/google', async (c) => {
  if (c.env.HOSTING_MODE !== 'hosted') {
    return c.json({ error: 'Auth is not available in self-hosted mode' }, 404);
  }
  const auth = createAuth(c.env);
  const baseUrl = c.env.BETTER_AUTH_URL || new URL(c.req.url).origin;
  const dashUrl = c.env.ALLOWED_ORIGINS?.split(',')[0] || baseUrl;

  // Better Auth が期待する POST リクエストを内部的に生成
  const fakeReq = new Request(`${baseUrl}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': c.req.header('Cookie') || '',
      'Origin': baseUrl,
    },
    body: JSON.stringify({
      provider: 'google',
      callbackURL: dashUrl,
    }),
  });

  const res = await auth.handler(fakeReq);

  // Better Auth は { url, redirect: true } をJSON bodyで返す。
  // ブラウザ向けに302リダイレクトに変換する。
  try {
    const body = await res.clone().json() as { url?: string; redirect?: boolean };
    if (body.url && body.redirect) {
      const redirectRes = new Response(null, { status: 302 });
      redirectRes.headers.set('Location', body.url);
      // Better Auth のセッションCookieを転送
      for (const value of res.headers.getSetCookie()) {
        redirectRes.headers.append('Set-Cookie', value);
      }
      return redirectRes;
    }
  } catch {
    // JSON parse失敗時はそのまま返す
  }
  return res;
});

// Better Auth ルート（/api/auth/*）— hosted モードのみ有効
// OAuth callback のリダイレクトにトークンを埋め込む（cross-domain Cookie 回避）
app.all('/api/auth/*', async (c) => {
  if (c.env.HOSTING_MODE !== 'hosted') {
    return c.json({ error: 'Auth is not available in self-hosted mode' }, 404);
  }
  try {
    const auth = createAuth(c.env);
    const res = await auth.handler(c.req.raw);

    // OAuth callback のリダイレクトレスポンスを傍受
    // Set-Cookie からトークンを抽出し、リダイレクト先URLに付与
    const isCallback = c.req.path.includes('/callback/');
    const isRedirect = res.status >= 300 && res.status < 400;

    if (isCallback && isRedirect) {
      const location = res.headers.get('Location') || '';
      const cookies = res.headers.getSetCookie();

      // Better Auth の session token を Cookie から抽出
      let token = '';
      for (const cookie of cookies) {
        const match = cookie.match(/better-auth\.session_token=([^;]+)/);
        if (match?.[1]) {
          token = match[1];
          break;
        }
      }

      if (token && location) {
        const sep = location.includes('?') ? '&' : '?';
        // トークンをそのまま付与（ダッシュボード側でdecodeURIComponent済み）
        const decodedToken = decodeURIComponent(token);
        const newLocation = `${location}${sep}token=${encodeURIComponent(decodedToken)}`;
        const newRes = new Response(null, { status: 302 });
        newRes.headers.set('Location', newLocation);
        // Cookie も転送（同一ドメインの場合のfallback）
        for (const cookie of cookies) {
          newRes.headers.append('Set-Cookie', cookie);
        }
        return newRes;
      }
    }

    return res;
  } catch (err) {
    console.error('Better Auth error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// API エンドポイント（レート制限 + テナント認証）
app.use('/api/*', rateLimit);
app.use('/api/emails/*', tenantMiddleware);
app.use('/api/keys/*', tenantMiddleware);
app.route('/api/emails', emailRoutes);
app.route('/api/keys', apikeyRoutes);
app.use('/api/account/*', tenantMiddleware);
app.route('/api/account', gdprRoutes);
app.use('/api/billing/*', tenantMiddleware);
app.route('/api/billing', billingRoutes);

// Stripe Webhook（認証なし、署名検証で保護）
app.post('/webhook/stripe', async (c) => {
  return handleStripeWebhook(c as any);
});

// ヘルスチェック
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: '0.3.0',
    mode: c.env.HOSTING_MODE || 'self',
  }),
);

// 404 ハンドラ
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// エラーハンドラ
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
