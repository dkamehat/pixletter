# Audit Setup Guide

This project includes an L1 leak-detection audit system that prevents accidental commit of sensitive patterns.

## Quick Start (after cloning)

1. Copy the pattern template and fill in real values:

   ```bash
   cp .audit-patterns.example .audit-patterns.txt
   # Edit .audit-patterns.txt — replace <PLACEHOLDER> entries with real values
   ```

2. Enable the pre-commit hook:

   ```bash
   git config core.hooksPath .githooks
   ```

3. Verify setup:

   ```bash
   python scripts/self_reference_test.py
   ```

## How It Works

- **`.audit-patterns.txt`** (local only, gitignored): contains real patterns to detect
- **`scripts/audit.py`**: scans files for pattern matches (L1 detection)
- **`.githooks/pre-commit`**: runs audit on staged files before each commit
- **`.github/workflows/audit.yml`**: runs full audit on push/PR via GitHub Actions (patterns restored from repository secret `AUDIT_PATTERNS`)

## Important

- **Never commit `.audit-patterns.txt`** — it is gitignored for safety
- The `.audit-patterns.example` file contains only placeholders and is safe to commit
- GitHub Actions uses the `AUDIT_PATTERNS` repository secret to restore patterns at runtime
