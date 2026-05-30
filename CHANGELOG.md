# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning (https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-30

First public release. Open-source, self-hosted email open & click tracking for Gmail,
running entirely on Cloudflare (Workers + D1 + Pages). $0/month. AGPLv3.

### Added

**Tracking API (Cloudflare Workers + Hono)**
- Email registration (POST /api/emails) returning tracking ID, pixel URL, tracked links, and opt-out URL
- Open tracking via 1x1 GIF pixel handler (GET /pixel/:id.gif)
- Click tracking via link redirector (GET /r/:id)
- Email list and detail endpoints with open/click counts and open timeline
- Account usage endpoint and GDPR data export/deletion endpoints

**Chrome extension (Manifest V3, Gmail)**
- Track on/off toggle in the Compose window
- Automatic tracking-pixel injection and link rewriting on send
- Sent-folder status icons: single check (sent) / double check (opened)
- Settings popup for API URL, API key, and optional Slack webhook

**Dashboard (React 19 + Vite, Cloudflare Pages)**
- Chronological send history
- Per-email open timeline with User-Agent and Gmail-image-proxy detection
- Aggregate open rate / click rate
- Search and filter by recipient, subject, or tag

**Multi-tenant & auth**
- Better Auth (email/password + Google OAuth)
- API-key auth for the extension (SHA-256 hashed storage)
- HOSTING_MODE toggle: self (OSS) / hosted
cd ~

# A) CHANGELOG.md をローカル生成（中身入り）
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning (https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-30

First public release. Open-source, self-hosted email open & click tracking for Gmail,
running entirely on Cloudflare (Workers + D1 + Pages). $0/month. AGPLv3.

### Added

**Tracking API (Cloudflare Workers + Hono)**
- Email registration (POST /api/emails) returning tracking ID, pixel URL, tracked links, and opt-out URL
- Open tracking via 1x1 GIF pixel handler (GET /pixel/:id.gif)
- Click tracking via link redirector (GET /r/:id)
- Email list and detail endpoints with open/click counts and open timeline
- Account usage endpoint and GDPR data export/deletion endpoints

**Chrome extension (Manifest V3, Gmail)**
- Track on/off toggle in the Compose window
- Automatic tracking-pixel injection and link rewriting on send
- Sent-folder status icons: single check (sent) / double check (opened)
- Settings popup for API URL, API key, and optional Slack webhook

**Dashboard (React 19 + Vite, Cloudflare Pages)**
- Chronological send history
- Per-email open timeline with User-Agent and Gmail-image-proxy detection
- Aggregate open rate / click rate
- Search and filter by recipient, subject, or tag

**Multi-tenant & auth**
- Better Auth (email/password + Google OAuth)
- API-key auth for the extension (SHA-256 hashed storage)
- HOSTING_MODE toggle: self (OSS) / hosted
- Monthly send limits (free: 500/month; new accounts: 10 per 24h)

**Privacy & compliance (enforced in code)**
- One-click opt-out URL + footer injected into every tracked email (forced in hosted mode)
- Public opt-out page (no auth required)
- IP addresses pseudonymized via SHA-256 - raw IPs never stored
- Email body content never stored (subject + metadata only)
- GDPR data export and deletion (Article 17)
- Auto-suspend accounts after 10+ opt-outs
- Documented prohibited-use policy (no partner surveillance, non-consensual monitoring, etc.)

**Observability & security**
- X-Request-ID / X-Response-Time response headers
- Rate limiting (100 req/min per IP)
- CORS origin restriction via ALLOWED_ORIGINS
- Slack open notifications (throttled to 1/hour per email)
- Cloudflare Workers Analytics

**Operations & docs**
- One-click "Deploy to Cloudflare" button
- Self-host guide, API reference, and architecture/decision records (ADR-001..004)
- 29 tests (Vitest + @cloudflare/vitest-pool-workers), TypeScript strict mode, GitHub Actions CI

### Security
- Known dev-dependency advisories (wrangler 3.x, undici, esbuild) do not affect the
  production Workers runtime. See SECURITY.md for analysis.

[0.3.0]: https://github.com/dkamehat/pixletter/releases/tag/v0.3.0
