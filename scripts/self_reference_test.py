#!/usr/bin/env python
"""
Self-Reference Test: verify the defense files themselves are clean.

Runs the 7 verification items:
1. .audit-patterns.txt exists and is gitignored
2. .audit-patterns.example is L1-clean (committable)
3. scripts/audit.py is L1-clean
4. .githooks/pre-commit is L1-clean
5. .github/workflows/audit.yml is L1-clean
6. All other committed docs are L1-clean
7. Dummy pattern commit triggers hook failure
"""
import subprocess
import sys
from pathlib import Path


def find_repo_root() -> Path:
    return Path(subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"], text=True
    ).strip())


def get_python_cmd() -> str:
    """Return a working python command. Windows python3 alias is fake, so verify."""
    for cand in ("python", "python3"):
        try:
            r = subprocess.run(
                [cand, "--version"],
                capture_output=True, text=True, timeout=5,
            )
            if r.returncode == 0:
                return cand
        except (FileNotFoundError, OSError):
            continue
    return "python"


def run_audit(target: str | None = None, mode: str | None = None) -> tuple[int, str]:
    """Run audit.py with given args. Returns (exit_code, stderr)."""
    py = get_python_cmd()
    cmd = [py, "scripts/audit.py"]
    if mode:
        cmd.append(mode)
    if target:
        cmd.append(target)
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stderr


def check_gitignored(path: str, repo_root: Path) -> bool:
    """Verify path is gitignored."""
    result = subprocess.run(
        ["git", "check-ignore", path],
        cwd=repo_root, capture_output=True, text=True,
    )
    return result.returncode == 0


def main() -> int:
    repo_root = find_repo_root()
    print(f"Self-Reference Test starting at {repo_root}\n")

    failures = []

    print("[1/7] .audit-patterns.txt existence and gitignore status...")
    patterns_file = repo_root / ".audit-patterns.txt"
    if not patterns_file.exists():
        failures.append("Item 1: .audit-patterns.txt does not exist")
    elif not check_gitignored(".audit-patterns.txt", repo_root):
        failures.append("Item 1: .audit-patterns.txt is NOT gitignored (CRITICAL)")
    else:
        print("  PASS")

    targets = [
        ("Item 2", ".audit-patterns.example"),
        ("Item 3", "scripts/audit.py"),
        ("Item 4", ".githooks/pre-commit"),
        ("Item 5", ".github/workflows/audit.yml"),
    ]
    for label, target in targets:
        print(f"[{label[5]}/7] L1 audit on {target}...")
        if not (repo_root / target).exists():
            failures.append(f"{label}: {target} does not exist")
            continue
        code, err = run_audit(target=target)
        if code == 0:
            print("  PASS")
        else:
            failures.append(f"{label}: {target} has leakage:\n{err}")

    print("[6/7] L1 audit on all tracked files (--all)...")
    code, err = run_audit(mode="--all")
    if code == 0:
        print("  PASS")
    else:
        failures.append(f"Item 6: tracked files have leakage:\n{err}")

    print("[7/7] Hook failure test with dummy pattern...")
    print("  (Manual verification recommended - see SPEC S-6.2 for procedure)")

    print("\n" + "=" * 60)
    if failures:
        print(f"FAIL: {len(failures)} item(s) failed:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("PASS: items 1-6 all clean. Run item 7 manually.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
