#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Cyrillic guard — fails if any Russian/Ukrainian letter (А-я, ё) leaks
# into user-facing code (frontend/app + frontend/src), EXCEPT locale
# resource files under src/i18n/locales/ where RU is legitimate.
#
# Usage:
#   bash scripts/check-cyrillic.sh           # scan
#   exit code 1 → violations found, 0 → clean
#
# Wired into:
#   - .husky/pre-commit   (local git hook)
#   - .github/workflows/cyrillic-guard.yml   (CI on PR)
# ─────────────────────────────────────────────────────────────
set -u
# Ignore SIGPIPE (pipelines with head/tail close early)
trap '' PIPE

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "⚠️  frontend/ not found at ${FRONTEND_DIR}, nothing to scan"
  exit 0
fi

# PCRE range U+0400–U+04FF covers Cyrillic block (Russian, Ukrainian).
RANGE='[\x{0400}-\x{04FF}]'

# Scan app/ and src/ but EXCLUDE the i18n locale folder.
violations=$(
  grep -rlnP "${RANGE}" \
    "${FRONTEND_DIR}/app" \
    "${FRONTEND_DIR}/src" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    2>/dev/null | grep -v '/i18n/locales/' || true
)

if [[ -n "${violations}" ]]; then
  echo "❌ Cyrillic found in user-facing code (must be moved to i18n/locales/*.json):"
  echo ""
  echo "${violations}" | while IFS= read -r file; do
    echo "  📄 ${file}"
    grep -nP "${RANGE}" "${file}" | head -5 | sed 's/^/     /'
    echo ""
  done
  echo "Move these strings to src/i18n/locales/{de,en,ru}.json and replace with t('key')."
  exit 1
fi

echo "✅ No Cyrillic leaks in frontend/app and frontend/src"
exit 0
