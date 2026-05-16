import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit configuration for Cloudflare D1.
 *
 * Generate migrations:
 *   pnpm --filter @mailtrack/db generate
 *
 * Apply migrations to local D1:
 *   pnpm wrangler d1 execute mailtrack-pf-db --local --file=packages/db/migrations/0000_init.sql
 *
 * Apply migrations to remote D1:
 *   pnpm wrangler d1 execute mailtrack-pf-db --remote --file=packages/db/migrations/0000_init.sql
 */
export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  // ローカル開発時は d1-http driver は不要、wrangler d1 execute を使用
  // CI でリモート D1 を直接操作する場合のみ有効化
  ...(process.env.CLOUDFLARE_ACCOUNT_ID && {
    driver: 'd1-http' as const,
    dbCredentials: {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
      token: process.env.CLOUDFLARE_D1_TOKEN ?? '',
    },
  }),
});
