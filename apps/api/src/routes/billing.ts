import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { tenants } from '@mailtrack/db';
import { createDb } from '../lib/db';
import type { Env } from '../lib/types';

const app = new Hono<{
  Bindings: Env;
  Variables: { tenantId: string; userId: string };
}>();

/**
 * POST /api/billing/checkout
 * Stripe Checkout Session を作成し、決済 URL を返却する（FR-P3-21）。
 */
app.post('/checkout', async (c) => {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY || '', { apiVersion: '2026-04-22.dahlia' });
  const tenantId = c.get('tenantId');
  const priceId = c.env.STRIPE_PRO_PRICE_ID;

  if (!priceId || !c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Billing is not configured' }, 503);
  }

  const baseUrl = c.env.BETTER_AUTH_URL || new URL(c.req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/api/billing/cancel`,
    metadata: { tenantId },
    client_reference_id: tenantId,
  });

  return c.json({ url: session.url });
});

/**
 * GET /api/billing/success
 * Checkout 完了後のリダイレクト先。D1 のプランを更新する。
 */
app.get('/success', async (c) => {
  const sessionId = c.req.query('session_id');
  if (!sessionId) return c.redirect('/');

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY || '', { apiVersion: '2026-04-22.dahlia' });
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === 'paid' && session.metadata?.tenantId) {
    const db = createDb(c.env.DB);
    await db
      .update(tenants)
      .set({
        plan: 'pro',
        monthlyEmailLimit: 5000, // FR-P3-20: Pro は月 5,000 通
      })
      .where(eq(tenants.id, session.metadata.tenantId));
  }

  // ダッシュボードにリダイレクト
  const dashUrl = c.env.ALLOWED_ORIGINS?.split(',')[0] || '/';
  return c.redirect(`${dashUrl}?upgraded=true`);
});

/**
 * GET /api/billing/cancel
 * Checkout キャンセル時のリダイレクト。
 */
app.get('/cancel', async (c) => {
  const dashUrl = c.env.ALLOWED_ORIGINS?.split(',')[0] || '/';
  return c.redirect(dashUrl);
});

/**
 * GET /api/billing/status
 * 現在のプラン情報を返却する（ダッシュボード用）。
 */
app.get('/status', async (c) => {
  const db = createDb(c.env.DB);
  const tenantId = c.get('tenantId');

  const tenant = await db
    .select({
      plan: tenants.plan,
      monthlyEmailLimit: tenants.monthlyEmailLimit,
      monthlyEmailCount: tenants.monthlyEmailCount,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();

  return c.json({
    plan: tenant?.plan || 'free',
    limit: tenant?.monthlyEmailLimit || 500,
    used: tenant?.monthlyEmailCount || 0,
    canUpgrade: tenant?.plan !== 'pro' && tenant?.plan !== 'self',
    stripePriceId: c.env.STRIPE_PRO_PRICE_ID ? true : false,
  });
});

export default app;

/**
 * Stripe Webhook ハンドラ（FR-P3-22）。
 * index.ts から直接呼び出す（認証なし、Stripe 署名検証で保護）。
 */
export async function handleStripeWebhook(c: {
  req: { raw: Request };
  env: Env;
  json: (body: unknown, status?: number) => Response;
}): Promise<Response> {
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY || '', { apiVersion: '2026-04-22.dahlia' });
  const signature = c.req.raw.headers.get('stripe-signature');

  if (!signature || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;
  try {
    const body = await c.req.raw.text();
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = createDb(c.env.DB);

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (tenantId) {
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await db
          .update(tenants)
          .set({
            plan: isActive ? 'pro' : 'free',
            monthlyEmailLimit: isActive ? 5000 : 500,
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (tenantId) {
        await db
          .update(tenants)
          .set({
            plan: 'free',
            monthlyEmailLimit: 500,
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }
  }

  return c.json({ received: true });
}
