#!/usr/bin/env python
"""
Sanitize files by replacing patterns.

Usage:
  python scripts/sanitize.py --map sanitize-map.txt --target FILE [FILE ...]
  python scripts/sanitize.py --map sanitize-map.txt --all

sanitize-map.txt format (one per line, tab-separated):
  REAL_VALUE<TAB>REPLACEMENT_VALUE

The map file MUST be gitignored.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def load_map(map_path: Path) -> list[tuple[str, str]]:
    pairs = []
    with map_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n").rstrip("\r")
            if not line or line.lstrip().startswith("#"):
                continue
            if "\t" not in line:
                print(f"WARNING: skipping malformed line: {line[:50]}...", file=sys.stderr)
                continue
            real, replacement = line.split("\t", 1)
            pairs.append((real, replacement))
    return pairs


def sanitize_file(path: Path, pairs: list[tuple[str, str]], backup: bool) -> int:
    """Returns number of replacements made."""
    try:
        original = path.read_text(encoding="utf-8")
    except UnicodeError:
        print(f"WARNING: {path} is not UTF-8, skipping", file=sys.stderr)
        return 0

    modified = original
    count = 0
    for real, replacement in pairs:
        if real in modified:
            modified = modified.replace(real, replacement)
            count += modified.count(replacement) - original.count(replacement)

    if count > 0:
        if backup:
            shutil.copy(path, path.with_suffix(path.suffix + ".bak"))
        path.write_text(modified, encoding="utf-8", newline="\n")
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", required=True, help="replacement map file")
    parser.add_argument("--target", nargs="*", help="specific files")
    parser.add_argument("--all", action="store_true", help="all tracked files")
    parser.add_argument("--no-backup", action="store_true", help="skip .bak files")
    args = parser.parse_args()

    pairs = load_map(Path(args.map))
    print(f"Loaded {len(pairs)} replacement rules", file=sys.stderr)

    if args.all:
        repo_root = Path(subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True
        ).strip())
        result = subprocess.run(
            ["git", "ls-files"], cwd=repo_root, capture_output=True, text=True
        )
        targets = [repo_root / f for f in result.stdout.splitlines()]
    else:
        targets = [Path(t) for t in (args.target or [])]

    total = 0
    for target in targets:
        if not target.is_file():
            continue
        if target.suffix.lower() in {".png", ".jpg", ".pdf", ".zip"}:
            continue
        count = sanitize_file(target, pairs, backup=not args.no_backup)
        if count > 0:
            print(f"  {target}: {count} replacement(s)", file=sys.stderr)
            total += count

    print(f"\nTotal: {total} replacement(s) across {len(targets)} file(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
