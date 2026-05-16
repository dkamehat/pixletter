import React, { useEffect, useState } from 'react';
import { authFetch } from './auth';

interface BillingStatus {
  plan: string;
  limit: number;
  used: number;
  canUpgrade: boolean;
  stripePriceId: boolean;
}

export function PlanManager() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authFetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStatus(data as BillingStatus); })
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await authFetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  if (!status) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {status.plan === 'pro' ? 'Pro Plan' : status.plan === 'self' ? 'Self-Hosted' : 'Free Plan'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            {status.used} / {status.limit} emails this month
          </p>
        </div>

        {status.canUpgrade && status.stripePriceId && (
          <button
            className="btn"
            onClick={handleUpgrade}
            disabled={loading}
            style={{ width: 'auto', padding: '8px 20px' }}
          >
            {loading ? 'Loading...' : 'Upgrade to Pro'}
          </button>
        )}

        {status.plan === 'pro' && (
          <span style={{
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
            background: '#e8f5e9',
            color: '#2e7d32',
          }}>
            Pro
          </span>
        )}
      </div>

      {status.plan === 'free' && !status.stripePriceId && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
          Billing is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID to enable upgrades.
        </p>
      )}
    </div>
  );
}
