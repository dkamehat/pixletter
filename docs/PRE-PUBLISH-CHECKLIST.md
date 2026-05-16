# Pre-Publish Personal Info Checklist

Run these commands before any public release or major push. All should return 0 results.

## Quick Check (copy-paste)

```bash
git grep -i "Kameoka"
git grep -i "Daiki"
git grep "亀畑"
git grep "kamehata"
git grep "出前館"
git grep -i "demae"
git grep "kamekichii"
git grep "お店価格"
git grep "PM転職"
git grep "事業企画"
git grep "STAR素材"
git grep "副業"
git grep "本業"
git grep "food delivery company"
git grep "Japanese food delivery"
git grep "Amazon リターン"
git grep -i "Amazon return"
git grep "mt_u6x208"
git grep "C:\\\\Users\\\\dkame"
git grep "/c/Users/dkame"
```

## One-liner

```bash
for p in "Kameoka" "Daiki" "亀畑" "kamehata" "出前館" "demae" "kamekichii" "mt_u6x208"; do echo "--- $p ---"; git grep -i "$p"; done
```

## Automated Protection

- **Pre-commit hook**: `.githooks/pre-commit` blocks commits with personal info patterns
- **CI check**: `.github/workflows/check-personal-info.yml` runs on every push/PR
- **Activation**: `git config core.hooksPath .githooks`
