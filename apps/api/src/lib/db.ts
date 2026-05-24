import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@pixletter/db';

/**
 * D1 バインディングから Drizzle インスタンスを生成する。
 * リクエストごとに呼び出す（Workers はステートレス）。
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
