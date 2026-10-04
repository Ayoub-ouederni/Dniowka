# Dniówka

Salary vault on Solana devnet for the Superteam Poland "Finance Without Intermediaries" challenge.
Employer locks net pay per employee; earned part is withdrawable anytime; payday settles itself.

## Read first
- `vault/specs/product-spec.md` — full brief. §0.5 rules and §4–5 on-chain logic are the source of truth.
- `vault/architecture.md` — layout and invariants. `vault/quality-checks.md` — what gates "done".

## Hard rules
- Business logic lives in the Anchor program only. Never add server-side enforcement, admin keys or off-chain payout decisions.
- Devnet only. Integer math, floor rounding (spec §4).
- UI copy: no crypto vocabulary (spec §3.3). Amounts as `2 400,00 zł`. Copy lives in `app/src/copy.ts`.
- "Rough but working" first: M1 program, M2 minimal UI, then polish (spec §12).
- Never read or print keypairs. Final upgrade-authority removal is done by the user.

## Toolchain (installed; non-login shells need `.claude/hooks/env.sh` PATH)
anchor (avm), solana CLI 4.x, cargo/rustc, node + pnpm, nargo (Noir), sunspot (ZK, M6), solana-verify.
Project MCP: `solana` (docs/Anchor help). Use `/design` and `/check` for UI work, `/plan-first` per milestone.

## Workflow
Per milestone: plan, build, run `anchor test` / app checks, show output as evidence, then commit (lean messages, no attribution).
