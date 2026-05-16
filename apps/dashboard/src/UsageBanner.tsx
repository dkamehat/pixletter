import React, { useState, useEffect } from 'react';
import { authFetch } from './auth';

interface TenantUsage {
  plan: string;
  monthlyEmailCount: number;
  monthlyEmailLimit: number;
  resetAt: string | null;
}

export function UsageBanner() {
  const [usage, setUsage] = useState<TenantUsage | null>(null);

  useEffect(() => {
    authFetch('/api/account/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TenantUsage | null) => setUsage(data))
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const pct = Math.min(100, Math.round((usage.monthlyEmailCount / usage.monthlyEmailLimit) * 100));
  const isWarning = pct >= 80;
  const isOver = pct >= 100;

  return (
    <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          Monthly Usage ({usage.plan})
        </span>
        <span style={{ fontSize: 12, color: isOver ? '#dc2626' : isWarning ? '#d97706' : 'var(--text-secondary)' }}>
          {usage.monthlyEmailCount} / {usage.monthlyEmailLimit} emails
        </span>
      </div>
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 3,
          background: isOver ? '#dc2626' : isWarning ? '#d97706' : '#2563eb',
          transition: 'width 0.3s',
        }} />
      </div>
      {usage.resetAt && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
          Resets {new Date(usage.resetAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
