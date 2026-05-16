# Self-Host Guide

Deploy mailtrack-pf on your own Cloudflare account in under 10 minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)

## Quick Start

### Option A: CLI Wizard

```bash
npx create-mailtrack@latest
```

The wizard will guide you through: clone, install, D1 setup, migrations, and seed.

### Option B: Manual Setup

```bash
# 1. Clone & install
git clone https://github.com/dkamehat/mailtrack-pf.git
cd mailtrack-pf
pnpm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Create D1 database
npx wrangler d1 create mailtrack-pf-db --config=apps/api/wrangler.toml
# Copy the database_id from the output and update apps/api/wrangler.toml

# 4. Apply migrations
npx wrangler d1 execute mailtrack-pf-db --remote \
  --file=packages/db/migrations/0000_peaceful_apocalypse.sql \
  --config=apps/api/wrangler.toml

npx wrangler d1 execute mailtrack-pf-db --remote \
  --file=packages/db/migrations/0001_better_auth_tables.sql \
  --config=apps/api/wrangler.toml

# 5. Seed self tenant
npx wrangler d1 execute mailtrack-pf-db --remote \
  --command="INSERT OR IGNORE INTO tenants (id, name, plan, monthly_email_limit) VALUES ('self', 'Self', 'self', 100000);" \
  --config=apps/api/wrangler.toml

# 6. Deploy API
npx wrangler deploy --config=apps/api/wrangler.toml

# 7. Deploy Dashboard (optional)
pnpm --filter @mailtrack/dashboard build
npx wrangler pages deploy apps/dashboard/dist --project-name=mailtrack-pf-dashboard
```

### Option C: GitHub Actions

1. Fork the repo
2. Add repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
3. Go to Actions → "Deploy to Cloudflare" → Run workflow

## Configuration

### Environment Variables (wrangler.toml)

| Variable | Required | Description |
|----------|----------|-------------|
| `HOSTING_MODE` | No | `self` (default) or `hosted` |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for open notifications |
| `PIXEL_DOMAIN` | No | Custom domain for pixel URLs |

### Hosted Mode (multi-tenant)

To enable multi-tenant mode with authentication:

```bash
# Set secrets
npx wrangler secret put BETTER_AUTH_SECRET --config=apps/api/wrangler.toml
npx wrangler secret put BETTER_AUTH_URL --config=apps/api/wrangler.toml

# Optional: Google OAuth
npx wrangler secret put GOOGLE_CLIENT_ID --config=apps/api/wrangler.toml
npx wrangler secret put GOOGLE_CLIENT_SECRET --config=apps/api/wrangler.toml

# Update wrangler.toml
# HOSTING_MODE = "hosted"
# ALLOWED_ORIGINS = "https://your-dashboard.pages.dev"
```

## Chrome Extension Setup

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `apps/extension/`
4. Click the extension icon → enter your API URL and API key
5. Compose an email in Gmail — the Track toggle appears automatically

## Verify Installation

```bash
# Check API health
curl https://your-worker.workers.dev/health

# Expected response:
# {"status":"ok","version":"0.3.0","mode":"self"}
```

## Updating

```bash
git pull origin main
pnpm install
# Apply any new migrations
npx wrangler d1 execute mailtrack-pf-db --remote \
  --file=packages/db/migrations/<new-migration>.sql \
  --config=apps/api/wrangler.toml
npx wrangler deploy --config=apps/api/wrangler.toml
```
