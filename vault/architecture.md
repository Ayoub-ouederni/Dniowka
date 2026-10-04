# Architecture (target — see specs/product-spec.md for the full brief)

```
programs/dniowka   Anchor program: Employer, Stream, vault PDA, IncomeRegistry, IncomeAttestation
circuits/income    Noir circuit (ZK income proof), Sunspot/Groth16 verifier
app                React + Vite + TS, Wallet Adapter, generated Anchor client
scripts            seed-demo.ts, reset-demo.ts, verify-build.sh
docs               design-rationale.md, screenshots
```

## Invariants (do not break)
- All terms (available, payouts, adjustments, payday) are computed and enforced **on-chain**. No backend decides anything, holds funds or holds an admin key.
- Integer math only (u64, u128 intermediates, floor rounding). Token has 2 decimals (grosze).
- One vault per stream, token authority = Stream PDA.
- `end_employment` rejects `end_ts < now` (no backdating).
- UI never shows crypto vocabulary outside the "Under the hood" drawer (spec §3.3).
- Devnet only.

## Status
M1 done 2026-10-04: program on devnet, `EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3`
(upgradeable, authority = dev wallet). Next: M2 minimal UI.

## M1 decisions (approved plan, 2026-10-04)
- **Anchor 1.2.0** crates (not 1.1.2: avm would switch the machine to Solana 3.1.10).
  The organizers' container runs anchor-cli 1.1.2, which only warns on the mismatch.
- **Tests:** Rust + LiteSVM 0.10 under `anchor test`, clock set exactly per step.
  LiteSVM 0.10 cannot load Anchor 1.2's default SBPF v3 build, so every build uses
  `ANCHOR_BUILD_SBF_ARCH=v2` (exported in `.claude/hooks/env.sh`; devnet accepts v2).
  LiteSVM 0.15 + v3 was tried first and does not compile from crates.io (Agave 4.2 drift).
- **Rust pinned to 1.97.1** (`rust-toolchain.toml`); resolver falls back to deps that fit
  rust-version 1.89 (`.cargo/config.toml`).
- **Invite:** `employee_hint` is optional. Set = only that wallet may accept; empty = first
  signer binds. While `Invited`, `Stream.employee` holds the hint (default key = open).
- **Beyond the spec's letter** (each closes a way around "employer cannot take back
  earned wages / stop payday"):
  1. Only a clean Token-2022 mint (no freeze authority, no extensions) is accepted.
  2. `settle` logs a memo before each payout and skips zero legs (required-memo accounts
     cannot block payday).
  3. Separate rent `payer` signer on init_employer, create_stream, withdraw_earned, settle.
  4. An employer cannot be their own employee.
  5. Anyone but the employee calling `withdraw_earned` gets `PaymentLocked`.
- **Errors** are append-only: spec names first (6000+), then extras. UI maps codes.
- **Vault is never closed** (keeps `AlreadySettled` reachable on a second settle).

## Known limitations (README later)
- A funded open invite can be claimed by whoever accepts first; seed/demo use hinted invites.
- Until `cancel_unaccepted` (instruction 10, no milestone yet; suggest M3) exists, funding of a
  stream nobody accepts stays locked.
- Earned counts from `period_start`, not from acceptance. Moving an end date later after it
  passed pays the gap. Funding closes at payday, so a shortfall can't be cured on-chain after.
- Vault rent and tokens sent to a vault directly stay there.
- M3: `propose_adjustment` must reset `adjustment_accepted`. M6: the stored commitment is a
  placeholder; bind the leaf to the stream's real `net_amount` before writing the circuit.

## How to run
- `source .claude/hooks/env.sh && anchor test` (10 unit + 17 LiteSVM tests).
- `pnpm install && pnpm run smoke` — real-time devnet run with Explorer links.
