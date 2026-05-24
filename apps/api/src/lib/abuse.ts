import { eq, sql } from 'drizzle-orm';
import { optouts, tenants } from '@pixletter/db';
import type { Database } from './db';

/** opt-out 件数がこの閾値を超えたらテナントを自動凍結（ADR-003 §4） */
const AUTO_BAN_THRESHOLD = 10;

/**
 * テナントの opt-out 件数をチェックし、閾値超過なら自動凍結する。
 * opt-out 登録後に呼び出す。
 */
export async function checkAutoBan(
  db: Database,
  tenantId: string,
): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(optouts)
    .where(eq(optouts.tenantId, tenantId))
    .get();

  const count = result?.count ?? 0;

  if (count > AUTO_BAN_THRESHOLD) {
    await db
      .update(tenants)
      .set({ isSuspended: true })
      .where(eq(tenants.id, tenantId));
    console.warn(`Auto-banned tenant ${tenantId}: ${count} opt-outs exceed threshold ${AUTO_BAN_THRESHOLD}`);
    return true;
  }

  return false;
}
