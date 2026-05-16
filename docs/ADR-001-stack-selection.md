# ADR-001: フルスタック技術選定

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Supersedes | — |

---

## Context（背景）

`mailtrack-pf` は個人で運用するメールトラッキング基盤。要件は PRD.md にあるが、技術選定における主要制約は以下：

1. **運用コスト¥0**（NFR-COST-01）
2. **1 週間スプリントで MVP 完成**（PRD §9.1）
3. **採用ポートフォリオとして提示**（PRD §7.2）
4. **Gmail Chrome 拡張・API・DB・ダッシュボードの 4 コンポーネント**を統合
5. **Edge レイテンシ要件**: ピクセル応答 P95 ≤ 50ms（NFR-PERF-01）

候補となる主要構成:

| 構成案 | 概要 |
|---|---|
| A | Cloudflare 完全統合（Workers + D1 + Pages） |
| B | Vercel + Supabase（一般的な Next.js スタック） |
| C | AWS Lambda + DynamoDB + Amplify |
| D | 自宅 VPS + PostgreSQL + Docker |

---

## Decision（決定）

**案 A: Cloudflare エコシステム完全統合** を採用する。

### 採用スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| 拡張機能 | Chrome Extension Manifest V3 | latest |
| API | Cloudflare Workers + Hono | Hono v4 |
| DB | Cloudflare D1 (SQLite) | — |
| ORM | Drizzle ORM | latest |
| ダッシュボード | Next.js 15 App Router | 15.x |
| ホスティング | Cloudflare Pages | — |
| UI | shadcn/ui + Tailwind CSS | latest |
| 認証 | Better Auth | latest |
| バリデーション | Zod | v3 |
| モノレポ | Turborepo + pnpm | latest |
| テスト | Vitest + Playwright | latest |
| 観測性 | Sentry + Workers Analytics | — |
| 言語 | TypeScript (strict mode) | 5.x |

---

## Rationale（判断理由）

### Cloudflare エコシステムを選ぶ 4 つの根拠

#### 1. 完全無料運用が実質的に保証される

| サービス | 無料枠 | 個人運用での使用率（試算） |
|---|---|---|
| Workers | 10 万 req/日 | 約 0.1% |
| D1 | 5GB · 500 万 read/日 | 約 0.01% |
| Pages | 無制限帯域 · 500 ビルド/月 | 約 5% |

→ 1000 倍以上の余裕。スパイクしても無料枠内。

#### 2. エッジ統合によるレイテンシ最適化

Workers と D1 は同一エッジロケーションで実行される。ピクセルリクエスト → DB INSERT → 1×1 GIF 返却が**ネットワーク往復なしで完結**するため、P95 < 30ms 達成が現実的。

Vercel + Supabase 構成の場合：
- Vercel Function (US East) → Supabase (US East): RTT 5〜20ms
- 日本からのリクエスト: コールドスタート込みで 200ms+ になりうる

#### 3. Vercel Hobby の商用利用不可問題を回避

[Vercel の利用規約](https://vercel.com/legal/terms) では Hobby プランの商用利用が禁止されている。業務メール送信は「商用」と解釈されうる。Cloudflare Pages は無料プランでも商用利用 OK。

#### 4. Supabase の 7 日休止リスクを回避

Supabase 無料プランはプロジェクトが 7 日間アクティビティなしで自動一時停止する。個人運用で送信が散発的な場合に止まるリスクがある。D1 は常時稼働。

---

## Considered Alternatives（検討した他案）

### 案 B: Vercel + Supabase

**Pros**:
- 一般的なスタック、情報が豊富
- Supabase の認証・ストレージ機能が強力
- リアルタイム機能（Realtime）が標準

**Cons**:
- Vercel Hobby の商用利用制約
- Supabase 7 日休止リスク
- ピクセル応答レイテンシが Cloudflare に劣る（日本リージョン未対応）
- 2 つのプロバイダ管理、デプロイパイプラインが複雑化

**判定**: Cons が無料運用要件に直撃するため不採用。

### 案 C: AWS Lambda + DynamoDB + Amplify

**Pros**:
- スケーラビリティ最高
- Amazon 関連の経験は PM 面接で語れる
- 細かい IAM 制御

**Cons**:
- 無料枠は限定的、長期運用で課金リスク
- 設定の複雑性（IAM、API Gateway、Lambda、DynamoDB、Amplify）
- 1 週間スプリントで MVP に到達しにくい
- ピクセル応答は Lambda コールドスタートで 200ms+ のリスク

**判定**: コストと開発速度で劣るため不採用。Cloudflareでの実装経験を積むことで、他クラウドへの移行設計知識も得られる。

### 案 D: 自宅 VPS + PostgreSQL + Docker

**Pros**:
- 完全データ主権
- 学習効果が大きい

**Cons**:
- 電気代・回線代が事実上のランニングコスト
- 可用性が VPS / 自宅環境に依存
- 採用面接で「最新スタックでない」と見られるリスク
- ピクセル応答のグローバル分散が困難

**判定**: 完全無料を満たさず、可用性も劣るため不採用。

---

## Consequences（結果として起きること）

### Positive

- ✅ 月額¥0 運用が確実に達成可能
- ✅ ピクセル応答 P95 < 50ms が現実的
- ✅ デプロイパイプラインが Cloudflare 1 社で完結
- ✅ TypeScript 統一によるエンドツーエンド型安全性
- ✅ Hono on Workers は Anthropic 製 LLM API ラッパーとの相性が良い（Phase 2 拡張時）

### Negative

- ⚠️ Cloudflare ベンダーロックイン（D1 の SQL 方言、Workers ランタイム特有 API）
  - 緩和策: ORM レイヤー（Drizzle）と Hono で抽象化、ロジック層は移植可能に保つ
- ⚠️ D1 は SQLite ベース、複雑な JSON クエリや大量同時書き込みは苦手
  - 緩和策: 現スキーマでは問題なし。将来必要なら Cloudflare D2（PostgreSQL 互換、2026 年発表予定）へ移行
- ⚠️ Cloudflare 障害時に全機能停止
  - 緩和策: Cloudflare SLA 99.99%、過去 12 ヶ月の実績で個人運用には十分

### Neutral

- 🟡 採用面接で「なぜ Cloudflare？」と聞かれる可能性が高い
  - → これは ADR を見せられるので**強み**になる

---

## References

- [Cloudflare Workers Pricing](https://www.cloudflare.com/plans/developer-platform/)
- [Vercel Terms of Service](https://vercel.com/legal/terms)
- [Supabase Free Plan Pause Policy](https://supabase.com/docs/guides/platform/pause-and-restore)
- [Hono Framework](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

## Review Log

| Date | Reviewer | Comment | Action |
|---|---|---|---|
| 2026-05-14 | kame_lift | Initial draft | Approved |
