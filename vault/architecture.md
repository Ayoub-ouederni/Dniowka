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
M4 done 2026-10-04: polish (coupon booklet, stamps, receipts, tear/hold flow, flip clock, EN/PL,
own connect picker), `seed:demo` / `reset-demo`. No program change, no redeploy.
M7 partial 2026-10-04: README + docs/design-rationale.md, app live at https://dniowka.vercel.app
(`scripts/deploy-app.sh`, static Vercel, public devnet RPC). M5/M6 dropped for time (listed as not built in
the README). Not done yet: verified build + `--final` (steps in `vault/m7-jour-j.md`, script
`scripts/verify-build.sh`), backup video (`vault/m7-checklists.md`).

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

## M4 decisions (plan vault/plans/m4.md, executed without live approval at the user's request)
- **Strip = booklet of 30 stub coupons** (`components/Strip.tsx`, pure math in `strip.ts`, tested).
  Fill is still the program's simulated `earned`; each coupon's fill is a `scaleX` with a linear
  transition of one poll (4 s), so it glides between two readings. No clock-based estimate of pay.
  Taken days become grey jagged stubs + a "taken" pile; days from `end_ts` on are hatched
  "after the contract". Payday: coupons fly up, then stubs + WYPŁACONO.
- **Take money** (`components/TakeMoney.tsx`, state in `tear.ts`): stepper by whole days
  (`tearSteps`: completes a part-taken day first, last step = program's `available`), tap/drag on
  the strip, exact-amount field (needed for the 5 000 zł "Try anyway"). Then a receipt (you get ·
  fee 0,00 zł · taken in total · left in the vault = funded − withdrawn − X, a vault fact instead of
  the spec's "left this month", which would be wrong after an end date or adjustment), then
  `HoldButton` (1.2 s, pointer or Space/Enter; a screen reader's virtual click confirms directly).
- **Refusal**: ODMOWA stamp laid over the strip (sticky, with a veil), reason card + proof under it.
- **EN/PL**: `copy.ts` exports `en` and `pl: Copy`; `copy` is a live binding swapped by `setLang`;
  `lang.ts` (useSyncExternalStore) re-renders the tree, saves the choice, sets `<html lang>`.
  "Under the hood" rule texts stay English (jury); its labels are translated. Countdown units stay
  `d / h / min / s` in both languages (valid Polish abbreviations); the flip clock spells them out.
  `copy.test.ts` walks every non-hood string of both languages for crypto words and checks PL has
  the same keys and is actually translated.
- **Own connect picker** (`<dialog>`), vendor modal and its CSS removed (§3.3 leak).
  `@solana/wallet-adapter-react-ui` is now unused in package.json (left in place; remove later).
- **Labels link** `#/labels?a=&c=&<salary>=<name>` stores off-chain names on the device, then
  opens the big screen. Printed by `seed:demo`.
- **Dev gallery** `#/dev/gallery` (DEV only, lazy, absent from `vite build`): real components with
  sample data for the states a 0-SOL test account can't reach. Visual QA only.
- **Scripts** (`scripts/lib/devnet.ts` shared; smoke scripts untouched): `seed:demo` (dev wallet =
  Piekarnia Nowak + fee payer; Oksana invite, Oksana day 12, Marek payday in `PAYDAY_IN` min with
  1 000 zł taken and a 200 zł adjustment; `--employee <addr>` locks Oksana's salaries to her
  account), `reset-demo` (settles due salaries as the "anyone" caller, cancels invites past grace,
  `--wait N`, `--dry-run`; decision in `lib/reset-plan.ts`, tested with `node:test`). `send` retries
  429s only until the node accepts the bytes, never re-sends after (no double action).
  Order before a demo: `reset-demo`, then `seed:demo` (a fresh invite is cancellable after 3 min).
- **Checks as scripts**: `scripts/check-contrast.mjs` (every text pair ≥ 4.5:1),
  `scripts/check-touch-targets.js` (paste into a browser evaluate; empty = pass).

## Known limitations (README later)
- A funded open invite can be claimed by whoever accepts first; seed/demo use hinted invites.
- After accepting a large adjustment the employee can still withdraw up to the floor; settle then
  caps the cut at `earned_final − withdrawn`, so the employer may recover less than agreed.
- An adjustment's caps are computed against the current end date; moving the end date later grows
  them. Tokens sent straight to a vault are not part of `funded` and stay there on cancel too.
- Earned counts from `period_start`, not from acceptance. Moving an end date later after it
  passed pays the gap. Funding closes at payday, so a shortfall can't be cured on-chain after.
- Vault rent and tokens sent to a vault directly stay there.
- Big screen follows one employer: the seeded salaries belong to the dev wallet, a Phantom employer
  used live in the demo shows on its own big screen.
- The hero figure is only cropped by the screen edge for 5-digit amounts at 1280 px.
- M2 UI: every actor pays devnet SOL fees (and the employee's zł account rent) until Kora (M5).
  Devnet airdrops are often rate-limited; fund demo wallets from faucet.solana.com ahead of time.
- M2 UI: nobody runs payday automatically yet; any visitor can press "Run payday" once it's due.
- Every screen polls the public devnet RPC; several open tabs plus a script can hit 429s.
- M6: the stored commitment is a
  placeholder; bind the leaf to the stream's real `net_amount` before writing the circuit.

## How to run
- `source .claude/hooks/env.sh && anchor test` (11 unit + 23 LiteSVM tests).
- Demo data: `pnpm run reset-demo` then `pnpm run seed:demo [-- --employee <addr>]`; open the printed
  labels link once on the big-screen laptop. `pnpm run test:scripts` for the script logic.
- `pnpm install && pnpm run smoke` — real-time devnet run with Explorer links; `pnpm run smoke:m3`
  for adjustments, end of employment, cancel and the on-chain refusals.
- App: `VITE_DEV_BURNER=1 pnpm -C app dev --port 5180` (5173 is taken on this laptop) or `pnpm -C app dev:https` (phone on
  the LAN). Checks: `pnpm -C app typecheck`, `pnpm -C app test`, `pnpm -C app lint`.
- Test zł for an employer: `pnpm run seed -- <wallet address> [zł]`.
- After `anchor build`: `pnpm run sync-idl`.
