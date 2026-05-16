# ADR-004: OSS ライセンス選定とホスティングモデル

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | PRD-Phase2.md, ADR-003 |

---

## Context

Phase 2 で OSS 化する際の**ライセンス選定**は、シェア・収益化可能性・コントロールに直結する戦略判断。

### 主要な問い

1. どのライセンスを選ぶか？（MIT / Apache 2.0 / AGPLv3 / BSL / Elastic License）
2. OSS版と公式ホスティング版の機能差をどう設計するか？
3. 将来の商用化（Phase 3）の余地を残すには？
4. 「ユーザーが Fork して有料 SaaS を立ち上げる」リスクをどう扱うか？

---

## Decision

### 採用ライセンス: **AGPLv3（GNU Affero General Public License v3.0）**

### 採用モデル: **Open Core + Permissive Trust**

```
mailtrack-pf (本体)
├── AGPLv3 ライセンス（コア機能すべて）
├── OSS版: 誰でも Fork ・自社運用可
└── 公式ホスティング版: 私（作者）が運営、AGPLv3 ソースを参照する SaaS
```

### Phase 3 で検討するエンタープライズ機能（参考）

将来、企業向け機能を追加する場合は **別リポジトリの BSL（Business Source License）** で実装する余地を残す。ただし Phase 2 ではコア機能のみ。

---

## Rationale

### なぜ AGPLv3 か

#### 1. ホスティング転売を防げる

AGPLv3 の **§13（Remote Network Interaction）** により、ソースを改変して**ネットワーク経由でサービス提供**する場合、改変版のソースコード公開義務が発生する。

→ 大手クラウドが mailtrack-pf を Fork して有料 SaaS にする場合、改変ソースを公開しなければならない。これは事実上の**ホスティング転売抑止**となる。

#### 2. 先行事例の成功実績

| プロダクト | ライセンス | 成果 |
|---|---|---|
| Plausible Analytics | AGPLv3 | ARR $1M+ |
| Cal.com | AGPLv3 | ARR $5M+ |
| Mastodon | AGPLv3 | 数百万 MAU |
| Grafana | AGPLv3 (Loki, Tempo) | 商用ホスティングと両立 |

**特に Plausible は本プロジェクトと類似構造**（OSS + 公式ホスティング、データ主権訴求）。

#### 3. データ主権との一貫性

ユーザーへのメッセージ:
> 「私たちのソースは AGPLv3 で完全公開されている。あなたは公式版を使うか、自分で動かすか選べる。**透明性を法的に保証**する。」

これは PRD-Phase2 の Earn Trust 戦略と整合。

#### 4. AGPLv3 の懸念点と緩和策

| 懸念 | 緩和策 |
|---|---|
| 「エンプラがコピーレフトを嫌う」 | 公式版 SaaS を使えばユーザー側にコピーレフト義務は発生しない |
| 「組み込みライブラリとしては使えない」 | mailtrack-pf は組み込み用途ではないので問題なし |
| 「将来 BSL に切り替えたい時に困る」 | Phase 3 用に CLA（Contributor License Agreement）を整備しておく |

---

## Considered Alternatives

### MIT License

**Pros**:
- 最も自由、貢献者を集めやすい
- 採用率最高（GitHub の OSS の大半）

**Cons**:
- 大手クラウドが Fork して有料 SaaS にできる（Redis や ElasticSearch の歴史的教訓）
- 「タダ働き」になるリスク

**判定**: ホスティング転売抑止が必要なため不採用。

### Apache 2.0

**Pros**:
- 特許条項あり、エンプラ採用しやすい
- 商用転売も可能だが特許訴訟への防御策

**Cons**:
- ホスティング転売を抑止できない（MIT と同じ）

**判定**: 同上の理由で不採用。

### BSL（Business Source License、MariaDB / Sentry / Cockroach 採用）

**Pros**:
- 期間限定で商用利用制限可能
- N 年後に GPL / Apache に自動変換

**Cons**:
- **OSS と認められない**（OSI 公認外）
- 「Source Available」と呼ばれることが多い
- コミュニティ・コントリビュータ獲得に不利

**判定**: Phase 2 の「OSS で信頼獲得」戦略と矛盾。**Phase 3 のエンタープライズ機能**には適しているので、その時点で別リポジトリとして検討。

### Elastic License v2

**Pros**:
- ホスティング転売を明示的に禁止
- 改変ソース公開不要

**Cons**:
- OSI 非公認、OSS 扱いされない
- Elasticsearch 移行時に大きな非難（コミュニティの信頼失墜）

**判定**: 不採用。AGPLv3 の方がコミュニティの納得感が高い。

### Dual License（AGPLv3 + 商用）

**Pros**:
- AGPLv3 が嫌な企業に商用ライセンス販売可能
- 将来の収益化オプション

**Cons**:
- CLA 必須、コントリビューター管理が複雑
- Phase 2 段階では運用負荷大

**判定**: **Phase 3 で検討**。AGPLv3 単独でスタート、CLA だけは Phase 2 で導入。

---

## Open Core モデルの設計

### Tier 1: OSS版（AGPLv3）

**含まれる機能（コア）**:
- Chrome 拡張（Manifest V3）
- API（Workers + Hono）
- DB スキーマ（D1 + Drizzle）
- ダッシュボード（Next.js）
- マルチテナント機構（`HOSTING_MODE` 切り替え）
- 全コンプライアンス機構（opt-out 等）

**含まれない機能（オプショナル、別リポ）**:
- Phase 3 で検討する高度機能（A/B テスト、AI 連携、CRM 統合等）

### Tier 2: 公式ホスティング版

**追加で提供されるもの**:
- 自分のサーバーで運営（ユーザーは Sign up だけで利用可）
- Cloudflare アカウント不要
- 自動アップデート
- カスタマーサポート（ベストエフォート、GitHub Discussions）

**価格**: 無料（Phase 2）、将来 Pro 機能で課金検討（Phase 3）

### Tier 3: Phase 3 で検討するエンタープライズ機能（参考）

将来の議論ポイント:
- SSO・SAML 認証
- 監査ログ
- カスタムドメイン
- SLA 保証
- 専用サポート

これらは **別リポジトリ + BSL ライセンス**で実装するオプションを残す。Phase 2 では扱わない。

---

## CLA（Contributor License Agreement）の準備

将来のライセンス変更（AGPL → 商用化）を可能にするため、Phase 2 開始時に CLA を導入:

```
By contributing, you grant the project maintainer (kame_lift) the right to relicense
your contributions under any license (including commercial licenses).
```

**実装**:
- GitHub Actions の `cla-assistant` を使用（無料）
- 初回 PR で自動的に CLA への同意を求める
- 個人コントリビューターは Individual CLA
- 企業コントリビューターは Corporate CLA

参考: Cal.com、Plausible が同様の運用。

---

## Consequences

### Positive

- ✅ ホスティング転売を法的に抑止
- ✅ OSS コミュニティでの信頼獲得
- ✅ 採用面接で「OSS ライセンス戦略の意思決定」を語れる（Are Right, A Lot）
- ✅ Phase 3 で商用化する余地を CLA で残す

### Negative

- ⚠️ AGPLv3 を嫌う企業ユーザーがいる
  - 緩和策: 公式版を使ってもらえばユーザー側にコピーレフト義務なし
- ⚠️ ライセンスの説明が必要（FAQ 必須）
  - 緩和策: README に明確な FAQ セクション
- ⚠️ CLA 導入で初回コントリビューションのハードルが上がる
  - 緩和策: cla-assistant で自動化、ドキュメントで意義を説明

### Neutral

- 🟡 ライセンス選定自体が PR のネタになる
  - Show HN のタイトルに「AGPLv3 open-source MailSuite alternative」と書ける

---

## ブランディングと商標

| 項目 | 方針 |
|---|---|
| プロダクト名 | `mailtrack-pf`（仮）→ Phase 2 着手時に再検討 |
| ロゴ | 内製（Phase 2 Week 4） |
| ドメイン | `mailtrack-pf.dev` を取得（年 $9） |
| 商標登録 | Phase 3 で MAU 増えてから検討 |
| forked ブランド | AGPLv3 上は名称変更必須（forker は別名で運営必須） |

---

## References

- AGPLv3 Full Text: https://www.gnu.org/licenses/agpl-3.0.html
- Plausible Licensing: https://github.com/plausible/analytics/blob/master/LICENSE.md
- Cal.com CLA: https://github.com/calcom/cal.com/blob/main/cla.md
- Open Core Summit 2025 keynote summary
- "Why we changed our license from Elastic to AGPL" - Cal.com blog
