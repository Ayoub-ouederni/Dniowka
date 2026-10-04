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
Empty repo. Toolchain installed 2026-10-04. Next: M1 (spec §12).
