import React, { useState } from 'react';
import { setToken } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Props {
  onAuth: () => void;
}

export function AuthPage({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint =
        mode === 'signup'
          ? `${API_BASE}/api/auth/sign-up/email`
          : `${API_BASE}/api/auth/sign-in/email`;

      const body: Record<string, string> = { email, password };
      if (mode === 'signup') body['name'] = name || email.split('@')[0] || '';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).message || `Error: ${res.status}`);
      }

      const data = await res.json() as { token?: string };
      if (data.token) {
        setToken(data.token);
      }

      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📬</div>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Name
              </label>
              <input
                className="search-bar"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={{ marginBottom: 0 }}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Email
            </label>
            <input
              className="search-bar"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Password
            </label>
            <input
              className="search-bar"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
              style={{ marginBottom: 0 }}
            />
          </div>

          {error && (
            <div className="error" style={{ marginBottom: 12, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button className="btn" type="submit" disabled={loading} style={{ marginBottom: 12 }}>
            {loading ? 'Loading...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
          or
        </div>

        <a
          href={`${API_BASE}/login/google`}
          className="btn"
          style={{
            display: 'block',
            textAlign: 'center',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
          }}
        >
          Continue with Google
        </a>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); }}>
                Sign up
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>
                Sign in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
