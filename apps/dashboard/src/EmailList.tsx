import React, { useEffect, useState, useMemo } from 'react';
import { fetchEmails, type EmailSummary } from './api';

interface Props {
  onSelect: (id: string) => void;
}

export function EmailList({ onSelect }: Props) {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEmails(100)
      .then((res) => setEmails(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return emails;
    const q = search.toLowerCase();
    return emails.filter(
      (e) =>
        (e.subject?.toLowerCase().includes(q)) ||
        e.recipient.toLowerCase().includes(q) ||
        (e.tag?.toLowerCase().includes(q)),
    );
  }, [emails, search]);

  // Stats — FR-DASH-03
  const stats = useMemo(() => {
    const total = emails.length;
    const opened = emails.filter((e) => e.openCount > 0).length;
    const clicked = emails.filter((e) => e.clickCount > 0).length;
    return {
      total,
      opened,
      openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
      clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
    };
  }, [emails]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <>
      {/* FR-DASH-03: 集計ステータス */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{stats.total}</div>
          <div className="label">Total Sent</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.opened}</div>
          <div className="label">Opened</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.openRate}%</div>
          <div className="label">Open Rate</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.clickRate}%</div>
          <div className="label">Click Rate</div>
        </div>
      </div>

      {/* FR-DASH-04: 検索・フィルタ */}
      <input
        className="search-bar"
        type="text"
        placeholder="Search by subject, recipient, or tag..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* FR-DASH-01: メール送信履歴 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="email-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Opens</th>
              <th>Clicks</th>
              <th>Sent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((email) => (
              <tr
                key={email.id}
                onClick={() => onSelect(email.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <span
                    className={`badge ${email.openCount > 0 ? 'badge--opened' : 'badge--pending'}`}
                  >
                    {email.openCount > 0 ? 'Opened' : 'Pending'}
                  </span>
                </td>
                <td>{email.recipient}</td>
                <td>{email.subject || '(no subject)'}</td>
                <td>{email.openCount}</td>
                <td>{email.clickCount}</td>
                <td>{formatDate(email.sentAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No emails found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
