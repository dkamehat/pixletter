import React, { useState, useEffect } from 'react';
import { EmailList } from './EmailList';
import { EmailDetailView } from './EmailDetail';
import { Landing } from './Landing';
import { AuthPage } from './AuthPage';
import { UsageBanner } from './UsageBanner';
import { Onboarding } from './Onboarding';
import { PlanManager } from './PlanManager';
import { isLoggedIn, setToken, clearToken, authFetch } from './auth';

type Page = 'landing' | 'auth' | 'onboarding' | 'dashboard';

export function App() {
  const [page, setPage] = useState<Page>('landing');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // OAuth callback: URLパラメータからトークンを取得して保存
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token');
    // Better Auth callback でダブルエンコードされるケースがあるためデコード
    const urlToken = rawToken ? decodeURIComponent(rawToken) : null;
    if (urlToken) {
      setToken(urlToken);
      // URLからトークンを除去（履歴に残さない）
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!isLoggedIn()) {
      setChecking(false);
      return;
    }
    // トークンが有効か確認
    authFetch('/api/emails?limit=1')
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json() as { data: unknown[] };
          setPage(body.data.length === 0 ? 'onboarding' : 'dashboard');
        } else {
          clearToken(); // トークン無効 → ログアウト
        }
        setChecking(false);
      })
      .catch(() => {
        clearToken();
        setChecking(false);
      });
  }, []);

  if (checking) {
    return <div className="loading">Loading...</div>;
  }

  if (page === 'landing') {
    return <Landing onGetStarted={() => setPage('auth')} />;
  }

  if (page === 'auth') {
    return <AuthPage onAuth={() => setPage('onboarding')} />;
  }

  if (page === 'onboarding') {
    return <Onboarding onComplete={() => setPage('dashboard')} />;
  }

  // Dashboard
  return (
    <div className="container">
      <header className="header">
        <h1>mailtrack-pf</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Dashboard
          </span>
          <button
            onClick={() => {
              clearToken();
              setPage('landing');
            }}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <PlanManager />
      <UsageBanner />

      {selectedEmailId ? (
        <EmailDetailView
          emailId={selectedEmailId}
          onBack={() => setSelectedEmailId(null)}
        />
      ) : (
        <EmailList onSelect={setSelectedEmailId} />
      )}
    </div>
  );
}
