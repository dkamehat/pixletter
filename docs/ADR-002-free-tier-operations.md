# ADR-002: Free-Tier Operations (Zero-Cost Architecture)

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | ADR-001 (Stack Selection) |

---

## Context

The project mandates **$0/month operating cost** as a hard constraint. This ADR documents the specific service selection and operational design to meet that constraint.

ADR-001 adopted the Cloudflare ecosystem, but that alone doesn't guarantee free operation. **Design decisions are needed to stay within free tiers across all components.**

---

## Decision

Adopt the following zero-cost configuration.

### Per-Service Free-Tier Allocation

| Purpose | Service | Free Tier | Expected Usage | Headroom |
|---|---|---|---|---|
| API / pixel serving | Cloudflare Workers | 100K req/day | 100 req/day | 1000x |
| Database | Cloudflare D1 | 5GB · 5M reads/day · 100K writes/day | 100 reads/day · 50 writes/day | 50,000x |
| Dashboard | Cloudflare Pages | Unlimited bandwidth · 500 builds/month | 30 builds/month | 16x |
| Source control | GitHub Public Repo | Unlimited | 1 repository | ∞ |
| CI | GitHub Actions | Unlimited for public repos | 30 min/month | ∞ |
| Error monitoring | Sentry Developer | 5,000 errors/month | ~50 errors/month | 100x |
| Chrome extension | Developer mode self-install | $0 (not published) | — | — |
| Domain | `*.workers.dev` / `*.pages.dev` | $0 | — | — |
| User auth | Better Auth (self-hosted) | $0 | — | — |

**Total: $0/month, $0/year**

---

## Rationale

### 5 Key Decisions

#### Decision 2.1: No custom domain

- **Decision**: Operate on `*.workers.dev` / `*.pages.dev` subdomains
- **Reason**:
  - Pixel URL length has no impact on tracking accuracy
  - `workers.dev` is acceptable for portfolio purposes
  - Cloudflare Registrar offers domains from $8.57/year (can add later)
- **Tradeoff**: `workers.dev` URLs in email body may trigger some spam filters
- **Mitigation**: Revisit in Phase 2 if actual problems arise

#### Decision 2.2: No Chrome Web Store publication

- **Decision**: Self-install via Chrome Developer Mode (`Load unpacked`)
- **Reason**:
  - Chrome Web Store registration costs $5 (one-time), violates strict $0 constraint
  - Single user (self) — publication unnecessary
  - Publish built `.zip` as GitHub Release for others to try
- **Tradeoff**: No automatic extension updates via Chrome Web Store
- **Mitigation**: Manual reload via `chrome://extensions`

#### Decision 2.3: Cloudflare D1 over Supabase

- **Decision**: Use D1 (also covered in ADR-001, reinforced from cost perspective)
- **Reason**:
  - Supabase free plan **auto-pauses after 7 days of inactivity**
  - Sporadic personal use patterns risk unexpected DB downtime
  - D1 is always-on with no additional cost
- **Tradeoff**: D1's SQLite dialect has limited JSON operations
- **Mitigation**: Current schema uses simple relational structure, no JSON operations needed

#### Decision 2.4: Cloudflare Pages over Vercel

- **Decision**: Host dashboard on Cloudflare Pages
- **Reason**:
  - Vercel Hobby plan **prohibits commercial use**
  - Tracking business emails is arguably "commercial" — a grey area
  - Cloudflare Pages allows commercial use on free plan, unlimited bandwidth
- **Tradeoff**: Some bleeding-edge framework features may have delayed Cloudflare Pages support
- **Mitigation**: Use only needed features, stay within edge-compatible scope

#### Decision 2.5: Better Auth over basic auth

- **Decision**: Use Better Auth even for single-user operation
- **Reason**:
  - Preserves multi-tenant upgrade path for Phase 2
  - Better Auth is self-hosted and free
- **Tradeoff**: Increased Day 1 implementation scope
- **Mitigation**: Combined with dashboard implementation on Day 5

---

## Cost Forecast

### Projected Cost After 12 Months

| Scenario | Monthly Cost | 12-Month Total |
|---|---|---|
| Expected personal use | $0 | $0 |
| 10x usage (1,000 req/day) | $0 | $0 |
| 100x usage (10,000 req/day) | $0 | $0 |
| 1000x usage (100,000 req/day) | $0 (at free-tier limit) | $0 |
| Workers free tier exceeded | $5/month (Workers Paid) | $60 |

> Personal use physically cannot reach the billing threshold.

### Comparison: SaaS TCO

| Competitor | Monthly | Annual | 3-Year Total |
|---|---|---|---|
| MailSuite Pro | $4.99 | $59.88 | $179.64 |
| Mixmax Starter | $24 | $288 | $864 |
| HubSpot Sales Starter | $20 | $240 | $720 |
| **mailtrack-pf (self-built)** | **$0** | **$0** | **$0** |

> 3-year savings: **$180** vs MailSuite, **$864** vs Mixmax.

---

## Consequences

### Positive

- ✅ $0 TCO is reliably achievable
- ✅ Universally applicable design for startups and budget-constrained teams
- ✅ Single-vendor (Cloudflare) keeps operations simple

### Negative

- ⚠️ Full outage if Cloudflare goes down (single point of failure)
  - Mitigation: Personal use has relaxed uptime requirements; wait for recovery
- ⚠️ Cloudflare free plan change risk (future pricing/quota changes)
  - Mitigation: Abstraction layers (Hono, Drizzle) maintain portability to other clouds
- ⚠️ Explosive growth (multi-tenant) would require redesign
  - Mitigation: Address in Phase 2; not a concern at current scale

---

## References

- ADR-001: Stack Selection
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
