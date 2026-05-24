# ADR-001: Full-Stack Technology Selection

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Supersedes | — |

---

## Context

`pixletter` is a personally operated email tracking platform. Key constraints for technology selection:

1. **$0 operating cost** (NFR-COST-01)
2. **MVP completion in a 1-week sprint** (PRD §9.1)
3. **4 components to integrate**: Gmail Chrome extension, API, DB, and dashboard
4. **Edge latency requirement**: Pixel response P95 ≤ 50ms (NFR-PERF-01)

Candidate configurations:

| Option | Overview |
|---|---|
| A | Cloudflare all-in (Workers + D1 + Pages) |
| B | Vercel + Supabase (typical Next.js stack) |
| C | AWS Lambda + DynamoDB + Amplify |
| D | Self-hosted VPS + PostgreSQL + Docker |

---

## Decision

**Option A: Cloudflare ecosystem all-in** is adopted.

### Adopted Stack

| Layer | Technology | Version |
|---|---|---|
| Extension | Chrome Extension Manifest V3 | latest |
| API | Cloudflare Workers + Hono | Hono v4 |
| DB | Cloudflare D1 (SQLite) | — |
| ORM | Drizzle ORM | latest |
| Dashboard | React + Vite | latest |
| Hosting | Cloudflare Pages | — |
| Auth | Better Auth | latest |
| Validation | Zod | v3 |
| Monorepo | Turborepo + pnpm | latest |
| Testing | Vitest + @cloudflare/vitest-pool-workers | latest |
| Observability | Workers Analytics | — |
| Language | TypeScript (strict mode) | 5.x |

---

## Rationale

### 4 Reasons to Choose the Cloudflare Ecosystem

#### 1. Free-tier operation is practically guaranteed

| Service | Free Tier | Estimated Usage (personal) |
|---|---|---|
| Workers | 100K req/day | ~0.1% |
| D1 | 5GB · 5M reads/day | ~0.01% |
| Pages | Unlimited bandwidth · 500 builds/month | ~5% |

> 1000x+ headroom. Even traffic spikes stay within the free tier.

#### 2. Edge integration optimizes latency

Workers and D1 execute at the same edge location. Pixel request → DB INSERT → 1×1 GIF response completes **without a network round-trip**, making P95 < 30ms realistic.

With Vercel + Supabase:
- Vercel Function (US East) → Supabase (US East): RTT 5–20ms
- Requests from Asia: 200ms+ with cold start

#### 3. Avoids Vercel Hobby commercial use restriction

[Vercel's Terms of Service](https://vercel.com/legal/terms) prohibit commercial use on the Hobby plan. Tracking business emails could be interpreted as "commercial." Cloudflare Pages allows commercial use even on the free plan.

#### 4. Avoids Supabase 7-day pause risk

Supabase's free plan auto-pauses projects after 7 days of inactivity. For personal use with sporadic sending patterns, the DB could stop unexpectedly. D1 is always-on.

---

## Considered Alternatives

### Option B: Vercel + Supabase

**Pros**:
- Well-known stack, abundant documentation
- Supabase has strong auth/storage features
- Realtime features built-in

**Cons**:
- Vercel Hobby commercial use restriction
- Supabase 7-day pause risk
- Pixel response latency inferior to Cloudflare (no Asia region)
- Two providers to manage, complex deploy pipeline

**Verdict**: Cons directly conflict with free-tier operation requirement — rejected.

### Option C: AWS Lambda + DynamoDB + Amplify

**Pros**:
- Maximum scalability
- Fine-grained IAM controls

**Cons**:
- Limited free tier, long-term billing risk
- Configuration complexity (IAM, API Gateway, Lambda, DynamoDB, Amplify)
- MVP unlikely within 1-week sprint
- Lambda cold start: 200ms+ pixel response risk

**Verdict**: Inferior on cost and development speed — rejected.

### Option D: Self-hosted VPS + PostgreSQL + Docker

**Pros**:
- Complete data sovereignty
- High learning value

**Cons**:
- Electricity/bandwidth costs as de facto running costs
- Availability depends on VPS/home environment
- No global distribution for pixel response

**Verdict**: Cannot meet $0 requirement, availability also inferior — rejected.

---

## Consequences

### Positive

- ✅ $0/month operation is reliably achievable
- ✅ Pixel response P95 < 50ms is realistic
- ✅ Deploy pipeline completes within a single Cloudflare vendor
- ✅ End-to-end type safety with TypeScript
- ✅ Hono on Workers has good compatibility with LLM API wrappers (Phase 2 extensibility)

### Negative

- ⚠️ Cloudflare vendor lock-in (D1 SQL dialect, Workers runtime-specific APIs)
  - Mitigation: Abstraction via ORM layer (Drizzle) and Hono keeps logic portable
- ⚠️ D1 is SQLite-based; complex JSON queries and heavy concurrent writes are limited
  - Mitigation: Current schema has no issues. Can migrate to Cloudflare D2 (PostgreSQL-compatible) if needed
- ⚠️ Full outage if Cloudflare goes down (single point of failure)
  - Mitigation: Cloudflare SLA 99.99%, sufficient for personal operation

### Neutral

- 🟡 Likely to be asked "Why Cloudflare?" in interviews
  - → This ADR serves as a documented answer — turns it into a **strength**

---

## References

- [Cloudflare Workers Pricing](https://www.cloudflare.com/plans/developer-platform/)
- [Vercel Terms of Service](https://vercel.com/legal/terms)
- [Supabase Free Plan Pause Policy](https://supabase.com/docs/guides/platform/pause-and-restore)
- [Hono Framework](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

## Review Log

| Date | Reviewer | Comment | Action |
|---|---|---|---|
| 2026-05-14 | kame_lift | Initial draft | Approved |
