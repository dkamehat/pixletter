# Audit Setup Guide

This project includes an L1 leak-detection audit system that prevents accidental commits of sensitive references.

## Quick Start

1. Copy the pattern template and add non-secret regex categories:

   ```bash
   cp .audit-patterns.example .audit-patterns.txt
   # Edit .audit-patterns.txt with labeled regexes only.
   # Do not add sensitive literal values.
   ```

2. Enable the pre-commit hook:

   ```bash
   git config core.hooksPath .githooks
   ```

3. Verify setup:

   ```bash
   python scripts/self_reference_test.py
   ```

## Pattern Format

Each non-comment line in `.audit-patterns.txt` uses this format:

```text
label<TAB>regular-expression
```

Example labels should describe the category, not the secret value:

- `tier3_email`
- `tier3_local_path`
- `tier3_internal_system`

## How It Works

- **`.audit-patterns.txt`** (local only, gitignored): contains labeled regex patterns to detect.
- **`scripts/audit.py`**: scans files for pattern matches.
- **`.githooks/pre-commit`**: runs the audit on staged files before each commit.
- **`.github/workflows/audit.yml`**: runs the full audit on push/PR using repository secret material.

## Important

- Never commit `.audit-patterns.txt`; it is gitignored for safety.
- Do not put sensitive literal values in `.audit-patterns.txt`, CI secrets, logs, or commit messages.
- Keep `.audit-patterns.example` limited to non-secret regex categories.
- The audit script reports only file path, line number, and pattern label.
- Do not copy matched values into issues, pull requests, task notes, or chat logs.
