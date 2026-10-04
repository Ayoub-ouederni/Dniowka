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
(upgradeable, authority = dev wallet).
M2 done 2026-10-04: minimal UI in `app/` (employer register / add / secure; employee join /
take / try anyway; payday by anyone; proof links; Under the hood). No program change.
M3 done 2026-10-04: propose_adjustment / accept_adjustment / cancel_unaccepted (program upgraded
in place on devnet, same ID), tests 6 and 10, end-of-employment + adjustment UI, big screen.
Next: M4 (polish).

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

## M2 decisions (approved plan, 2026-10-04)
- **React 19 + Vite 8 + TS 6** in `app/` (pnpm workspace). eslint + prettier + vitest.
- **The UI never computes `available`.** Earned / available come from a simulated
  `withdraw_earned(u64::MAX)` (no signature, fee payer = employer wallet) and the program's log
  line `earned X available Y` (`chain/view.ts`). The strip fills from that earned figure.
  A refusal's numbers come from the failed transaction's own logs (`chain/errors.ts`).
- **"Now" = cluster Clock sysvar**, interpolated between 4 s polls; never the device clock alone.
- **Normal actions:** Wallet Adapter `sendTransaction`. **"Try anyway":** `signTransaction`
  then broadcast with `skipPreflight`, so the program refuses on-chain (failed tx on Explorer).
- **Wallets:** Wallet Standard only (Phantom / Solflare / MWA). Vendor modal text says
  "wallet" (known leak, custom picker in M4).
- **Dev-only burner** (`VITE_DEV_BURNER=1`, dev server only, absent from `vite build`): Wallet
  Adapter's burner subclassed to keep its key in localStorage, so a funded test account
  survives reloads. One account per origin (localhost / 127.0.0.1 / LAN IP).
- **IDL in the app:** `pnpm run sync-idl` copies `target/idl` + `target/types` into
  `app/src/chain/idl/` (committed). Re-run after every `anchor build`.
- **Test zł:** `pnpm run seed -- <wallet> [zł]` mints from the clean Token-2022 mint
  `CaWiQGxgnqhB3gAEuC8r7KHe1N1dTJCa7BJ3oFzjUaKS` (authority = dev wallet). Allowed off-chain
  faucet; decides nothing about salaries.
- **Names are off-chain labels:** company / employee names travel in the invite link
  (`#/s/<stream>?c=…&n=…`) and the employer's localStorage, never on-chain.
- **Amounts** `2 400,00 zł` with no-break spaces (own formatter); dates `dd.mm.yyyy hh:mm`,
  Europe/Warsaw. Countdown `6 min 05 s` (never like a clock time).
- **Phone:** `pnpm -C app dev:https` (self-signed, `@vitejs/plugin-basic-ssl`) because Android
  MWA needs a secure context; `pnpm -C app dev` (HTTP) for the laptop.

## M3 decisions (approved plan, 2026-10-04)
- **`accept_adjustment(amount)`** (beyond the spec's no-arg form): the employee consents to the exact
  amount they reviewed; `AdjustmentChanged` if the employer swapped the proposal meanwhile.
  `propose_adjustment` always resets `adjustment_accepted` (fixes the M2 limitation).
- **`propose_adjustment`**: Active, `now < payday`, reason 1..=4, `0 < amount ≤ earned_final − withdrawn`.
  The no-consent cap (`earned_final − max(floor, withdrawn)`) is applied by `settle`, not refused.
  Logs `cut cap X with consent Y` before its checks; the app reads it by simulating an impossible
  proposal (same approach as M2's `earned X available Y`). Shared math: `math::cut_caps`,
  `Stream::earned_final`.
- **`cancel_unaccepted`** in M3: Invited only, grace = period length / 10 (3 days of a 30-day month,
  30 s of a 5-min demo). Refunds `funded` (memo first, like settle); status Cancelled. Logs
  `cancel allowed from T` so a too-early refusal can say when.
- **Errors 6022–6027** appended: InvalidAdjustmentReason, AdjustmentTooLarge, AdjustmentClosed,
  NoAdjustment, AdjustmentChanged, CancelTooEarly. Events: AdjustmentProposed, AdjustmentAccepted,
  StreamCancelled.
- **End-of-employment picker**: `datetime-local` read as Europe/Warsaw wall time (`format.ts`),
  min = cluster now, max = period end. A past date disables the normal button and offers
  "Try anyway" (signed, sent without preflight) so the program refuses it on-chain.
- **Big screen** `#/screen/<employer wallet>`: no header/footer. Vault total = real vault token
  balances; countdown = nearest payday (cluster clock). Receipt = program events + on-chain refusals
  of the last 25 program transactions (`chain/feed.ts`), read ≤ 6 new tx per 8 s on a separate
  connection with `disableRetryOnRateLimit` (public devnet 429s otherwise blanked the screen).
  Names come from the employer's localStorage labels; else "Employee #id". QR → M6, flip clock → M4.
- **Devnet evidence script**: `pnpm run smoke:m3` (dev wallet = employer + fee payer, fresh 0-SOL
  employee and payday caller; `PAUSE=45` holds with a pending adjustment to look at the app).

## Known limitations (README later)
- A funded open invite can be claimed by whoever accepts first; seed/demo use hinted invites.
- After accepting a large adjustment the employee can still withdraw up to the floor; settle then
  caps the cut at `earned_final − withdrawn`, so the employer may recover less than agreed.
- An adjustment's caps are computed against the current end date; moving the end date later grows
  them. Tokens sent straight to a vault are not part of `funded` and stay there on cancel too.
- Earned counts from `period_start`, not from acceptance. Moving an end date later after it
  passed pays the gap. Funding closes at payday, so a shortfall can't be cured on-chain after.
- Vault rent and tokens sent to a vault directly stay there.
- M2 UI: every actor pays devnet SOL fees (and the employee's zł account rent) until Kora (M5).
  Devnet airdrops are often rate-limited; fund demo wallets from faucet.solana.com ahead of time.
- M2 UI: nobody runs payday automatically yet; any visitor can press "Run payday" once it's due.
- Every screen polls the public devnet RPC; several open tabs plus a script can hit 429s.
- M6: the stored commitment is a
  placeholder; bind the leaf to the stream's real `net_amount` before writing the circuit.

## How to run
- `source .claude/hooks/env.sh && anchor test` (11 unit + 23 LiteSVM tests).
- `pnpm install && pnpm run smoke` — real-time devnet run with Explorer links; `pnpm run smoke:m3`
  for adjustments, end of employment, cancel and the on-chain refusals.
- App: `VITE_DEV_BURNER=1 pnpm -C app dev --port 5180` (5173 is taken on this laptop) or `pnpm -C app dev:https` (phone on
  the LAN). Checks: `pnpm -C app typecheck`, `pnpm -C app test`, `pnpm -C app lint`.
- Test zł for an employer: `pnpm run seed -- <wallet address> [zł]`.
- After `anchor build`: `pnpm run sync-idl`.
