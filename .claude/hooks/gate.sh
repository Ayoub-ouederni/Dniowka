#!/usr/bin/env bash
# Stop gate: fast checks only (clippy, cargo test, tsc, vitest, nargo test).
# `anchor test` (boots a validator, slow) is run manually at each milestone, see vault/quality-checks.md.
. "$(dirname "$0")/env.sh"
fail=0
if [ -f Cargo.toml ]; then
  cargo clippy --workspace --all-targets -- -D warnings 2>&1 | tail -25 || fail=1
  [ "${PIPESTATUS[0]}" -ne 0 ] && fail=1
fi
if [ -f app/package.json ]; then
  (cd app && grep -q '"typecheck"' package.json && pnpm run -s typecheck 2>&1 | tail -25); [ "${PIPESTATUS[0]}" -ne 0 ] && fail=1
  (cd app && grep -q '"test"' package.json && pnpm run -s test 2>&1 | tail -25); [ "${PIPESTATUS[0]}" -ne 0 ] && fail=1
fi
if [ -f circuits/income/Nargo.toml ]; then
  (cd circuits/income && nargo test 2>&1 | tail -15); [ "${PIPESTATUS[0]}" -ne 0 ] && fail=1
fi
if [ "$fail" -ne 0 ]; then echo "Quality gate failed: fix before finishing." >&2; exit 2; fi
exit 0
