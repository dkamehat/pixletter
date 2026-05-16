# SETUP.md — Day 1 初期セットアップ手順

このドキュメントは `mailtrack-pf` の開発環境を 0 から構築するためのチェックリスト。
**所要時間: 約 60〜90 分**

---

## 前提条件

- Node.js v20 以上
- pnpm v9 以上（`npm install -g pnpm`）
- Git
- Cloudflare アカウント（無料）
- GitHub アカウント
- Chrome ブラウザ（拡張機能の動作確認用）

---

## ステップ 1: GitHub リポジトリ作成（5 分）

```bash
# GitHub 上で新規リポジトリを作成（mailtrack-pf, Public）

# ローカルで初期化
mkdir mailtrack-pf && cd mailtrack-pf
git init
git remote add origin git@github.com:dkamehat/mailtrack-pf.git
```

---

## ステップ 2: Turborepo モノレポ初期化（10 分）

```bash
# package.json 作成
cat > package.json <<'EOF'
{
  "name": "mailtrack-pf",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "db:generate": "drizzle-kit generate",
    "db:push": "wrangler d1 execute mailtrack-pf-db --file=packages/db/migrations/latest.sql"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "@types/node": "^20.0.0"
  }
}
EOF

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# turbo.json
cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
EOF

# .gitignore
cat > .gitignore <<'EOF'
node_modules
dist
.next
.turbo
.wrangler
.env
.env.local
*.log
.DS_Store
coverage
.vercel
EOF

# ディレクトリ構造
mkdir -p apps/{extension,api,dashboard}
mkdir -p packages/{db,shared,ui}
mkdir -p docs
mkdir -p .github/workflows

pnpm install
```

---

## ステップ 3: TypeScript 共通設定（5 分）

```bash
# ルート tsconfig
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
EOF
```

---

## ステップ 4: DB パッケージセットアップ（15 分）

```bash
cd packages/db

# package.json
cat > package.json <<'EOF'
{
  "name": "@mailtrack/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./schema.ts",
  "scripts": {
    "generate": "drizzle-kit generate",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "@paralleldrive/cuid2": "^2.2.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.25.0",
    "better-sqlite3": "^11.0.0",
    "typescript": "^5.5.0"
  }
}
EOF

# drizzle.config.ts
cat > drizzle.config.ts <<'EOF'
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
EOF

# tsconfig
cat > tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["**/*.ts"],
  "exclude": ["dist", "node_modules", "migrations"]
}
EOF

# schema.ts はすでに用意済み
# （/home/claude/mailtrack-pf/packages/db/schema.ts）

cd ../..
pnpm install
```

---

## ステップ 5: Cloudflare D1 データベース作成（10 分）

```bash
# Cloudflare CLI（wrangler）をインストール
pnpm add -D -w wrangler

# Cloudflare にログイン
pnpm wrangler login

# D1 データベース作成
pnpm wrangler d1 create mailtrack-pf-db
# 出力された database_id をメモする → 後で wrangler.toml に記述

# マイグレーション生成
cd packages/db
pnpm drizzle-kit generate

# マイグレーション適用（ローカル）
cd ../..
pnpm wrangler d1 execute mailtrack-pf-db --local --file=packages/db/migrations/0000_init.sql

# マイグレーション適用（リモート / 本番）
pnpm wrangler d1 execute mailtrack-pf-db --remote --file=packages/db/migrations/0000_init.sql

# 確認
pnpm wrangler d1 execute mailtrack-pf-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## ステップ 6: 環境変数の設定（5 分）

```bash
# .env.example
cat > .env.example <<'EOF'
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://mailtrack-pf-dashboard.pages.dev

# Notifications (optional)
SLACK_WEBHOOK_URL=

# Observability
SENTRY_DSN=
EOF

# .env を作成（gitignore 済み）
cp .env.example .env
# → 各値を埋める
```

---

## ステップ 7: GitHub Actions CI 設定（10 分）

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test
EOF
```

---

## ステップ 8: 初回コミット・プッシュ（5 分）

```bash
# ドキュメントをコピー
# /home/claude/mailtrack-pf/ 配下のファイルをすべて配置済みとする

git add .
git commit -m "feat: initial setup with PRD, ADRs, and DB schema

- Add PRD.md with requirements (FR/NFR/KPI)
- Add ADR-001 (stack selection rationale)
- Add ADR-002 (zero-cost operations design)
- Add Drizzle DB schema for D1
- Setup Turborepo monorepo structure
- Add CI workflow"

git push -u origin main
```

---

## ✅ Day 1 完了チェックリスト

- [ ] GitHub リポジトリ作成・初回プッシュ
- [ ] Turborepo モノレポ初期化
- [ ] `pnpm install` 成功
- [ ] `packages/db/schema.ts` 配置
- [ ] Cloudflare D1 データベース作成
- [ ] マイグレーション適用成功
- [ ] `pnpm wrangler d1 execute` でテーブル確認
- [ ] `docs/PRD.md` 配置
- [ ] `docs/ADR-001-stack-selection.md` 配置
- [ ] `docs/ADR-002-free-tier-operations.md` 配置
- [ ] `README.md` 配置
- [ ] GitHub Actions CI が green

---

## 次のステップ: Day 2

`apps/api/` で Cloudflare Workers + Hono の実装を開始する。
具体的には:

1. `apps/api/src/index.ts` で Hono アプリ初期化
2. `POST /api/emails` エンドポイント（トラッキング ID 払い出し）
3. `GET /pixel/:id.gif` エンドポイント（開封ログ + 透明 GIF 返却）
4. `GET /r/:id` エンドポイント（クリックログ + 302 リダイレクト）
5. Vitest でユニットテスト
6. `wrangler dev` でローカル動作確認
7. `wrangler deploy` で本番デプロイ
