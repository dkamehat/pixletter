# ADR-003: Multi-Tenant Architecture

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | PRD-Phase2.md, ADR-001, ADR-002 |

---

## Context

Phase 2 introduces an **Open Core model** (OSS + official hosted version). The hosted version accepts multiple users, requiring the Phase 1 single-tenant design to be **multi-tenanted**.

### Key Technical Questions

1. Data isolation approach? (Shared DB + tenant_id / DB per tenant / Schema per tenant)
2. How to strengthen authentication?
3. Rate limiting and abuse prevention strategy?
4. Can OSS and hosted versions share a single codebase?
5. What is feasible under Cloudflare D1 constraints?

---

## Decision

### Adopted Approach: Shared DB + `tenant_id` Column (Pool Model)

Add `tenant_id` to all tables and enforce filtering on every query.

### 1. Data Isolation Approach

| Approach | Adopted? | Reason |
|---|---|---|
| **Pool (shared DB + tenant_id)** | ✅ Yes | Best fit for D1, low cost, simple ops |
| Silo (separate DB per tenant) | ❌ | 1000 DBs unmanageable in D1, exceeds free tier |
| Schema-per-tenant | ❌ | SQLite/D1 doesn't support multi-schema |
| Bridge (hybrid) | ❌ | Excessive complexity |

### 2. Data Isolation Enforcement

| Layer | Measure |
|---|---|
| Application | Drizzle ORM query builder wrapper auto-applies `tenant_id` |
| Middleware | Hono middleware extracts tenant_id from auth, injects into context |
| Queries | All SELECT/UPDATE/DELETE require `WHERE tenant_id = ?` |
| Audit | Tests enforce "error on tenant_id mismatch" |

### 3. Auth Strengthening

| Feature | Implementation |
|---|---|
| Sign up | Google OAuth + email/password (Better Auth) |
| API keys | Issued per tenant, sent from Chrome extension |
| Session mgmt | Cookie-based, HttpOnly + Secure + SameSite=Lax |
| Logout | Server-side session invalidation |

### 4. Rate Limiting & Abuse Prevention

| Measure | Implementation |
|---|---|
| Per-user send limit | 500/month (free), counter in D1 |
| IP-based rate limiting | Cloudflare Rate Limiting Rules (free tier) |
| New account restriction | 10-send limit for first 24h after sign up |
| Abuse reporting | Footer link for abuse reports |
| Auto-ban | 10+ opt-outs from recipients → automatic account suspension |

### 5. OSS/Hosted Codebase Unity

**Single codebase, environment variable toggle**:

```typescript
// apps/api/src/auth/index.ts
const isHosted = process.env.HOSTING_MODE === 'hosted';

if (isHosted) {
  // Hosted: multi-tenant, rate limits, abuse prevention
  app.use(multitenant());
  app.use(rateLimit({ free: 500 }));
} else {
  // OSS: single tenant, no limits
  app.use(singleTenant({ defaultUserId: 'self' }));
}
```

This means:
- OSS users deploy on their own Cloudflare with no extra features needed
- Hosted version uses the same codebase with `HOSTING_MODE=hosted`

---

## Rationale

### Why the Pool Model

#### 1. Cloudflare D1 Constraints

D1 practical limits:
- Limited number of DBs per account
- Per-DB connection overhead
- Silo model at 1,000 users = 1,000 DBs — breaks down

Pool model supports **1M+ users in a single DB** (theoretical).

#### 2. Cost Efficiency

- Silo: Minimum per-DB storage exceeds free tier
- Pool: Storage scales linearly; 5GB free tier supports 10K+ users

#### 3. Operational Simplicity

- Migrations: Apply once for all tenants
- Backups: Single DB to back up
- Monitoring: Single set of metrics

#### 4. Data Isolation Risk Control

Pool model's primary risk = **data leakage between tenants**.

Mitigation:
- **Drizzle wrapper abstracts query builder**:

```typescript
// packages/db/queries/scoped.ts
export function scopedQuery(db: D1Database, tenantId: string) {
  return {
    emails: {
      findMany: () => db.select().from(emails).where(eq(emails.tenantId, tenantId)),
      findById: (id: string) => db.select().from(emails)
        .where(and(eq(emails.id, id), eq(emails.tenantId, tenantId))),
      // ...
    },
  };
}
```

- API handlers never write raw SQL — always go through this wrapper

### Why Better Auth for Authentication

| Candidate | Adopted? | Reason |
|---|---|---|
| Better Auth | ✅ | Self-hostable, Cloudflare Workers compatible, OAuth built-in |
| Clerk | ❌ | Monthly billing conflicts with $0 cost requirement |
| Supabase Auth | ❌ | Not using Supabase (ADR-001) |
| Custom implementation | ❌ | Security implementation best left to specialists |

---

## Consequences

### Positive

- ✅ D1 free tier supports 10K+ users
- ✅ Shared codebase between OSS and hosted versions
- ✅ Low operational overhead (1 DB, 1 auth system)
- ✅ Scoped query wrapper technically controls data leakage risk

### Negative

- ⚠️ Pool model cannot create "privileged tenants" (all share one DB)
  - Mitigation: Design Silo model migration for Phase 3 if large customers emerge
- ⚠️ Missing `tenant_id` in a query is a critical bug (data leakage)
  - Mitigation: scopedQuery wrapper mandatory, CI lint rule to detect raw SQL
- ⚠️ Better Auth is a newer library with limited production track record
  - Mitigation: Track GitHub security issues, consider fork if needed

### Neutral

- 🟡 OSS users have a redundant `tenant_id` column (always the same value)
  - No real impact; storage overhead is negligible

---

## DB Schema Diff (Phase 1 → Phase 2)

```typescript
// Added to packages/db/schema.ts

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name'),
  plan: text('plan', { enum: ['free', 'pro'] }).default('free').notNull(),
  monthlyEmailLimit: integer('monthly_email_limit').default(500).notNull(),
  monthlyEmailCount: integer('monthly_email_count').default(0).notNull(),
  resetAt: integer('reset_at', { mode: 'timestamp' }).notNull(),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
});

// Columns added to existing tables:
// users: tenantId, oauthProvider, oauthId
// emails: tenantId
// opens, links, clicks, optouts: tenantId (enforced tenant isolation)

// API key management
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  keyHash: text('key_hash').notNull(), // stored as hash
  name: text('name'),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
});
```

---

## Migration Strategy (Phase 1 → Phase 2)

Carry over data from personal Phase 1 operation to Phase 2:

```sql
-- 1. Create tenants table
-- 2. INSERT own tenant
-- 3. Add tenant_id column to users/emails/opens/links/clicks/optouts
-- 4. UPDATE existing data with own tenant_id
-- 5. Apply NOT NULL constraint on tenant_id
```

Implemented in `packages/db/migrations/0002_multitenant.sql`.

---

## References

- AWS SaaS Architecture Patterns (Pool / Silo / Bridge): https://aws.amazon.com/builders-library/multi-tenant-saas-architecture/
- Better Auth Docs: https://better-auth.com/
- Cloudflare D1 Limits: https://developers.cloudflare.com/d1/platform/limits/
- Plausible Multi-tenancy: https://github.com/plausible/analytics
