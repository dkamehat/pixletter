# ADR-004: OSS Licensing and Hosting Model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-05-14 |
| Deciders | kame_lift |
| Related | PRD-Phase2.md, ADR-003 |

---

## Context

License selection for Phase 2 OSS release is a strategic decision that directly impacts sharing, monetization potential, and control.

### Key Questions

1. Which license? (MIT / Apache 2.0 / AGPLv3 / BSL / Elastic License)
2. How to design the feature gap between OSS and official hosted versions?
3. How to preserve future commercialization options (Phase 3)?
4. How to handle the risk of "someone forks and launches a paid SaaS"?

---

## Decision

### License: **AGPLv3 (GNU Affero General Public License v3.0)**

### Model: **Open Core + Permissive Trust**

```
mailtrack-pf (core)
├── AGPLv3 licensed (all core features)
├── OSS: anyone can fork and self-host
└── Official hosted: operated by maintainer, references AGPLv3 source
```

### Enterprise Features for Phase 3 (reference only)

If enterprise features are added in the future, they may be implemented in a **separate repository under BSL (Business Source License)**. Phase 2 focuses on core features only.

---

## Rationale

### Why AGPLv3

#### 1. Prevents hosting resale

AGPLv3 **§13 (Remote Network Interaction)** requires that anyone who modifies the source and provides it as a **network service** must publish their modified source code.

> If a major cloud provider forks mailtrack-pf to create a paid SaaS, they must publish their modifications. This effectively **deters hosting resale**.

#### 2. Proven track record

| Product | License | Outcome |
|---|---|---|
| Plausible Analytics | AGPLv3 | ARR $1M+ |
| Cal.com | AGPLv3 | ARR $5M+ |
| Mastodon | AGPLv3 | Millions of MAU |
| Grafana | AGPLv3 (Loki, Tempo) | Coexists with commercial hosting |

**Plausible in particular has a similar structure** (OSS + official hosting, data sovereignty focus).

#### 3. Consistency with data sovereignty message

User-facing message:
> "Our source is fully open under AGPLv3. You can use the official hosted version or run it yourself. **Transparency is legally guaranteed.**"

This aligns with the PRD-Phase2 trust-building strategy.

#### 4. AGPLv3 concerns and mitigations

| Concern | Mitigation |
|---|---|
| "Enterprises avoid copyleft" | Using the official SaaS doesn't impose copyleft obligations on users |
| "Can't use as an embedded library" | mailtrack-pf is not designed for embedding — not applicable |
| "Hard to switch to BSL later" | Prepare CLA (Contributor License Agreement) for Phase 3 |

---

## Considered Alternatives

### MIT License

**Pros**:
- Maximum freedom, easiest to attract contributors
- Highest adoption rate (majority of GitHub OSS)

**Cons**:
- Major clouds can fork and create a paid SaaS (Redis / ElasticSearch lessons)
- Risk of "working for free"

**Verdict**: Rejected — hosting resale deterrence is required.

### Apache 2.0

**Pros**:
- Patent clause, enterprise-friendly
- Commercial reuse allowed with patent protection

**Cons**:
- Cannot deter hosting resale (same as MIT)

**Verdict**: Rejected for the same reason.

### BSL (Business Source License — MariaDB / Sentry / Cockroach)

**Pros**:
- Time-limited commercial use restrictions
- Automatic conversion to GPL / Apache after N years

**Cons**:
- **Not recognized as OSS** (not OSI-approved)
- Often called "Source Available"
- Disadvantage for community/contributor acquisition

**Verdict**: Conflicts with Phase 2's "earn trust through OSS" strategy. **Suitable for Phase 3 enterprise features** — will be considered as a separate repository at that time.

### Elastic License v2

**Pros**:
- Explicitly prohibits hosting resale
- No source disclosure requirement for modifications

**Cons**:
- Not OSI-approved, not considered OSS
- Elasticsearch's license change drew significant community backlash

**Verdict**: Rejected. AGPLv3 has better community acceptance.

### Dual License (AGPLv3 + Commercial)

**Pros**:
- Can sell commercial licenses to enterprises that avoid AGPLv3
- Future monetization option

**Cons**:
- Requires CLA, complex contributor management
- High operational overhead at Phase 2 stage

**Verdict**: **Defer to Phase 3.** Start with AGPLv3 alone, but introduce CLA in Phase 2.

---

## Open Core Model Design

### Tier 1: OSS (AGPLv3)

**Included features (core)**:
- Chrome extension (Manifest V3)
- API (Workers + Hono)
- DB schema (D1 + Drizzle)
- Dashboard (React)
- Multi-tenant system (`HOSTING_MODE` toggle)
- All compliance features (opt-out, etc.)

**Not included (optional, separate repo)**:
- Advanced features for Phase 3 (A/B testing, AI integration, CRM connectors, etc.)

### Tier 2: Official Hosted Version

**Additional benefits**:
- Operated by maintainer (users just sign up)
- No Cloudflare account required
- Automatic updates
- Best-effort support (GitHub Discussions)

**Pricing**: Free (Phase 2). Pro features with paid plans under consideration for Phase 3.

### Tier 3: Enterprise Features — Phase 3 (reference only)

Future discussion points:
- SSO / SAML authentication
- Audit logs
- Custom domains
- SLA guarantees
- Dedicated support

These may be implemented in a **separate repository + BSL license**. Not in scope for Phase 2.

---

## CLA (Contributor License Agreement) Preparation

To enable future license changes (AGPL → commercial), introduce CLA at Phase 2 start:

```
By contributing, you grant the project maintainer (kame_lift) the right to relicense
your contributions under any license (including commercial licenses).
```

**Implementation**:
- Use GitHub Actions `cla-assistant` (free)
- Automatically request CLA consent on first PR
- Individual CLA for personal contributors
- Corporate CLA for company contributors

Reference: Cal.com, Plausible use the same approach.

---

## Consequences

### Positive

- ✅ Legally deters hosting resale
- ✅ Builds trust in OSS community
- ✅ Preserves Phase 3 commercialization via CLA
- ✅ Demonstrates strategic licensing decision-making

### Negative

- ⚠️ Some enterprise users avoid AGPLv3
  - Mitigation: Using the official hosted version imposes no copyleft obligation on users
- ⚠️ License explanation required (FAQ needed)
  - Mitigation: Clear FAQ section in README
- ⚠️ CLA raises the bar for first-time contributors
  - Mitigation: Automate with cla-assistant, explain the rationale in docs

### Neutral

- 🟡 License choice itself becomes a PR talking point
  - "AGPLv3 open-source MailSuite alternative" in Show HN title

---

## Branding and Trademark

| Item | Policy |
|---|---|
| Product name | `mailtrack-pf` (working title) — revisit at Phase 2 start |
| Logo | In-house (Phase 2 Week 4) |
| Domain | Acquire `mailtrack-pf.dev` ($9/year) |
| Trademark registration | Consider after MAU growth in Phase 3 |
| Forked brands | AGPLv3 requires name change (forkers must use a different name) |

---

## References

- AGPLv3 Full Text: https://www.gnu.org/licenses/agpl-3.0.html
- Plausible Licensing: https://github.com/plausible/analytics/blob/master/LICENSE.md
- Cal.com CLA: https://github.com/calcom/cal.com/blob/main/cla.md
- Open Core Summit 2025 keynote summary
- "Why we changed our license from Elastic to AGPL" - Cal.com blog
