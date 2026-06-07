# Show HN Draft

This is a draft only. Do not post until the maintainer explicitly approves public release.

## Title

Show HN: pixletter - open-source email tracking on Cloudflare's free tier

## Post Body

Hi HN,

I built pixletter, an open-source email tracking tool for people who want to self-host the tracking API, dashboard, and Gmail extension instead of routing the data through a third-party SaaS.

The stack is Cloudflare Workers, D1, Pages, Hono, React, and a Manifest V3 Chrome extension. It tracks opens and link clicks, includes a recipient opt-out page, stores no email body content, hashes IP addresses before storage, and documents the limits of pixel-based tracking up front.

The main design goal was a practical self-hosted setup that can run on Cloudflare's free tier for low-volume personal or small-team use. I also wrote the legal/ethics guardrails into the README and Terms because email tracking is easy to misuse.

Useful links:

- Repo: https://github.com/dkamehat/pixletter
- Self-hosting guide: https://github.com/dkamehat/pixletter/blob/main/docs/SELF-HOST-GUIDE.md
- API reference: https://github.com/dkamehat/pixletter/blob/main/docs/API-REFERENCE.md
- Privacy/abuse notes: https://github.com/dkamehat/pixletter#responsible-use--legal-considerations

Things I would like feedback on:

- Whether the self-hosting flow is understandable enough for a first-time Cloudflare Workers user.
- Whether the recipient privacy and prohibited-use language is clear and prominent enough.
- Whether the AGPL-hosting model feels appropriate for this kind of tool.

## Short Variant

I built pixletter, an open-source email tracking stack for Gmail that runs on Cloudflare Workers/D1/Pages and can be self-hosted on the free tier. It includes open/click tracking, a dashboard, recipient opt-out, IP hashing, no email body storage, and prominent responsible-use docs.

## Before Posting

- Confirm the latest release branch is merged and CI is green.
- Re-run the Tier3 audit and gitleaks on the exact commit that will be posted.
- Confirm screenshots are public-safe.
- Confirm no private company, project, colleague, internal-system, business email, or local-path references remain.
- Confirm maintainer approval for public posting.
