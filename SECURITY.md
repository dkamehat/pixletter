# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in mailtrack-pf, please report it responsibly:

1. **Do NOT open a public GitHub Issue**
2. Use [GitHub Security Advisories](https://github.com/dkamehat/mailtrack-pf/security/advisories/new) to report privately
3. Or DM: [@kame__lift on X](https://x.com/kame__lift)

We will acknowledge receipt within 48 hours and provide a fix timeline within 7 days.

## Production Runtime Security

mailtrack-pf runs on **Cloudflare Workers**, which provides:
- Isolated V8 runtime (no Node.js, no filesystem access)
- Automatic HTTPS enforcement
- DDoS protection at the edge
- No server to patch or maintain

## Dev-Dependency Vulnerability Assessment

`pnpm audit` reports vulnerabilities in development dependencies. These **do not affect the production runtime**:

| Package | Severity | Affected Context | Production Impact |
|---------|----------|-------------------|-------------------|
| wrangler 3.x (via vitest-pool-workers) | High | CLI/build tool only | **None** — not bundled into Worker |
| undici (via wrangler/miniflare) | High | Local dev server only | **None** — Workers use Cloudflare's HTTP stack |
| esbuild | Moderate | Build tool dev server | **None** — dev server not exposed in production |
| vite (via better-auth/vitest) | Moderate | Build tool dev server | **None** — dev server not exposed in production |

### Why these don't matter in production

Cloudflare Workers bundles your application code into a single JavaScript file that runs in V8 isolates. Dev dependencies (wrangler, vitest, esbuild, vite) are **never included** in the deployed bundle. The production runtime has no access to Node.js APIs, filesystem, or child processes.

### Mitigation plan

- **wrangler 3.x → 4.x migration** is planned (tracked in Phase 3 roadmap)
- Transitive dependencies (undici, esbuild) will be resolved by this migration

## Application Security Measures

| Measure | Implementation |
|---------|---------------|
| IP pseudonymization | SHA-256 hash — raw IPs never stored ([source](apps/api/src/lib/hash.ts)) |
| Rate limiting | 100 req/min per IP ([source](apps/api/src/middleware/rateLimit.ts)) |
| API authentication | Bearer token + Better Auth sessions ([source](apps/api/src/middleware/tenant.ts)) |
| CORS | Origin whitelist via `ALLOWED_ORIGINS` env var |
| Opt-out | One-click recipient opt-out at `/optout/:emailId` ([source](apps/api/src/routes/optout.ts)) |
| Auto-ban | Accounts with >10 opt-outs are automatically suspended ([source](apps/api/src/lib/abuse.ts)) |
| GDPR deletion | `DELETE /api/account/data` cascading delete ([source](apps/api/src/routes/gdpr.ts)) |
| Secrets management | Cloudflare Workers Secrets (encrypted at rest) |
