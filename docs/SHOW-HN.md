# Show HN: Mailtrack-pf – Open-source email tracking on Cloudflare ($0/month)

Hi HN,

I built an open-source email tracking tool that runs entirely on Cloudflare's free tier — Workers, D1, and Pages. Total cost: $0/month.

**Why:** As a PM handling cross-functional communications, I was spending 2-3 hours/week chasing people to confirm they read my emails. Existing tools (Mailtrack, MailSuite) cost $5-10/month and send your data to third parties.

**What it does:**
- Chrome extension adds a tracking toggle to Gmail compose
- 1x1 pixel for open tracking, redirect URLs for click tracking
- Real-time dashboard with open rates and timelines
- Slack notifications on opens
- IPs are SHA-256 hashed, recipients can one-click opt-out

**Tech stack:**
- API: Cloudflare Workers + Hono
- DB: Cloudflare D1 (SQLite) + Drizzle ORM
- Dashboard: React + Vite on CF Pages
- Extension: Chrome MV3
- Auth: Better Auth (multi-tenant, email/password + Google OAuth)
- Monorepo: Turborepo + pnpm

Self-host in 5 minutes:
```
npx create-mailtrack@latest
```

Or fork and one-click deploy via GitHub Actions.

Free tier headroom is ~1000x (100K req/day limit vs ~100 actual). 29 tests, TypeScript strict, AGPLv3.

**Repo:** https://github.com/dkamehat/mailtrack-pf
**Live API:** https://mailtrack-pf-api.kame-lift.workers.dev/health

I'd love feedback on the architecture decisions (documented in ADRs) and any privacy/ethics concerns I should address.
