# Day 1 実行チェックリスト

このチェックリストに沿って進めれば、本日中（90 分目安）で Day 1 を完遂できる。

---

## 🎯 Day 1 のゴール

- [x] PRD・ADR・Phase 2 設計ドキュメントの整備
- [x] DB スキーマ（Phase 2 対応版）
- [x] モノレポセットアップ実ファイル一式
- [ ] **これから実行**: ローカル環境でリポジトリを動かせる状態にする
- [ ] **これから実行**: Cloudflare D1 を作成しマイグレーション適用
- [ ] **これから実行**: GitHub にプッシュして CI green を確認

---

## ⏱️ 90 分タイムボックス

### Phase A: ローカル展開（20 分）

```bash
# 1. 新しい作業フォルダを作る（プロジェクトフォルダのある場所で）
cd ~/Projects
mkdir mailtrack-pf
cd mailtrack-pf

# 2. このダウンロード済みファイル一式を配置
# /mnt/user-data/outputs/mailtrack-pf/ 以下をコピー

# 3. Node.js 20+ と pnpm 9+ を確認
node -v  # v20+ であること
pnpm -v  # 9+ であること

# 4. インストール
pnpm install
```

**チェック**:
- [ ] `pnpm install` が成功
- [ ] `node_modules` が作られている
- [ ] `pnpm-lock.yaml` が生成された

---

### Phase B: Git リポジトリ初期化（10 分）

```bash
# 1. Git 初期化
git init
git branch -M main

# 2. GitHub で空のリポジトリ作成
# https://github.com/new → Repository name: mailtrack-pf, Public, Initialize は OFF

# 3. リモート追加
git remote add origin git@github.com:<your-account>/mailtrack-pf.git

# 4. 初回コミット
git add .
git commit -m "feat: initial setup with PRD, ADRs, DB schema, and monorepo

Phase 1 Day 1 deliverables:
- PRD with FR/NFR/KPI specifications
- ADR-001 (Cloudflare ecosystem stack selection)
- ADR-002 (zero-cost operations design)
- Phase 2 design: PRD-Phase2, ADR-003, ADR-004, GTM-STRATEGY
- DB schema with multi-tenant readiness (tenant_id)
- Turborepo + pnpm monorepo structure
- TypeScript strict mode
- AGPLv3 license declaration"

git push -u origin main
```

**チェック**:
- [ ] GitHub にリポジトリ作成完了
- [ ] 初回コミットが GitHub に反映
- [ ] GitHub Actions の CI が green（または「テストなし」の状態で pass）

---

### Phase C: Cloudflare D1 セットアップ（30 分）

```bash
# 1. Cloudflare アカウントにログイン（未作成なら作成）
# https://dash.cloudflare.com/sign-up（無料）

# 2. wrangler でログイン
pnpm wrangler login

# 3. D1 データベース作成
pnpm wrangler d1 create mailtrack-pf-db

# 出力例:
# ✅ Successfully created DB 'mailtrack-pf-db'
# [[d1_databases]]
# binding = "DB"
# database_name = "mailtrack-pf-db"
# database_id = "12345678-1234-..."

# 4. database_id をメモして apps/api/wrangler.toml に追加
# （wrangler.toml 内のコメントアウト部分を編集）

# 5. マイグレーション SQL を生成
pnpm db:generate

# packages/db/migrations/0000_init.sql が生成される

# 6. ローカル D1 にマイグレーション適用（テスト用）
pnpm db:migrate:local

# 7. リモート D1 にマイグレーション適用
pnpm db:migrate:remote

# 8. self テナント投入
pnpm db:seed:self

# 9. 確認: テーブル一覧を取得
pnpm wrangler d1 execute mailtrack-pf-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table';"
```

**チェック**:
- [ ] D1 データベース作成成功
- [ ] `apps/api/wrangler.toml` に database_id 設定
- [ ] マイグレーション適用成功（テーブル 8 つ作成: tenants, users, apiKeys, emails, opens, links, clicks, optouts）
- [ ] self テナント投入成功

---

### Phase D: 環境変数とドキュメント仕上げ（15 分）

```bash
# 1. 環境変数ファイル作成
cp .env.example .env

# 2. Cloudflare Account ID を .env に書く
# https://dash.cloudflare.com/ 右上のアカウント ID をコピー

# 3. CLOUDFLARE_D1_DATABASE_ID を .env に書く（Phase C step 3 で取得した値）

# 4. README の <your-account> 等のプレースホルダーを実値に置換
# README.md, package.json, SETUP.md 等

# 5. 2 回目のコミット
git add .
git commit -m "chore: configure D1 database and environment variables"
git push
```

**チェック**:
- [ ] `.env` に Cloudflare 認証情報が設定済み
- [ ] README の `<your-account>` を実際のアカウント名に置換
- [ ] 2 回目のコミットが GitHub に反映

---

### Phase E: 最終確認（15 分）

```bash
# 1. リポジトリ全体の type-check
pnpm type-check

# 2. lint（ESLint 設定は Day 2 で追加するため、いまは空でも OK）
pnpm lint || echo "lint not configured yet, skip"

# 3. GitHub の Actions タブで CI が green か確認
```

**チェック**:
- [ ] `pnpm type-check` がエラーなし
- [ ] GitHub Actions の CI が green
- [ ] README が公開時にきちんと表示される（GitHub で確認）

---

## 🚀 Day 2 への引き継ぎ

Day 1 完了後、次のセッションで以下に着手:

```
Day 2 のゴール:
- apps/api/ で Hono + Workers の API 実装
- POST /api/emails エンドポイント
- GET /pixel/:id.gif エンドポイント
- GET /r/:id エンドポイント
- Vitest でユニットテスト
- wrangler dev でローカル動作確認
- wrangler deploy で本番デプロイ
```

**Day 2 開始時、Claude に共有する情報**:
- GitHub リポジトリ URL
- Cloudflare アカウント ID（Secret 扱い不要、API 経由でのみ機密）
- D1 database_id
- 「Day 1 完了、Day 2 着手」と一言

---

## ❓ よくあるトラブル

### `pnpm install` がエラーになる

- Node.js のバージョン確認（v20 以上必須）
- `corepack enable` を実行して pnpm をアクティブ化

### `wrangler login` がブラウザを開かない

- ターミナルから手動で表示された URL を開く
- それでも失敗する場合は `wrangler login --browser=false` で API トークン経由ログイン

### D1 マイグレーションが失敗する

- `packages/db/migrations/0000_init.sql` が生成されているか確認
- 失敗したら `pnpm wrangler d1 execute mailtrack-pf-db --remote --command="SELECT * FROM sqlite_master;"` でテーブル状態を確認
- 必要なら `DROP TABLE` で全削除してから再適用

### GitHub Actions の CI が red

- このフェーズではテストファイルがないため `pnpm test` でエラーになる可能性
- Day 2 でテストを追加するまで `.github/workflows/ci.yml` の `pnpm test` 行をコメントアウトしても OK

---

## ✅ Day 1 完了の証拠

すべて満たせば Day 1 完遂:

- [ ] GitHub の Public リポジトリに 10 個以上のファイルがある
- [ ] README が GitHub 上で正しくレンダリングされる
- [ ] Cloudflare D1 に 8 つのテーブルが存在する
- [ ] self テナントが tenants テーブルに 1 行 INSERT されている
- [ ] CI バッジ（README に追加するなら）が緑
- [ ] 自分の Twitter or LinkedIn で「Day 1 完了」を発信できる状態（任意）

---

完遂したら、Day 2 着手に進む準備完了。
