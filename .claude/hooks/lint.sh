#!/usr/bin/env bash
# PostToolUse (Write|Edit): format whatever exists. Silent no-op until the scaffold is there.
. "$(dirname "$0")/env.sh"
[ -f Cargo.toml ] && cargo fmt --all 2>&1 | tail -5
if [ -f app/package.json ]; then
  (cd app && pnpm exec prettier --write . >/dev/null 2>&1; pnpm exec eslint --fix . 2>&1 | tail -15)
fi
[ -f circuits/income/Nargo.toml ] && (cd circuits/income && nargo fmt 2>&1 | tail -5)
exit 0
