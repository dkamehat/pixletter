import React, { useEffect, useState } from 'react';
import { fetchEmailDetail, type EmailDetail } from './api';

interface Props {
  emailId: string;
  onBack: () => void;
}

export function EmailDetailView({ emailId, onBack }: Props) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmailDetail(emailId)
      .then(setEmail)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [emailId]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!email) return null;

  return (
    <>
      <a className="back-link" href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>
        &larr; Back to list
      </a>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>
          {email.subject || '(no subject)'}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          To: {email.recipient} &middot; Sent: {new Date(email.sentAt).toLocaleString()}
        </div>

        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card">
            <div className="value">{email.openCount}</div>
            <div className="label">Opens</div>
          </div>
          <div className="stat-card">
            <div className="value">
              {email.links.reduce((sum, l) => sum + l.clickCount, 0)}
            </div>
            <div className="label">Clicks</div>
          </div>
          <div className="stat-card">
            <div className="value">{email.links.length}</div>
            <div className="label">Tracked Links</div>
          </div>
        </div>
      </div>

      {/* FR-DASH-02: 開封タイムライン */}
      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Open Timeline</h3>
        {email.opens.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            No opens recorded yet
          </div>
        ) : (
          <ul className="timeline">
            {email.opens.map((open) => (
              <li key={open.id}>
                <strong>{new Date(open.openedAt).toLocaleString()}</strong>
                {open.isGmailProxy && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                    (Gmail Image Proxy)
                  </span>
                )}
                {open.userAgent && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {summarizeUA(open.userAgent)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Links */}
      {email.links.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Tracked Links</h3>
          <table className="email-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Label</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {email.links.map((link) => (
                <tr key={link.id}>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <a href={link.originalUrl} target="_blank" rel="noopener">
                      {link.originalUrl}
                    </a>
                  </td>
                  <td>{link.label || '-'}</td>
                  <td>{link.clickCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function summarizeUA(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Outlook')) return 'Outlook';
  if (ua.includes('GoogleImageProxy')) return 'Gmail Image Proxy';
  return ua.slice(0, 60);
}
