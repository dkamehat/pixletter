# ADR-002: 無料運用設計（ゼロコストアーキテクチャ）

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | ADR-001 (Stack Selection) |

---

## Context

PRD §6.4 (NFR-COST-01) で「月額運用コスト ¥0」を必達制約として設定した。本 ADR は、その制約を満たすための具体的なサービス選定・運用設計を記録する。

ADR-001 で Cloudflare エコシステムを採用したが、それだけでは無料運用は保証されない。**全コンポーネントで無料枠内に収める設計判断**が必要。

---

## Decision

以下のゼロコスト構成を採用する。

### サービス別の無料運用契約

| 用途 | サービス | 無料枠 | 想定使用量 | 余裕度 |
|---|---|---|---|---|
| API・ピクセル配信 | Cloudflare Workers | 10 万 req/日 | 100 req/日 | 1000× |
| DB | Cloudflare D1 | 5GB · 500 万 read/日 · 10 万 write/日 | 100 read/日 · 50 write/日 | 5 万× |
| ダッシュボード | Cloudflare Pages | 無制限帯域 · 500 ビルド/月 | 30 ビルド/月 | 16× |
| ソース管理 | GitHub Public Repo | 無制限 | 1 リポジトリ | ∞ |
| CI | GitHub Actions | Public は無制限 | 30 分/月 | ∞ |
| エラー監視 | Sentry Developer | 5,000 errors/月 | 推定 50 errors/月 | 100× |
| Chrome 拡張 | 開発者モード自己インストール | $0（公開しない） | — | — |
| ドメイン | `*.workers.dev` / `*.pages.dev` | $0 | — | — |
| ユーザー認証 | Better Auth (self-hosted) | $0 | — | — |

**合計: ¥0/月、¥0/年**

---

## Rationale

### 重要な意思決定 5 つ

#### Decision 2.1: ドメインを取得しない

- **判断**: `mailtrack-pf.<account>.workers.dev` 等のサブドメインで運用
- **理由**:
  - ピクセル URL の長さは追跡精度に影響なし
  - 採用ポートフォリオ用途では `workers.dev` でも問題視されない
  - Cloudflare Registrar 経由なら年 $8.57 で取得可能（後付け可能）
- **トレードオフ**: メール本文に `workers.dev` URL が現れることで一部スパムフィルタの判定に影響する可能性
- **対策**: Phase 2 でドメイン取得を検討（その時点で実際の問題があれば）

#### Decision 2.2: Chrome Web Store に公開しない

- **判断**: Chrome 開発者モードで自分のマシンに `Load unpacked` でインストール
- **理由**:
  - Chrome Web Store 公開は$5（一度のみ）だが、無料制約を厳格に守る
  - 利用者は本人 1 名のため公開不要
  - GitHub にビルド済み `.zip` を Release として公開し、採用担当が試せるようにする
- **トレードオフ**: 拡張機能のアップデートが Chrome Web Store 経由で自動配信されない
- **対策**: 自分用なので手動で `chrome://extensions` から Reload で対応

#### Decision 2.3: Supabase ではなく Cloudflare D1 を採用

- **判断**: ADR-001 でも触れたが、無料運用観点でも D1 を採用
- **理由**:
  - Supabase 無料プランは **7 日間アクティビティなしで自動一時停止**
  - 個人運用で散発的な利用パターンの場合、停止 → 再起動 → 接続エラーの可能性
  - D1 は常時稼働、追加コストなし
- **トレードオフ**: D1 の SQL 方言は SQLite ベース、複雑な JSON 操作が不便
- **対策**: 現スキーマは単純なリレーショナル構造、JSON 操作不要

#### Decision 2.4: Vercel ではなく Cloudflare Pages を採用

- **判断**: ダッシュボードのホスティングは Cloudflare Pages
- **理由**:
  - Vercel Hobby プランは**商用利用禁止**
  - 業務メール送信は「商用」と解釈されうるグレーゾーン
  - Cloudflare Pages は無料でも商用 OK、帯域無制限
- **トレードオフ**: Next.js の一部最新機能（Partial Prerendering 等）は Cloudflare Pages のサポートが遅れることがある
- **対策**: 必要な機能のみ採用、エッジ実行で問題ない範囲に留める

#### Decision 2.5: ベーシック認証ではなく Better Auth を採用

- **判断**: 一人ユーザーでも認証は Better Auth（Magic Link）を採用
- **理由**:
  - Phase 2 でマルチテナント化する余地を残す
  - ベーシック認証より採用面接で語りやすい（OAuth・Magic Link 経験を示せる）
  - Better Auth は self-hosted で無料
- **トレードオフ**: Day 1 で実装する分量が増える
- **対策**: Day 5 のダッシュボード実装と合わせて 1 日で完了

---

## Cost Forecast（コスト見通し）

### 12 ヶ月後の予想コスト

| シナリオ | 月コスト | 12ヶ月累計 |
|---|---|---|
| 想定通り個人利用 | ¥0 | ¥0 |
| 利用量 10 倍（1000 req/日） | ¥0 | ¥0 |
| 利用量 100 倍（10,000 req/日） | ¥0 | ¥0 |
| 利用量 1000 倍（100,000 req/日） | ¥0（無料枠上限） | ¥0 |
| Workers 無料枠超過時 | $5/月（Workers Paid 切替） | $60 |

→ 個人運用では物理的に課金到達しない。

### 比較：SaaS の TCO

| 比較対象 | 月額 | 年額 | 3 年累計 |
|---|---|---|---|
| MailSuite Pro | $4.99 | $59.88 | $179.64 |
| Mixmax Starter | $24 | $288 | $864 |
| HubSpot Sales Starter | $20 | $240 | $720 |
| **mailtrack-pf（自作）** | **$0** | **$0** | **$0** |

→ 3 年運用で MailSuite 比 **$180 削減**、Mixmax 比 **$864 削減**。

---

## Consequences

### Positive

- ✅ TCO ¥0 が確実に達成可能
- ✅ 採用面接で「Frugality」と「Are Right, A Lot」の STAR エピソードとして語れる
- ✅ スタートアップ・予算制約のあるチームでも適用可能な普遍的設計
- ✅ Cloudflare の単一ベンダーで全機能完結、運用がシンプル

### Negative

- ⚠️ Cloudflare 障害時に全機能停止（単一障害点）
  - 緩和策: 個人運用なので業務継続要件は緩い、復旧待ち許容
- ⚠️ Cloudflare の無料プラン変更リスク（将来の値上げ・無料枠縮小）
  - 緩和策: 抽象化レイヤー（Hono, Drizzle）で他クラウドへの移植性を確保
- ⚠️ 利用が爆発的に増えた場合（マルチテナント化等）に再設計が必要
  - 緩和策: Phase 2 でその判断、現時点では問題なし

---

## ポートフォリオ STAR 連動

このゼロコスト設計は採用面接で以下の Amazon LP を示すエピソードに直結する：

### LP: Frugality（倹約）

> **S**: 個人開発で TCO ¥0 を必達制約とした。
>
> **T**: 一般的なフルスタック MVP は Vercel + Supabase + ドメインで $20〜30/月かかる。これをゼロに圧縮する。
>
> **A**: Vercel Hobby の商用利用制約、Supabase の 7 日休止リスクを ADR で明文化した上で、Cloudflare エコシステムへの一本化を判断。各サービスの無料枠を試算し、想定使用量の 1000 倍の余裕があることを確認。
>
> **R**: TCO ¥0 で本番稼働、SaaS 相当の 3 年運用比 $180〜$864 削減。同時にエッジ統合で P95 < 30ms を達成。

### LP: Are Right, A Lot（強い判断力）

> 単に「無料サービスを並べた」のではなく、商用利用規約・自動休止・ベンダーロックインのトレードオフを ADR で文書化し、Phase 2 の移行戦略まで明示している点。

---

## References

- ADR-001: Stack Selection
- PRD.md §6.4 (Cost requirements)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
