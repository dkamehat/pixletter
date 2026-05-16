/**
 * API クライアント。
 * authFetch を使い、トークンベース認証でリクエストする。
 */

import { authFetch } from './auth';

interface EmailSummary {
  id: string;
  trackingId: string;
  subject: string | null;
  recipient: string;
  recipientName: string | null;
  tag: string | null;
  sentAt: string;
  openCount: number;
  clickCount: number;
  firstOpenedAt: number | null;
}

interface EmailDetail {
  id: string;
  trackingId: string;
  subject: string | null;
  recipient: string;
  recipientName: string | null;
  sentAt: string;
  opens: Array<{
    id: string;
    userAgent: string | null;
    ipHash: string | null;
    isGmailProxy: boolean | null;
    openedAt: string;
  }>;
  links: Array<{
    id: string;
    trackingId: string;
    originalUrl: string;
    label: string | null;
    clickCount: number;
  }>;
  openCount: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { limit: number; offset: number };
}

export async function fetchEmails(
  limit = 50,
  offset = 0,
): Promise<PaginatedResponse<EmailSummary>> {
  const res = await authFetch(`/api/emails?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<PaginatedResponse<EmailSummary>>;
}

export async function fetchEmailDetail(id: string): Promise<EmailDetail> {
  const res = await authFetch(`/api/emails/${id}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<EmailDetail>;
}

export type { EmailSummary, EmailDetail };
