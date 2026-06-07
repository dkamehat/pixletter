#!/usr/bin/env python
"""
L1 audit: detect committed leakage of patterns defined in .audit-patterns.txt

Usage:
  python scripts/audit.py --staged              # staged files only (for pre-commit)
  python scripts/audit.py --all                 # all tracked files (for full scan)
  python scripts/audit.py path/to/file.md ...   # specific files

Exit codes:
  0 = no patterns matched
  1 = patterns matched (leakage detected)
  2 = configuration error (e.g. .audit-patterns.txt missing)
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

PATTERNS_FILE = ".audit-patterns.txt"
# Files that are themselves never expected to contain patterns; skip them.
# This list MUST NOT include the pattern file itself - .gitignore handles that.
DEFAULT_SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".otf", ".ico"}
DEFAULT_SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", ".vercel", "__pycache__"}


def load_patterns(repo_root: Path) -> list[tuple[str, re.Pattern]]:
    """Load labeled regex patterns from .audit-patterns.txt."""
    patterns_path = repo_root / PATTERNS_FILE
    if not patterns_path.exists():
        print(f"ERROR: {PATTERNS_FILE} not found at {patterns_path}", file=sys.stderr)
        print(f"  Hint: cp .audit-patterns.example .audit-patterns.txt and add labeled regexes.", file=sys.stderr)
        sys.exit(2)

    patterns = []
    with patterns_path.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.rstrip("\n").rstrip("\r")
            if not line or line.lstrip().startswith("#"):
                continue
            if "\t" in line:
                label, pattern = line.split("\t", 1)
            else:
                label, pattern = "unlabeled_pattern", line
            label = label.strip()
            pattern = pattern.strip()
            if not label or not pattern:
                print(f"WARNING: empty label or pattern at {PATTERNS_FILE}:{line_no}", file=sys.stderr)
                continue
            try:
                compiled = re.compile(pattern, re.IGNORECASE)
                patterns.append((label, compiled))
            except re.error as e:
                print(f"WARNING: invalid pattern at {PATTERNS_FILE}:{line_no}: {e}", file=sys.stderr)

    if not patterns:
        print(f"ERROR: {PATTERNS_FILE} has zero valid patterns. Check the file.", file=sys.stderr)
        sys.exit(2)

    return patterns


def get_staged_files(repo_root: Path) -> list[Path]:
    """Files staged for commit."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        cwd=repo_root, capture_output=True, text=True, check=True,
    )
    return [repo_root / f for f in result.stdout.splitlines() if f]


def get_all_tracked_files(repo_root: Path) -> list[Path]:
    """All files tracked by git."""
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=repo_root, capture_output=True, text=True, check=True,
    )
    return [repo_root / f for f in result.stdout.splitlines() if f]


def should_skip(path: Path, repo_root: Path) -> bool:
    """Skip binaries and known-noisy directories."""
    if path.suffix.lower() in DEFAULT_SKIP_SUFFIXES:
        return True
    try:
        rel = path.relative_to(repo_root)
        for part in rel.parts:
            if part in DEFAULT_SKIP_DIRS:
                return True
    except ValueError:
        pass
    return False


def scan_file(path: Path, patterns: list[tuple[str, re.Pattern]]) -> list[tuple[int, str]]:
    """Return list of (line_number, label), never matched text."""
    matches = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except (OSError, UnicodeError) as e:
        print(f"WARNING: cannot read {path}: {e}", file=sys.stderr)
        return matches

    for lineno, line in enumerate(text.splitlines(), start=1):
        for label, regex in patterns:
            m = regex.search(line)
            if m:
                matches.append((lineno, label))
    return matches


def find_repo_root() -> Path:
    """Locate repo root via git."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True, text=True, check=True,
    )
    return Path(result.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="L1 leak audit")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--staged", action="store_true", help="scan git staged files")
    group.add_argument("--all", action="store_true", help="scan all tracked files")
    parser.add_argument("files", nargs="*", help="specific files to scan")
    args = parser.parse_args()

    repo_root = find_repo_root()
    patterns = load_patterns(repo_root)
    print(f"Loaded {len(patterns)} patterns from {PATTERNS_FILE}", file=sys.stderr)

    if args.staged:
        targets = get_staged_files(repo_root)
    elif args.all:
        targets = get_all_tracked_files(repo_root)
    elif args.files:
        targets = [Path(f).resolve() for f in args.files]
    else:
        parser.error("specify --staged, --all, or file paths")

    total_matches = 0
    for target in targets:
        if not target.exists() or should_skip(target, repo_root):
            continue
        if not target.is_file():
            continue
        matches = scan_file(target, patterns)
        for lineno, label in matches:
            try:
                rel = target.relative_to(repo_root)
            except ValueError:
                rel = target
            print(f"LEAK: {rel}:{lineno}: {label} matched", file=sys.stderr)
            total_matches += 1

    if total_matches > 0:
        print(f"\nFAIL: {total_matches} leakage(s) detected. Commit blocked.", file=sys.stderr)
        print("Review the listed files and remove the leakage before committing.", file=sys.stderr)
        return 1

    print(f"PASS: scanned {len(targets)} target(s), 0 leakage detected.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
