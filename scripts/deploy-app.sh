#!/usr/bin/env bash
# Builds the app and publishes app/dist to Vercel as a static site (hash routing, no rewrites).
# Usage: scripts/deploy-app.sh [--preview]   (default: production)
# Needs `vercel login` once. The dev burner is not in `vite build`, so the public site only
# offers real wallets. RPC = public devnet unless VITE_RPC_URL is set at build time.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm -C app build
if grep -q "VITE_DEV_BURNER" app/dist/assets/*.js; then
  echo "dev burner found in the build, refusing to deploy" >&2
  exit 1
fi

if [[ "${1:-}" == "--preview" ]]; then
  vercel deploy app/dist --project dniowka --yes
else
  vercel deploy app/dist --project dniowka --prod --yes
fi
