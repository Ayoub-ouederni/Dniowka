# Dniówka

**A salary vault on Solana devnet. The employer locks the month's net pay; the worker takes what they have already earned, any day, for free; payday pays itself.**

Built for the Superteam Poland challenge *"Finance Without Intermediaries"*.

- **Live app:** https://dniowka.vercel.app (devnet, connect Phantom or Solflare set to devnet)
- **Program:** [`EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3`](https://explorer.solana.com/address/EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3?cluster=devnet) (Anchor 1.2, devnet)
- **Test "zł" token:** [`CaWiQGxgnqhB3gAEuC8r7KHe1N1dTJCa7BJ3oFzjUaKS`](https://explorer.solana.com/address/CaWiQGxgnqhB3gAEuC8r7KHe1N1dTJCa7BJ3oFzjUaKS?cluster=devnet) (Token-2022, 2 decimals, no freeze authority, no extensions)

> **Status of the upgrade authority:** the program is still upgradeable today; the authority is the
> developer's devnet wallet. It will be removed (`--final`) and the build verified before the final
> submission. Until then, "nobody can change the rules" is a promise, not yet a fact. See
> [Verified build](#verified-build-and-immutability).

---

## What it is, and for whom

*Dniówka* is Polish for "a day's wage". On day 1 of the pay period the employer locks each employee's
net salary in an on-chain vault, one vault per employee and period. Every second worked, part of it
becomes **earned**. The worker sees it fill like a booklet of 30 day-coupons and can **take money now**
(up to a guaranteed share of what they have earned), instantly, with no fee, no credit check and no
approval. They can never take more than they have earned, so a debt spiral is impossible. On payday
**anyone** can trigger the final payout: the employee gets the rest, unearned money goes back to the
employer, and a shortfall becomes a public record.

**Target users**
1. **Primary:** hourly and monthly workers in small Polish businesses (bakeries, shops, workshops,
   restaurants), including the many foreign workers in Poland. They are not crypto users: the UI never
   says wallet, token, transaction or blockchain (except in an "Under the hood" drawer for the jury),
   and amounts read `2 400,00 zł`. English and Polish.
2. **Secondary:** small-business owners who want a free, attractive employee benefit.
3. *(Planned, not built: landlords who need proof of income, see [Limitations](#limitations).)*

## Design rationale

**Relationship redesigned:** paying wages, and early access to wages already earned.

**Who the intermediary was**
- **Payday lenders** (*chwilówki*): a worker who runs out of money on the 12th borrows at a very high
  cost against wages they have *already earned* but cannot touch until payday.
- **Earned-wage-access apps** (e.g. Payflow): they front the money and charge fees, and still rely on the
  employer's promise.
- **Blind trust in the employer:** "I'll pay you on the 10th." If the company pays late or goes bankrupt,
  the worker waits (Poland's FGŚP guarantee fund exists, but it is slow).

**What changes once they are removed**
- Early access is a **direct withdrawal of the worker's own earned wages from a vault**, computed by the
  program, not a loan. No lender, no fee, no approval.
- The money is **locked before the work is done**: the employer cannot take earned wages back, cannot
  backdate a dismissal to claw them back, and cannot stop payday.
- Payday **executes itself**: one permissionless instruction any wallet can call.

**Real-world constraints that shaped the design** (Polish labour law)
- **Labour Code art. 84** forbids transferring the right to wages. So there is **no market where a third
  party buys a worker's salary**: early access is an *advance on wages* (*zaliczka na poczet
  wynagrodzenia*) paid from the worker's own vault.
- **Art. 85:** wages may be paid up to the 10th of the next month, so payday is configurable from period
  end to +10 days.
- **Sick leave, unpaid absence and corrections** change the final net pay, so only a **guaranteed floor**
  (70 % of earned by default) is withdrawable. The employer may lower the final payout down to that
  floor with a public reason code; going below it needs the employee's signature.
- **Taxes** (PIT, ZUS) stay in normal payroll: the vault holds net pay only.

Longer version, with the extra protections we added beyond the brief:
[docs/design-rationale.md](docs/design-rationale.md).

## Where each rule lives in the code

Everything below is enforced by the Anchor program in [`programs/dniowka`](programs/dniowka). The app
only reads the chain and sends transactions; no server decides anything.

| Rule | Where |
|---|---|
| **The intermediary disappears (1): take earned money now.** The program computes earned and available at the cluster clock and pays the employee directly. | [`withdraw_earned.rs#L47`](programs/dniowka/src/instructions/withdraw_earned.rs#L47) — `available` computed at [L67](programs/dniowka/src/instructions/withdraw_earned.rs#L67), refusal `ExceedsAvailable` at [L69](programs/dniowka/src/instructions/withdraw_earned.rs#L69) |
| Only the employee can withdraw (the employer gets `PaymentLocked`) | [`withdraw_earned.rs#L23`](programs/dniowka/src/instructions/withdraw_earned.rs#L23) |
| **The intermediary disappears (2): payday pays itself.** Anyone can call it once payday has come. | [`settle.rs#L60`](programs/dniowka/src/instructions/settle.rs#L60) — payday check at [L71](programs/dniowka/src/instructions/settle.rs#L71), split at [L75](programs/dniowka/src/instructions/settle.rs#L75) |
| Earned wages: `net × elapsed / duration`, clock stops at the end date | [`math.rs#L9`](programs/dniowka/src/math.rs#L9) |
| **The floor:** guaranteed share of earned | [`math.rs#L28`](programs/dniowka/src/math.rs#L28) (`floor_of`) |
| Available = `min(floor, funded) − withdrawn` | [`math.rs#L35`](programs/dniowka/src/math.rs#L35) (`available`) |
| A payday cut never goes below the floor without consent, never below what was taken | [`math.rs#L51`](programs/dniowka/src/math.rs#L51) (`cut_caps`), applied in [`math.rs#L69`](programs/dniowka/src/math.rs#L69) (`settle_split`) |
| **No backdating:** an end date can't be in the past, and can only move later | [`end_employment.rs#L27`](programs/dniowka/src/instructions/end_employment.rs#L27), [L30](programs/dniowka/src/instructions/end_employment.rs#L30) |
| Vault token authority is the stream PDA (nobody holds the key) | [`create_stream.rs#L37`](programs/dniowka/src/instructions/create_stream.rs#L37) |
| Payday between period end and +10 days, floor 0.01–100 % | [`create_stream.rs#L61`](programs/dniowka/src/instructions/create_stream.rs#L61) |
| Only a clean Token-2022 mint (no freeze authority, no extensions) | [`init_employer.rs#L34`](programs/dniowka/src/instructions/init_employer.rs#L34) |
| An employer can't be their own employee | [`accept_stream.rs#L26`](programs/dniowka/src/instructions/accept_stream.rs#L26) |
| Funding can't exceed the net salary | [`fund_stream.rs#L57`](programs/dniowka/src/instructions/fund_stream.rs#L57) |
| Integer math only, `u128` intermediates, floor rounding | [`math.rs`](programs/dniowka/src/math.rs) (unit tests at the bottom) |

All instruction entry points: [`lib.rs`](programs/dniowka/src/lib.rs). Error codes (6000+, shown as human
sentences in the UI): [`error.rs`](programs/dniowka/src/error.rs).

**Tests** (`anchor test`: 11 unit tests + 23 LiteSVM tests, clock set exactly per step):
the 10 tests of the spec are in [`tests/m1/spec.rs`](programs/dniowka/tests/m1/spec.rs) and
[`tests/m1/m3.rs`](programs/dniowka/tests/m1/m3.rs) (`t1_happy_path` … `t10_rounding_never_overpays`),
extra guards in [`tests/m1/guards.rs`](programs/dniowka/tests/m1/guards.rs).

## Who can do what

| | Can | Cannot |
|---|---|---|
| **Employer** | Create a salary, fund it (up to the net amount, before payday), end employment **from now on**, propose a payday cut with a reason, cancel an invite nobody accepted (after a grace period) | Withdraw from a vault, backdate an end date, cut below the floor without consent, stop or delay payday, cancel an accepted salary |
| **Employee** | Take up to *available* at any time, accept a proposed cut | Take more than the floor of what they have earned, or more than was funded |
| **Anyone** | Trigger payday once it has come (and pay the fee for it) | Choose where the money goes: payouts only go to the employee and the employer |
| **Us (the authors)** | No admin key, no fee switch, no pause. **Today we still hold the upgrade authority** (devnet wallet); it will be removed before the final submission. | After removal: change anything |

## Failure scenarios

- **The employer disappears or goes bankrupt:** the funded money is in the vault, owned by a program
  address. Payday pays the employee anyway, triggered by anyone.
- **The employee disappears:** anyone can trigger payday; the employee's share goes to their address,
  the unearned part back to the employer.
- **Nobody presses payday:** the money stays safe in the vault until someone does (the employee's app
  offers the button; any third party can call it).
- **The employer under-funds:** the employee can only take what was funded; at payday the missing part
  is emitted as a public `WageShortfall` event.
- **The employer fires someone and tries to backdate it:** refused on-chain (`BackdatingNotAllowed`).
- **The employee tries to take more than earned:** refused on-chain (`ExceedsAvailable`). The app's
  "Try anyway" button sends the transaction without preflight so the refusal is visible on Explorer.
- **Dniówka (the app or this website) shuts down:** the program and vaults keep working; anyone can
  build transactions from the IDL in [`app/src/chain/idl`](app/src/chain/idl).
- **The employee never accepts the invite:** the employer can cancel after a grace period (1/10 of the
  period) and gets the funding back. An accepted salary can't be cancelled.

## Why a blockchain and not a database

- A database owner (the employer, an app or a lender) can freeze, delay or reverse a payment. Here the
  employer cannot take earned wages back and the app cannot block a withdrawal.
- The rules run without us: it keeps working if the company or Dniówka shuts down.
- The money is visibly locked: the worker can check the vault holds their salary before working.
- A shortfall is a public record, not a "the transfer is on its way".

## Questions we expect

- **Where exactly does the intermediary disappear?** In `withdraw_earned` (the program computes what is
  yours and pays it) and in `settle` (payday runs itself, triggered by anyone). Links above.
- **What if one party disappears halfway?** See [Failure scenarios](#failure-scenarios).
- **Can you change anything after deployment?** Today, yes: we still hold the upgrade authority. Before
  the final submission it is removed and the build verified, then no.
- **Isn't this a loan?** No. It's an advance on wages already earned, from money already locked: no
  interest, no credit check, no debt, no third party (art. 84).
- **Why would an employer lock salaries early?** A free benefit that attracts and keeps workers, and it
  costs little compared with paying on the 10th. Weekly funding is possible (`fund_stream` can be called
  several times). Putting the locked money to work (yield) is on the roadmap, not built.
- **What would you do with another week?** See [Next](#next).

## Demo

Live on devnet at https://dniowka.vercel.app. The demo period is 30 minutes, so **1 minute = 1 "day"**,
with a 6 000 zł net salary.

1. **Employer (laptop):** "Secure October payroll". The vault shows 6 000 zł, with a "proof ↗" link.
2. **Employee (phone):** opens the invite link and joins; the coupons start filling.
3. **Day 12** (a salary started 12 minutes earlier): earned 2 400 zł, available 1 680 zł. She takes
   800 zł; a coupon tears off, with a proof link.
4. She tries **5 000 zł**: the program refuses it on-chain, and the **ODMOWA** stamp appears.
5. **Employer** tries to end the job **yesterday**: ODMOWA, "End date can't be in the past."
6. **Payday:** the big screen counts down; any wallet triggers payday; **WYPŁACONO** and the payout.

Every action shows a "proof ↗" link to Solana Explorer. Screenshots: [`docs/screenshots`](docs/screenshots).

**On-chain evidence** (devnet runs of `pnpm run smoke` and `pnpm run smoke:m3`, 2026-10-04):

| Step | Transaction |
|---|---|
| `withdraw_earned` 1 000 zł (employee takes earned pay) | [Explorer](https://explorer.solana.com/tx/3EwAyH194JMc2mYVjt3X4ymJKdYmDVLM8S8SQuMU8H8NjueGVaNSzdkARTEF8NxNjfCXZ5Vm7jytXyMNkKCqoQMu?cluster=devnet) |
| `withdraw_earned` 5 000 zł **refused on-chain** (`ExceedsAvailable`, withdraw_earned.rs:69) | [Explorer](https://explorer.solana.com/tx/5pAMpL9kqCyDkGEV7KstuaxCaTnsPwt21Jg82JvXZJZcAfioX982WdYfqArGgZBpBrk34PPaNHv11T3J962WxqcJ?cluster=devnet) |
| `settle` (payday, triggered by the employer's wallet) | [Explorer](https://explorer.solana.com/tx/Hf8fXr9Avm4JGmU3oDKcgWf3uLYMKruZwQbKraMQL7fJ31ehrfsRssPvR86zzDcU3EHH5nC8Zh2y8nUbvCGxceR?cluster=devnet) |
| `end_employment` backdated by 60 s **refused on-chain** (`BackdatingNotAllowed`) | [Explorer](https://explorer.solana.com/tx/2QkJetjfBZqj8uDZ8ziHsxNjr2TRnW6MhzCBZXE7T5uvR5cz725uWVgFsBLSsxVmMoy2cRTmznbSsAU74sbfeh5J?cluster=devnet) |
| `cancel_unaccepted` before the grace period **refused on-chain** (`CancelTooEarly`) | [Explorer](https://explorer.solana.com/tx/bh6j9cRf88JMa8z2RQN6nNcosW1LALga74d2yLCjw65yeTvcLew5NxRj6WPEo7YcS7C934HCb7FNmhBE7Y4hFnK?cluster=devnet) |
| `accept_adjustment` of an outdated amount **refused on-chain** (`AdjustmentChanged`) | [Explorer](https://explorer.solana.com/tx/psEihzbEmZbWqLFhP8XgQRpQ9TU1NRSf71YZqPZf39Cwy2FmtxuKyNjDtYh3w11PKxrbZgNuJcLBxADsheYfsqe?cluster=devnet) |
| `settle` (payday) **signed by a third party** with no role in the salary | [Explorer](https://explorer.solana.com/tx/3f8nYSgh8mJ3p6LDCz7JBcefmwPDmDCjrzssp3f74mUxCMRJdxWmZmaqAE4fhWhEYHndXGSKgUPLm8S7UGcb5uJ1?cluster=devnet) |

## Run it locally

Requirements: Rust (pinned in `rust-toolchain.toml`), Solana CLI, Anchor 1.2 (`avm`), Node + pnpm.
The organizers' dev container works too (anchor-cli 1.1.2 only warns about the version).

```bash
pnpm install

# Program: build and test (LiteSVM). Every build targets SBPF v2:
export ANCHOR_BUILD_SBF_ARCH=v2
anchor test                     # 11 unit + 23 LiteSVM tests

# App
pnpm -C app dev                 # http://localhost:5173, laptop
pnpm -C app dev:https           # self-signed HTTPS for a phone on the LAN (Android wallets need it)
pnpm -C app typecheck && pnpm -C app test && pnpm -C app lint

# Devnet end-to-end runs (dev wallet = employer and fee payer), with Explorer links
pnpm run smoke                  # create, fund, accept, withdraw, refused over-withdrawal, payday by a stranger
pnpm run smoke:m3               # adjustments, end of employment, cancel, on-chain refusals
```

**Demo data** (needs the dev wallet, which is the test-zł mint authority):

```bash
pnpm run seed -- <wallet address> [zł]               # test zł for an employer
pnpm run reset-demo                                  # settle due salaries, cancel old invites
pnpm run seed:demo [-- --employee <phone address>]   # Piekarnia Nowak: fresh invite, day 12, payday in 5 min
```

`seed:demo` prints the invite links and a labels link to open once on the big-screen laptop.
Big screen: `#/screen/<employer address>`. Each role needs a little devnet SOL for fees
(https://faucet.solana.com).

Deploy the app: `scripts/deploy-app.sh` (static build to Vercel).

## Verified build and immutability

Not done yet, on purpose: the program is still upgradeable until the final submission. Steps, ready to
run: [`scripts/verify-build.sh`](scripts/verify-build.sh). The program is built for SBPF v2
(`ANCHOR_BUILD_SBF_ARCH=v2`), so the verified build uses `solana-verify build --arch v2` and the
deployed binary is replaced by that reproducible build before verification. The upgrade authority is
then removed by the author, and the explorer shows the program as verified and not upgradeable.

## Limitations

Honest list. Where it says "known", it is a deliberate trade-off or something we did not get to.

**Legal and real-world**
- **Test money.** Wages must legally be paid in money, normally to a bank account (art. 86). Devnet uses
  a test "zł" token; production needs a regulated PLN e-money or stablecoin partner and a bank off-ramp.
- Taxes and social contributions stay in the employer's normal payroll; the vault holds net pay only.
- Contractors (umowa zlecenie / B2B) are not covered by art. 84 and could sell receivables; not built.
- On-chain amounts are public: anyone who knows a vault address sees the salary.

**Trust that is not removed yet**
- **The program is still upgradeable** (see above) until the final submission.
- The test-zł mint authority is the developer's wallet (it's a faucet for the demo, it decides nothing
  about salaries).

**Not built** (planned in the spec, dropped for time)
- **Zero-knowledge income proof for landlords** (Noir + Sunspot). `accept_stream` stores an
  `income_commitment`, but it is a placeholder: nothing reads it.
- **Fees paid by the app (Kora):** every role pays devnet SOL fees, and the employee pays the rent of
  their zł account on first withdrawal. Devnet airdrops are rate-limited; fund wallets ahead of time.
- **Blink invite link** and **yield on locked funds**: not built.
- **Nobody runs payday automatically:** any visitor presses "Run payday" once it's due (no keeper bot).

**Program behaviour worth knowing**
- A funded **open** invite (no employee address) can be claimed by whoever accepts first. The demo uses
  invites bound to the employee's address.
- After accepting a large cut, the employee can still withdraw up to the floor; payday then caps the cut
  at `earned_final − withdrawn`, so the employer may recover less than agreed.
- A cut's limits are computed against the current end date; moving the end date later grows them.
- Earned counts from `period_start`, not from the moment the employee accepts. Moving an end date later
  after it has passed pays the gap.
- Funding closes at payday, so a shortfall can't be made up on-chain afterwards.
- Vault rent and tokens sent to a vault directly (outside `fund_stream`) stay in the vault.

**App**
- Every screen polls the public devnet RPC; several open tabs plus a script can hit rate limits (429).
- The big screen follows one employer: salaries created by another employer show on that employer's
  own big screen.
- Names (company, employee) are off-chain labels carried in the invite link and stored on the device.
- The hero figure is cropped by the screen edge for 5-digit amounts at 1280 px.

## Next

With another week:
- Zero-knowledge income proof for landlords, with an honest note that privacy grows with the number of vaults.
- Kora so workers never need SOL, and a Blink invite for WhatsApp.
- A regulated PLN stablecoin and bank off-ramp; a real yield source for locked funds.
- Payroll software and KSeF / ZUS integration.

## Repository

```
programs/dniowka   Anchor program: instructions, math, state, errors, events; tests in tests/m1
app                React 19 + Vite + TypeScript, Wallet Adapter (Wallet Standard), EN/PL copy in src/copy.ts
scripts            smoke runs, seed / reset demo, IDL sync, deploy, verify-build
docs               design rationale, screenshots per milestone
```

## Sources

- Labour Code art. 84 (no waiver or transfer of wages): https://arslege.pl/niedopuszczalnosc-zrzeczenia-sie-lub-przeniesienia-na-inna-osobe-prawa-do-wynagrodzenia/k10/a1266/
- Wage payment deadline (up to the 10th): https://www.sdworx.pl/pl-pl/blog/place/termin-wyplaty-wynagrodzenia
- Advance on wages (*zaliczka*): https://poradnikprzedsiebiorcy.pl/-zaliczka-na-poczet-wynagrodzenia-jak-ja-rozliczyc
- BIK payday-loan data (Bankier): https://www.bankier.pl/wiadomosc/Polacy-wzieli-30-proc-wiecej-chwilowek-niz-rok-wczesniej-Nowe-dane-BIK-8910964.html
- BIK 2025 summary, non-bank loans to foreigners +111 % (rp.pl): https://www.rp.pl/banki/art43785761-polacy-ruszyli-po-kredyty-i-pozyczki-bik-podsumowuje-rekordowy-rok-na-rynku
- Payflow (an earned-wage-access intermediary): https://www.eu-startups.com/2025/06/madrid-based-payflow-raises-e10-million-to-expand-their-earned-wage-access-platform-across-europe-and-lam/
- ILO study on earned wage access: https://www.ilo.org/sites/default/files/2025-04/Earned%20wage%20access.pdf
- Verified builds: https://solana.com/docs/programs/verified-builds
