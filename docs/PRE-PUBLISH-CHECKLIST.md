# Pre-Publish Checklist

Use this checklist before making any public announcement or Show HN post. Public posting requires explicit maintainer approval.

## Required Checks

- [ ] Working tree is clean on the public-release branch.
- [ ] `pnpm audit --audit-level high` has no high or critical findings.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm type-check` passes.
- [ ] `python scripts/audit.py --all` passes with `.audit-patterns.txt` configured.
- [ ] `python scripts/self_reference_test.py` passes.
- [ ] `gitleaks detect` passes.
- [ ] GitHub Actions are green on the release PR or release branch.

## Tier3 / Privacy Review

- [ ] No private company names, project names, colleague names, internal-system names, business email addresses, or local filesystem paths are present in committed text.
- [ ] Screenshots contain no real recipients, subjects, message bodies, workspace names, browser profile data, tokens, or account identifiers.
- [ ] Example domains and addresses use safe placeholders such as `example.com`.
- [ ] `.audit-patterns.txt` exists locally or in CI secret material, but is not committed.
- [ ] Audit output is limited to locations and labels; matched values are not copied into issues, PRs, logs, or task notes.

## Product / Compliance Review

- [ ] README clearly explains intended use, prohibited use, and recipient controls.
- [ ] Privacy policy and terms routes render locally.
- [ ] Opt-out link is included in API responses and public opt-out pages work.
- [ ] Self-hosting guide does not require sharing secrets with the project maintainer.
- [ ] License and AGPL hosting implications are visible to readers.

## Release Communications

- [ ] Show HN draft has been reviewed for public-safety and accuracy.
- [ ] Public repo URL is correct.
- [ ] Claimed test counts, dependency versions, and feature list match the current branch.
- [ ] Known limitations are stated plainly.
- [ ] Maintainer has given explicit GO for public posting.
