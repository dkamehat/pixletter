/**
 * ダッシュボードの認証ヘルパー。
 * Better Auth のトークンを localStorage に保存し、
 * API リクエストに Authorization ヘッダーとして付与する。
 * Cross-domain Cookie 問題を回避するためトークンベースで認証する。
 */

const TOKEN_KEY = 'pixletter_token';
const API_BASE = import.meta.env.VITE_API_URL || '';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * 認証付き fetch ラッパー。
 * トークンがあれば Authorization ヘッダーを付与する。
 */
export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
}
