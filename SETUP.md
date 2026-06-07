# SETUP.md — Day 1 Initial Setup Guide

Step-by-step checklist to set up the `pixletter` development environment from scratch.
**Estimated time: 60–90 minutes**

---

## Prerequisites

- Node.js v20+
- pnpm v9+ (`npm install -g pnpm`)
- Git
- Cloudflare account (free)
- GitHub account
- Chrome browser (for extension testing)

---

## Step 1: GitHub Repository (5 min)

```bash
# Create a new repo on GitHub (pixletter, Public)

# Initialize locally
mkdir pixletter && cd pixletter
git init
git remote add origin support@example.com:<your-username>/pixletter.git
```

---

## Step 2: Turborepo Monorepo Init (10 min)

```bash
# package.json
cat > package.json <<'EOF'
{
  "name": "pixletter",
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
    "db:push": "wrangler d1 execute pixletter-db --file=packages/db/migrations/latest.sql"
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

# Directory structure
mkdir -p apps/{extension,api,dashboard}
mkdir -p packages/{db,shared,ui}
mkdir -p docs
mkdir -p .github/workflows

pnpm install
```

---

## Step 3: Shared TypeScript Config (5 min)

```bash
# Root tsconfig
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

## Step 4: DB Package Setup (15 min)

```bash
cd packages/db

# package.json
cat > package.json <<'EOF'
{
  "name": "@pixletter/db",
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

cd ../..
pnpm install
```

---

## Step 5: Cloudflare D1 Database (10 min)

```bash
# Install wrangler
pnpm add -D -w wrangler

# Login to Cloudflare
pnpm wrangler login

# Create D1 database
pnpm wrangler d1 create pixletter-db
# Note the database_id from output → add to wrangler.toml

# Generate migrations
cd packages/db
pnpm drizzle-kit generate

# Apply migrations (local)
cd ../..
pnpm wrangler d1 execute pixletter-db --local --file=packages/db/migrations/0000_init.sql

# Apply migrations (remote / production)
pnpm wrangler d1 execute pixletter-db --remote --file=packages/db/migrations/0000_init.sql

# Verify
pnpm wrangler d1 execute pixletter-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Step 6: Environment Variables (5 min)

```bash
# .env.example
cat > .env.example <<'EOF'
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_TOKEN=

# Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://pixletter-dashboard.pages.dev

# Notifications (optional)
SLACK_WEBHOOK_URL=

# Observability
SENTRY_DSN=
EOF

# Create .env (already in .gitignore)
cp .env.example .env
# → Fill in your values
```

---

## Step 7: GitHub Actions CI (10 min)

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

## Step 8: Initial Commit & Push (5 min)

```bash
git add .
git commit -m "feat: initial setup with ADRs and DB schema"
git push -u origin main
```

---

## Day 1 Completion Checklist

- [ ] GitHub repository created and pushed
- [ ] Turborepo monorepo initialized
- [ ] `pnpm install` succeeds
- [ ] `packages/db/schema.ts` in place
- [ ] Cloudflare D1 database created
- [ ] Migrations applied successfully
- [ ] `pnpm wrangler d1 execute` confirms tables
- [ ] `docs/ADR-001-stack-selection.md` in place
- [ ] `docs/ADR-002-free-tier-operations.md` in place
- [ ] `README.md` in place
- [ ] GitHub Actions CI is green

---

## Next: Day 2

Start implementing Cloudflare Workers + Hono in `apps/api/`:

1. Initialize Hono app in `apps/api/src/index.ts`
2. `POST /api/emails` endpoint (tracking ID issuance)
3. `GET /pixel/:id.gif` endpoint (open logging + transparent GIF)
4. `GET /r/:id` endpoint (click logging + 302 redirect)
5. Unit tests with Vitest
6. Local verification with `wrangler dev`
7. Production deploy with `wrangler deploy`
