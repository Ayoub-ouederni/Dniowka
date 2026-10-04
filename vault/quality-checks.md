# Quality checks

Automatic (`.claude/hooks/`):
- PostToolUse Write|Edit → `lint.sh`: cargo fmt, prettier + eslint (app), nargo fmt. No-op until the folder exists.
- Stop → `gate.sh`: cargo clippy -D warnings, app typecheck + test scripts, nargo test. Exit 2 blocks "done".

Manual, per milestone (slow, boots a validator):
- `anchor build && anchor test` (spec §5.4 tests 1–10)
- Frontend: `/check` skill (screenshot in a real browser) before calling UI done.
- Live devnet run with three wallets (employer, employee, anyone) and Explorer links.
- M7 only: `solana-verify`, then remove upgrade authority (`--final`). Irreversible, and denied in settings: run it yourself.

Toolchain PATH (non-login shells): see `.claude/hooks/env.sh`.
