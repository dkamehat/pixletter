import React from 'react';

interface Props {
  onGetStarted: () => void;
}

export function Landing({ onGetStarted }: Props) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
      <h1 style={{ fontSize: 32, fontWeight: 600, marginBottom: 12 }}>pixletter</h1>
      <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 32 }}>
        Open-source email tracking. $0/month. Your data, your server.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 48 }}>
        <button className="btn" onClick={onGetStarted} style={{ padding: '12px 32px', fontSize: 16 }}>
          Get Started Free
        </button>
        <a
          href="https://github.com/dkamehat/pixletter"
          target="_blank"
          rel="noopener"
          className="btn"
          style={{
            padding: '12px 32px',
            fontSize: 16,
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          View on GitHub
        </a>
      </div>

      {/* Feature grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        textAlign: 'left',
        marginBottom: 48,
      }}>
        {[
          { icon: '👁️', title: 'Open Tracking', desc: 'Know when your emails are read with 1x1 pixel tracking.' },
          { icon: '🔗', title: 'Click Tracking', desc: 'Track link clicks with transparent redirect URLs.' },
          { icon: '🔒', title: 'Data Privacy', desc: 'IPs are SHA-256 hashed. Recipients can opt out anytime.' },
          { icon: '💰', title: '$0/month', desc: 'Runs on Cloudflare free tier. No credit card needed.' },
          { icon: '📊', title: 'Dashboard', desc: 'Real-time open rates, click rates, and timelines.' },
          { icon: '🔔', title: 'Slack Alerts', desc: 'Get notified instantly when someone opens your email.' },
        ].map((f) => (
          <div key={f.title} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Architecture */}
      <div className="card" style={{ textAlign: 'left', marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Architecture</h2>
        <pre style={{
          fontSize: 12,
          lineHeight: 1.5,
          overflow: 'auto',
          background: 'var(--bg)',
          padding: 16,
          borderRadius: 4,
        }}>{`Chrome Extension ──POST──→ Cloudflare Workers (Hono)
                                    │
Recipient opens ──GET pixel──→      │──→ D1 (SQLite)
Recipient clicks ──GET /r/──→       │
                                    │
Dashboard ←────GET /api/────────────┘`}</pre>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        AGPLv3 Licensed · Built by{' '}
        <a href="https://x.com/kame__lift" target="_blank" rel="noopener">
          @kame__lift
        </a>
      </p>
    </div>
  );
}
