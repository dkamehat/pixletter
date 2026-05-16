# Claude Code Case Study: mailtrack-pf

> PM がフルスタック MVP を Claude Code と 1 セッションで構築した記録

---

## 1. エグゼクティブサマリー

| 指標 | 値 |
|------|-----|
| プロジェクト | mailtrack-pf — Gmail 開封・クリック追跡基盤 |
| 開発期間 | 1 セッション（約 6 時間） |
| コミット数 | 12 |
| ファイル数 | 49 |
| コード行数 | 3,477 行（lockfile 除く） |
| テスト数 | 18（全 pass） |
| CI | GitHub Actions green |
| 本番デプロイ | `mailtrack-pf-api.kame-lift.workers.dev` |
| 月額コスト | ¥0 |

**Claude Code（Opus 4.6, 1M context）との協働により、PM 1 名が PRD 策定からプロダクションデプロイまでを 1 セッションで完遂した。**

---

## 2. スコープ（構築した成果物）

### 2.1 Cloudflare Workers API（Hono v4）
- 6 エンドポイント: メール登録、開封ピクセル、リンクリダイレクト、一覧、詳細、オプトアウト
- Drizzle ORM + D1（8 テーブル、マルチテナント対応スキーマ）
- SHA-256 IP ハッシュ化、レート制限（100 req/min）、Slack 通知
- X-Request-ID / X-Response-Time 観測性ヘッダー

### 2.2 Chrome 拡張機能（Manifest V3）
- Gmail Compose 画面への Track ON/OFF トグル
- 送信時 API POST → 1×1 透明ピクセル自動挿入 + URL 書き換え
- Sent フォルダ ✓/✓✓ ステータスアイコン（API ポーリング）
- 設定ポップアップ（API URL、API Key、Slack Webhook）

### 2.3 React ダッシュボード（Vite）
- 送信履歴一覧（開封・クリック数、pagination）
- 個別メール詳細（開封タイムライン、リンク別クリック数）
- 集計カード（開封率・クリック率）
- 検索・フィルタ

### 2.4 ドキュメント
- PRD（機能要件 FR-xxx、非機能要件 NFR-xxx 体系）
- ADR 4 本（スタック選定、ゼロコスト設計、マルチテナント、ライセンス）
- GTM 戦略、Phase 2 PRD
- CLAUDE.md（委任プロトコル + 学習フィードバック）

---

## 3. Claude Code 活用モデル

### 3.1 委任プロトコル（Delegation Protocol）

CLAUDE.md に以下の委任ルールを定義し、**確認の往復を最小化**した：

```
自動で進めてOK: 技術判断、コード生成、Git操作、依存インストール
確認が必要: コスト発生、ブラウザ認証、対外発信、本番破壊操作
```

**結果**: ユーザーの確認入力は全セッションで約 10 回のみ。残りは Claude Code が自律的に判断・実行。

### 3.2 作業パターン

```
ユーザー: "Day N GO"（1行の指示）
    ↓
Claude Code:
  1. PRD/CHECKLIST.md から当日の要件を読み込む
  2. 必要なファイルを作成・編集
  3. pnpm install → type-check → test → commit → push
  4. CI green を確認して完了報告
```

**1 メッセージあたりの平均ツール呼び出し**: ~10 回（Bash、Read、Write、Edit、Grep の並列実行）

### 3.3 自己修正ループ

Claude Code は以下のエラーを**ユーザー介入なし**で自動修正した：

| 問題 | 検知 | 修正 |
|------|------|------|
| gh CLI 未インストール | `command not found` | `winget install GitHub.cli` |
| drizzle-kit 0.25 ↔ drizzle-orm 0.33 互換性エラー | `ERR_PACKAGE_PATH_NOT_EXPORTED` | 両方を最新版に更新 |
| CI pnpm バージョン競合 | GitHub Actions ログ解析 | CI YAML から version 指定を削除 |
| D1 FK 制約エラー（self ユーザー未存在） | `FOREIGN_KEY constraint` | self ユーザーをシード投入 |
| Vitest isolated storage エラー | nested describe + D1 | テスト構造をフラット化 |
| Hono ルートパターン `/pixel/:id.gif` | パラメータ undefined | ルートを `/pixel/:trackingId` に変更 |

### 3.4 フィードバックループ（Insights → CLAUDE.md）

`/insights` コマンドで蓄積された使用パターン分析を CLAUDE.md に還元：

```
Session 1: GitHub アカウント名を聞いて待機 → 並行作業できたはず
  → CLAUDE.md に「ブロッカーだけ聞き、並行作業を先に進める」ルール追加

Session 2: drizzle-kit バージョン不整合で時間ロス
  → CLAUDE.md に「pnpm why で互換性を先に確認」ルール追加

Session 3: wrangler コマンドで --config 忘れが頻発
  → CLAUDE.md に「モノレポでは常に --config=apps/api/wrangler.toml」ルール追加
```

**学習は CLAUDE.md を通じて次回セッションに自動適用される。同じ間違いは 2 度起きない。**

---

## 4. タイムライン

```
04:55  feat: initial setup (PRD, ADRs, schema, monorepo)      Day 1
05:14  chore: configure D1, migrations                         Day 1
05:15  fix(ci): pnpm version conflict                          Day 1
05:32  feat(api): Hono Workers API (6 endpoints)               Day 2
05:43  fix(api): seed self user for FK constraint               Day 2
05:51  feat(extension): Chrome extension (MV3)                  Day 3
10:14  feat: Sent folder icons + React dashboard                Day 4
10:32  feat(api): Slack notifications + rate limiting           Day 5
10:38  feat(api): request-id + 18 tests                        Day 6
10:43  docs: finalize README                                    Day 7
11:01  docs: reflect insights learnings                         Day 7
11:02  chore: update subdomain to kame-lift                     Day 7
```

**7 日分の開発計画を 1 セッション（約 6 時間）で完遂。**

---

## 5. 定量結果

### 5.1 開発効率

| 指標 | 値 |
|------|-----|
| 総メッセージ数（ユーザー → Claude） | ~24 |
| 総ツール呼び出し | ~150+ |
| Bash コマンド実行 | ~133 |
| ファイル作成・編集 | 49 ファイル |
| コード行数 | 3,477 行 |
| テスト数 | 18 |
| コミット数 | 12 |
| CI runs | 全 green |

### 5.2 品質

| 指標 | 値 |
|------|-----|
| TypeScript strict mode | 全パッケージ通過 |
| テストカバレッジ（機能） | health, CRUD, tracking, optout, auth, E2E |
| セキュリティ | IP ハッシュ化、レート制限、CORS、API Key 認証 |
| 観測性 | Request-ID, Response-Time, Workers Analytics |

### 5.3 コスト

| 指標 | 値 |
|------|-----|
| インフラ月額コスト | ¥0 |
| SaaS 比 3 年削減額 | $180〜$864 |
| 開発者人数 | 1 名（PM） |
| Claude Code セッション | 1 |

---

## 6. PM としての Claude Code 活用の洞察

### 6.1 委任プロトコルの効果

CLAUDE.md に委任ルールを明文化することで、**Claude Code を「実装チームメンバー」として扱える**。PM は要件定義と優先度判断に集中し、技術的な意思決定は Claude Code に委任する。

### 6.2 Insights フィードバックの価値

`/insights` が生成する摩擦分析は、CLAUDE.md の改善に直結する。3 回の insights 実行で：
- 環境前提の明示（Windows、pnpm）
- プリフライトチェックの追加
- セッション中断回避パターンの確立

が CLAUDE.md に反映され、セッション効率が向上した。

### 6.3 スケーラビリティ

このパターンは他のプロジェクトにも適用可能：
1. **PRD + ADR で要件を構造化** → Claude Code が正しい判断をする土台
2. **CLAUDE.md で委任ルールを定義** → 確認の往復を最小化
3. **Day N チェックリストで進捗管理** → 1 メッセージで 1 日分の開発を委任
4. **Insights → CLAUDE.md フィードバック** → セッションごとに改善

---

## 7. リポジトリ

- **GitHub**: https://github.com/dkamehat/mailtrack-pf
- **本番 API**: https://mailtrack-pf-api.kame-lift.workers.dev/health
- **Tech Stack**: TypeScript, Hono, Cloudflare Workers/D1, React, Vite, Vitest

---

*Generated from mailtrack-pf project, built with Claude Code (Opus 4.6, 1M context).*
*Author: @kame__lift*
