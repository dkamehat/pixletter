import { eq, and, gte } from 'drizzle-orm';
import { opens, emails } from '@mailtrack/db';
import type { Database } from './db';

/**
 * Slack Webhook 通知を送信する（FR-NOTIF-01）。
 * FR-NOTIF-02: 同一メールの 2 回目以降は 1 時間以内なら抑制する。
 */
export async function notifySlack(
  db: Database,
  emailId: string,
  webhookUrl: string | undefined,
): Promise<void> {
  if (!webhookUrl) return;

  // 通知抑制: 1時間以内に同じメールの開封通知があれば送らない
  const oneHourAgo = new Date(Date.now() - 3_600_000);
  const recentOpens = await db
    .select({ id: opens.id })
    .from(opens)
    .where(
      and(
        eq(opens.emailId, emailId),
        gte(opens.openedAt, oneHourAgo),
      ),
    )
    .all();

  // 今回のINSERTで1件、既に2件以上なら抑制
  if (recentOpens.length > 1) return;

  // メール情報を取得
  const email = await db
    .select({
      subject: emails.subject,
      recipient: emails.recipient,
    })
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!email) return;

  const text = `📬 Email opened!\n*To:* ${email.recipient}\n*Subject:* ${email.subject || '(no subject)'}`;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {
    // Slack 通知失敗はログだけ出して無視
    console.error('Failed to send Slack notification');
  });
}
