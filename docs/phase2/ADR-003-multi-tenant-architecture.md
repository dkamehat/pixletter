# ADR-003: マルチテナント・アーキテクチャ

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | PRD-Phase2.md, ADR-001, ADR-002 |

---

## Context

Phase 2 で **Open Core モデル**（OSS版 + 公式ホスティング版）を展開する。公式版は不特定多数のユーザーを受け入れるため、Phase 1 のシングルテナント設計を **マルチテナント化**する必要がある。

### 主要な技術的問い

1. データ分離方式は？（共有 DB + tenant_id / DB per tenant / Schema per tenant）
2. 認証はどう強化するか？
3. レート制限・abuse 対策はどうするか？
4. OSS版とのコードベース統一は維持できるか？
5. Cloudflare D1 の制約下で何が可能か？

---

## Decision

### 採用方式: 共有 DB + `tenant_id` カラム方式（Pool Model）

全テーブルに `tenant_id` を追加し、すべてのクエリで強制フィルタする。

### 1. データ分離方式

| 方式 | 採否 | 理由 |
|---|---|---|
| **Pool（共有 DB + tenant_id）** | ✅ 採用 | D1 に最適、コスト低、運用シンプル |
| Silo（テナントごとに別 DB） | ❌ | D1 で 1000 DB は管理不能、無料枠オーバー |
| Schema-per-tenant | ❌ | SQLite/D1 はマルチスキーマ未対応 |
| Bridge（混合） | ❌ | 過剰な複雑性 |

### 2. データ分離の強制

| レイヤー | 対策 |
|---|---|
| アプリケーション層 | Drizzle ORM のクエリビルダーラッパーで `tenant_id` 自動付与 |
| ミドルウェア | Hono の middleware で認証ユーザーから tenant_id 抽出、context に注入 |
| クエリ | 全 SELECT/UPDATE/DELETE で `WHERE tenant_id = ?` 必須 |
| 監査 | テストで「tenant_id 不一致時はエラー」を強制 |

### 3. 認証強化

| 機能 | 実装 |
|---|---|
| Sign up | Google OAuth + Magic Link（Better Auth） |
| API キー | tenant ごとに発行、Chrome 拡張機能から送信 |
| セッション管理 | Cookie ベース、HttpOnly + Secure + SameSite=Lax |
| ログアウト | サーバー側セッション失効 |

### 4. レート制限・abuse 対策

| 対策 | 実装 |
|---|---|
| ユーザーごと送信上限 | 月 500 通（無料）、Cloudflare KV でカウンタ管理 |
| IP ベースのレート制限 | Cloudflare Rate Limiting Rules（無料枠あり） |
| 不正検知 | Sign up 後 24h は送信上限 10 通に制限 |
| Abuse 報告窓口 | フッターに `report@mailtrack-pf.dev` リンク |
| 自動 BAN | 受信者からの opt-out が同一ユーザーで 10 件超 → 自動凍結 |

### 5. OSS版とのコードベース統一

**シングルコードベース、環境変数で切り替え**:

```typescript
// apps/api/src/auth/index.ts
const isHosted = process.env.HOSTING_MODE === 'hosted';

if (isHosted) {
  // 公式版: マルチテナント、レート制限、abuse 対策
  app.use(multitenant());
  app.use(rateLimit({ free: 500 }));
} else {
  // OSS版: シングルテナント、制限なし
  app.use(singleTenant({ defaultUserId: 'self' }));
}
```

これにより:
- OSS版ユーザーは自分のCloudflareでデプロイすれば追加機能不要
- 公式版は同じコードベースに `HOSTING_MODE=hosted` を設定するだけ

---

## Rationale

### Pool モデルを選ぶ理由

#### 1. Cloudflare D1 の制約

D1 の現実的な上限:
- 1 アカウントで作れる DB 数に上限あり
- DB ごとの接続オーバーヘッド
- Silo モデルだと 1,000 ユーザー = 1,000 DB で破綻

Pool モデルなら **1 DB で 100 万ユーザー**を捌ける（理論値）。

#### 2. コスト効率

- Silo: DB あたりのストレージ最低保証で無料枠超過
- Pool: ユーザー増加に対してストレージは線形、無料枠 5GB で 1 万ユーザー以上

#### 3. 運用シンプルさ

- マイグレーション: 1 回で全テナントに適用
- バックアップ: 1 つの DB を取るだけ
- 監視: 1 つのメトリクスを見るだけ

#### 4. データ分離のリスク制御

Pool モデルの最大リスク = **「あるテナントのデータが別テナントから見える」漏洩**。

対策:
- **Drizzle ラッパーでクエリビルダーを抽象化**:

```typescript
// packages/db/queries/scoped.ts
export function scopedQuery(db: D1Database, tenantId: string) {
  return {
    emails: {
      findMany: () => db.select().from(emails).where(eq(emails.tenantId, tenantId)),
      findById: (id: string) => db.select().from(emails)
        .where(and(eq(emails.id, id), eq(emails.tenantId, tenantId))),
      // ...
    },
  };
}
```

- API ハンドラーは生 SQL を書かず、必ずこのラッパー経由

### 認証に Better Auth を選ぶ理由

| 候補 | 採否 | 理由 |
|---|---|---|
| Better Auth | ✅ | self-host可、Cloudflare Workers対応、Magic Link + OAuth 標準 |
| Clerk | ❌ | 月額課金、コスト要件と矛盾 |
| Supabase Auth | ❌ | Supabase 採用しない（ADR-001） |
| 自前実装 | ❌ | セキュリティ実装は専門家依存推奨 |

---

## Consequences

### Positive

- ✅ D1 無料枠で 1 万ユーザー以上収容可能
- ✅ OSS版と公式版のコードベース共通化
- ✅ 運用負荷が低い（DB 1 つ、認証 1 系統）
- ✅ tenant_id 強制ラッパーでデータ漏洩リスクを技術的に制御

### Negative

- ⚠️ Pool モデルは「特権テナント」を作れない（全員同じ DB）
  - 緩和策: 大口顧客が出てきたら Phase 3 で Silo モデルへ移行設計
- ⚠️ tenant_id を query から外すバグが致命的（データ漏洩）
  - 緩和策: scopedQuery ラッパー必須化、CI で生 SQL の使用を ESLint で検知
- ⚠️ Better Auth は新しめのライブラリで本番実績が浅い
  - 緩和策: セキュリティ Issue を GitHub で追跡、必要なら fork 検討

### Neutral

- 🟡 OSS版ユーザーは `tenant_id` カラムが冗長（常に同じ値）
  - 影響なし、ストレージ的にも誤差レベル

---

## DB スキーマ差分（Phase 1 → Phase 2）

```typescript
// packages/db/schema.ts に追加

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  plan: text('plan', { enum: ['free', 'pro'] }).default('free').notNull(),
  monthlyEmailLimit: integer('monthly_email_limit').default(500).notNull(),
  monthlyEmailCount: integer('monthly_email_count').default(0).notNull(),
  resetAt: integer('reset_at', { mode: 'timestamp' }).notNull(),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
});

// 既存テーブルに追加するカラム
// users: tenantId, oauthProvider, oauthId
// emails: tenantId
// opens, links, clicks, optouts: tenantId（テナント分離強制）

// API キー管理
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  keyHash: text('key_hash').notNull(), // ハッシュ化して保存
  name: text('name'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
});
```

---

## マイグレーション戦略（Phase 1 → Phase 2）

Phase 1 で個人運用していたデータを Phase 2 で引き継ぐ:

```sql
-- 1. tenants テーブル作成
-- 2. 自分のテナントを INSERT
-- 3. 既存 users/emails/opens/links/clicks/optouts に tenant_id カラム追加
-- 4. 既存データに自分の tenant_id を UPDATE
-- 5. tenant_id を NOT NULL 制約に変更
```

`packages/db/migrations/0002_multitenant.sql` として記述。

---

## References

- AWS SaaS Architecture Patterns (Pool / Silo / Bridge): https://aws.amazon.com/builders-library/multi-tenant-saas-architecture/
- Better Auth Docs: https://better-auth.com/
- Cloudflare D1 Limits: https://developers.cloudflare.com/d1/platform/limits/
- Plausible Multi-tenancy: https://github.com/plausible/analytics
