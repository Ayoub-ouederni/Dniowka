#!/usr/bin/env bash
# Copy the Anchor IDL and its TS type into the app (target/ is gitignored).
# Re-run after every `anchor build`.
set -euo pipefail
cd "$(dirname "$0")/.."
cp target/idl/dniowka.json app/src/chain/idl/dniowka.json
cp target/types/dniowka.ts app/src/chain/idl/dniowka.ts
echo "IDL synced into app/src/chain/idl/"
