/**
 * Better Auth 設定（Phase 2: マルチテナント認証）。
 *
 * Drizzle アダプター + カスタムスキーマで ba_user テーブルを "user" としてマッピング。
 * databaseHooks で Sign up 時に pixletter の tenants テーブルにレコードを自動作成する。
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { tenants, users } from '@pixletter/db';
import { createDb } from '../lib/db';
import * as authSchema from './schema';
import type { Env } from '../lib/types';

export function createAuth(env: Env) {
  const db = createDb(env.DB);
  const authDb = drizzle(env.DB, { schema: authSchema });

  return betterAuth({
    database: drizzleAdapter(authDb, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [
      env.BETTER_AUTH_URL || '',
      ...(env.ALLOWED_ORIGINS?.split(',').map((s: string) => s.trim()) || []),
    ].filter(Boolean),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (baUser: { id: string; name: string; email: string }) => {
            try {
              await db.insert(tenants).values({
                id: baUser.id,
                name: baUser.name || baUser.email,
                plan: 'free',
                monthlyEmailLimit: 500,
                monthlyEmailCount: 0,
              });

              await db.insert(users).values({
                id: baUser.id,
                tenantId: baUser.id,
                email: baUser.email,
                name: baUser.name,
                oauthProvider: 'email',
              });
            } catch (err) {
              console.error('Failed to create tenant/user for:', baUser.id, err);
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
