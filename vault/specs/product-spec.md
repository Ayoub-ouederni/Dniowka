# Dniówka — Product & Build Spec

> **Purpose of this file:** a complete brief for building Dniówka for the Superteam Poland challenge **"Finance Without Intermediaries"** (Solana, devnet, live demo). Read it fully before writing code. Sections 3–5 are the source of truth for business logic; when in doubt, the on-chain rules in §5 win.

---

## 0. TL;DR

**Dniówka** (Polish: "a day's wage") is a salary vault on Solana.

- On day 1 of the pay period, the employer **locks the month's net salary** for each employee in an on-chain vault.
- Every day worked, part of that salary becomes **earned**. The employee watches it fill up, day by day.
- Whenever they need money, the employee **withdraws what they have already earned** instantly and for free, instead of taking a *chwilówka* (an expensive Polish payday loan).
- They can **never withdraw more than they have earned**, so a debt spiral is impossible.
- On payday the vault **pays out the rest automatically**. Nobody approves anything, and the employer cannot take back earned wages.
- Bonus: the employee can generate a **zero-knowledge income proof** for a landlord ("guaranteed income ≥ 3× rent") without revealing their salary or employer.

**Who the intermediary was:** the payday lender and paid "earned wage access" apps that sit between a worker and money they've already earned, plus the blind trust in the employer's "I'll pay you on the 10th."
**What replaces it:** a program that holds the funds and computes, every second, what belongs to the worker.

---

## 0.5 Challenge rules and acceptance checklist (NON-NEGOTIABLE, read first)

These come from the official Superteam Poland brief. Every design choice in this spec must respect them. If a feature conflicts with a rule below, drop the feature.

### Hard rules
1. **Runs on Solana devnet.** No mainnet, no real funds. Test SOL from a public faucet.
2. **The logic that replaces the intermediary lives in the on-chain program.** The backend (if any) must never enforce terms. If a server decides who gets paid, how much, or when, the intermediary has not disappeared; it has become us.
   - Allowed off-chain: UI, indexing/reading events, sending invite links, generating ZK proofs on the client, an optional keeper that calls the permissionless `settle`, and a demo faucet for test tokens.
   - Forbidden off-chain: computing `available`, approving withdrawals, deciding payouts, holding funds, holding any admin key.
3. **Working application, not a mockup.** It must launch and be clickable end to end, and it must work **live** during the presentation. A recording is a backup only.
4. **"Rough but working" beats "polished but empty".** Build order (§12) puts all on-chain logic and a minimal working UI first. Design polish comes only after M2 is fully working.
5. **Target user named explicitly** (§1). This drives the interface language: non-crypto vocabulary for employees and employers (§3.3), technical details only in the "Under the hood" drawer.
6. **Short design rationale** in the README: which financial relationship was redesigned, who the intermediary was, and what changes once they are removed (§11).

### Stack notes from the brief
- On-chain: Anchor (chosen; easiest). Native Rust, Pinocchio or Steel are also allowed.
- Frontend: any framework. Use `@solana/kit` or `@solana/web3.js`, and **Wallet Adapter** for wallets.
- Reuse ecosystem building blocks: SPL Token / Token-2022 and existing SDKs. Don't reinvent them.
  - Note: the brief mentions the Switchboard oracle, but **Switchboard shut down in September 2026**. Use Pyth if a price is ever needed (not needed for Dniówka).
- Environment: the organizers provide a ready-made dev container (VS Code / GitHub Codespaces) at `github.com/matzayonc/solana-live-course-2026`. Solana Playground is a fallback for compiling and deploying from the browser. Make the repo work inside that dev container.

### Definition of done (the app is "complete" only when ALL are true)
- [ ] At least **one full use case from user input to a confirmed on-chain transaction**: the employee opens the app, **connects a wallet**, withdraws earned salary, and sees the result plus the Explorer link.
- [ ] The **moment the intermediary disappears** is visible in the UI: the program pays the employee directly with no lender and no approval (`withdraw_earned`), and payday executes itself (`settle`, triggered by any wallet).
- [ ] Rule enforcement is visible: an over-withdrawal is refused **on-chain** (failed tx shown in Explorer), not just blocked by the UI. **Important:** for the demo, the UI must be able to actually send the over-limit transaction (e.g. a "try anyway" button or skipping preflight) so the judges see the program itself refuse it.
- [ ] **Two or more parties** with separate wallets: employer (laptop) and employee (phone), plus the landlord view for ZK.
- [ ] Every action shows a **Solana Explorer / Solscan link** to the confirmed transaction.
- [ ] Works live on devnet from a fresh browser session. A backup recording exists.
- [ ] README with design rationale, target user, where each rule lives in code, permissions, failure scenarios, why blockchain, program ID and how to run (§11).

### How judging works (shape the demo and README around this)
- **Live demo:** show at least one full scenario from start to finish. The user arrives, **connects a wallet**, performs an operation and sees the result, ending on a **confirmed transaction on the network**. Keep Solana Explorer or Solscan open in a tab.
- **Prepare in advance:** wallets funded with test SOL (employer, employee and a third "anyone" wallet for `settle`), streams pre-created in the right states (§9), employer funded with test zł. A faucet outage or no internet won't disqualify, but it makes the conversation much harder, so have the recording ready.
- **Questions the judges WILL ask** (answers in §10; put them in the README):
  1. Where exactly in the code does the intermediary disappear? Which part of the program enforces the terms that neither party can circumvent?
  2. What happens if one party disappears halfway? Where are the funds, and who can recover them?
  3. Who has permission to do what? Can you, as the author, change anything after deployment?
  4. Why blockchain and not a regular database?
  5. What would you do with another week?
- **Not evaluated:** attack resistance, audits, design quality or test coverage. If something breaks live, say plainly what and why. Awareness of limitations scores higher than pretending they don't exist, so keep the "Limitations" section honest.
- **The judges read the repo** before and after the presentation. They check that the on-chain program does what the demo shows. The README must say clearly what is where.

### Evaluation weights (prioritize accordingly)
| Criterion | Weight | What it means for us |
|---|---|---|
| Relevance to the challenge | 30% | Rules in the program, the intermediary visibly gone, design rationale |
| Completeness and functionality | 25% | Full live flow with confirmed transactions; M1–M3 rock solid before any extras |
| Idea and choice of problem | 20% | Chwilówki and early wage access, a named target user, real-world constraints handled (§2) |
| Implementation potential | 15% | Legal awareness (art. 84), path to a PLN stablecoin, employer incentive |
| Originality | 10% | Coupon-strip UX, ZK income proof for landlords |

### Wallet note
The brief's demo flow says "connects a wallet". P1 therefore uses **Wallet Adapter** (Phantom/Solflare on devnet) and must work end to end with it. Kora (P2, fees paid by the app) is an *addition* on top of this, never a replacement that could break the core demo. No passkeys / Face ID: out of scope.

---

## 1. The problem (use in README and pitch)

- A worker earns monthly but life costs daily. Mid-month emergencies (car, dentist, rent deposit) push people to **chwilówki**: fast loans with very high costs. BIK reports strong growth in payday-loan value, and non-bank lending to foreigners in Poland grew +111% y/y in 2025 (rp.pl summary of BIK data).
- On the 12th, a worker has *already earned* ~40% of their salary. They just can't access it until payday.
- Existing "earned wage access" apps (e.g. Payflow) solve this as **intermediaries**: they front the money and charge fees, and the employer's promise still has to be trusted.
- If the employer goes bankrupt or just pays late, the worker waits. Poland has a state guarantee fund (FGŚP), but it is slow.

**Target users (state these explicitly in the README and UI):**
1. **Primary:** hourly or monthly workers in small Polish businesses (bakeries, shops, workshops, restaurants), including the many foreign workers in Poland. They are **not crypto users**, so the UI must hide all crypto vocabulary.
2. **Secondary:** small-business owners who want an attractive, free employee benefit.
3. **Tertiary:** landlords who need proof of income.

---

## 2. Reality checks: design decisions forced by real-world constraints

These are deliberate and should appear in the README's "Design rationale" and "Limitations".

| Real-world constraint | Consequence for the design |
|---|---|
| **Polish Labour Code art. 84**: an employee cannot waive or **transfer the right to wages to another person** | **No selling of salary to investors for employees.** Early access is a **direct withdrawal of already-earned wages from the vault**, legally an *advance on wages* (zaliczka na poczet wynagrodzenia), not a loan and not an assignment. Free for the worker. |
| Many Polish employers pay month M's salary **up to the 10th of month M+1** (art. 85) | Payday is configurable: period end + 0–10 days. |
| Employers want to keep their cash | Vault funds can sit in a yield-bearing position (simulated on devnet), so locking costs the employer ~nothing. Employers can also **fund weekly** instead of all upfront (see `funded` below). Honest UI shows *funded* vs *earned*. |
| Sick leave, unpaid absence and corrections change the final net pay | Only a **guaranteed floor** (e.g. 70% of earned) is withdrawable and untouchable. The employer may lower the final payout **only down to that floor**, with a public reason code. Below the floor requires the employee's signature. |
| Taxes (PIT, ZUS) are withheld by the employer | The vault holds **net pay only**. Taxes stay in normal payroll, off-chain. |
| Wages legally must be paid in money, normally to a bank account (art. 86) | On devnet we use a **test "zł" token**. Production would need a regulated PLN e-money/stablecoin partner plus a bank off-ramp. State this as a limitation. |
| Employer could fire someone and **backdate** the end date to claw back earned pay | **Impossible**: `end_employment` only accepts `end_ts ≥ now`. Earned is earned. |
| Employer goes bankrupt or disappears | Funded money stays in the vault and is paid on payday regardless. This beats the real-world FGŚP delay. |
| On-chain amounts are public | The ZK proof hides *which* vault is yours (membership in a set of vaults) plus a range check, so the landlord learns only "≥ threshold". The anonymity set is all active vaults; say honestly that privacy grows with adoption. |
| Contractors (umowa zlecenie / B2B) are **not** covered by art. 84; receivables can be assigned (Civil Code art. 509) | **Optional P3 extension:** contractors can sell their earned portion to an investor. Out of core scope. |

---

## 3. Product: roles, objects, vocabulary

### 3.1 Roles
- **Employer:** creates the company, adds employees, funds the vault, ends employment, proposes payday adjustments.
- **Employee:** accepts the invite, watches earnings fill up, withdraws earned money, generates income proofs.
- **Anyone (keeper):** can trigger `settle` after payday. The employee's app does it automatically; a backend cron may too. No privilege.
- **Verifier (landlord):** opens a proof link or QR and sees verified or not. No wallet required.

### 3.2 Objects
- **Company (Employer account):** authority, display name (off-chain), default settings.
- **Pay period / Stream:** one employee × one pay period: net amount, start, end, payday, floor %, funded, withdrawn, status.
- **Vault:** the token account that holds a stream's funds, owned by a program PDA. **One vault per stream**, so funds can never be shuffled between employees.
- **Income proof:** an on-chain attestation created after a ZK proof verifies.

### 3.3 UI vocabulary (non-negotiable)
Never show: wallet, token, mint, PDA, SOL, lamports, transaction, signature, hash, Solana, blockchain (except in an "Under the hood" drawer).

| Under the hood | User sees |
|---|---|
| Stream / vault | "This month's salary" / "the vault" (*sejf*) |
| funded | "Secured by employer" |
| earned | "Earned so far" |
| floor | "Available now" |
| withdraw | "Take money now" |
| settle | "Payday" (*wypłata*) |
| failed tx | Red stamp **ODMOWA** with a human reason |
| tx link | Small "proof ↗" link (Explorer), for the jury |

Amounts are always **zł with 2 decimals, Polish formatting**: `2 400,00 zł`.

---

## 4. The math (implement exactly; integer only)

Units: the test token has **2 decimals** (grosze). All arithmetic in `u64`/`u128`, **floor rounding**.

```
now           = Clock::unix_timestamp
t_end         = min(now, end_ts_or_period_end)
elapsed       = clamp(t_end - period_start, 0, period_end - period_start)
duration      = period_end - period_start

earned        = net_amount * elapsed / duration                    // u128 intermediate
floor_earned  = earned * floor_bps / 10_000                        // e.g. floor_bps = 7000
available     = saturating_sub( min(floor_earned, funded), withdrawn )
```

Example (net 6 000 zł, 30-day period, floor 70%, fully funded):
- Day 12 → earned 2 400 zł → floor 1 680 zł → withdrawn 0 → **available 1 680 zł**.
- Oksana takes 800 zł → withdrawn 800 → available 880 zł.
- She tries 5 000 zł → **refused** (`ExceedsAvailable`).
- Payday (day 30, no adjustment) → employee receives `earned_final − withdrawn = 6 000 − 800 = 5 200 zł`.

**Demo clock:** each stream has its own `period_start` / `period_end`, so the demo uses a short period (e.g. 30 minutes = "30 days", 1 minute = 1 day). The UI labels days as `duration / 30` slices. No special demo code path is needed in the program, which is honest and testable.

---

## 5. On-chain program (Anchor) — source of truth

Program name: `dniowka`. Deploy to **devnet**. After the final deploy: **verified build** (solana-verify) and then **remove upgrade authority** (`--final`). This is the answer to "can you change anything after deployment?"

### 5.1 Accounts

```rust
#[account]
pub struct Employer {
    pub authority: Pubkey,        // employer signer
    pub mint: Pubkey,             // test zł mint
    pub default_floor_bps: u16,   // e.g. 7000
    pub stream_count: u64,        // for PDA seeds
    pub bump: u8,
}
// seeds: ["employer", authority]

#[account]
pub struct Stream {
    pub employer: Pubkey,         // Employer PDA
    pub employee: Pubkey,         // employee signer (set on accept)
    pub mint: Pubkey,
    pub vault: Pubkey,            // token account PDA
    pub id: u64,
    pub net_amount: u64,          // net salary for the period
    pub period_start: i64,
    pub period_end: i64,
    pub payday: i64,              // >= period_end, <= period_end + 10 days (demo: allow == period_end)
    pub floor_bps: u16,           // guaranteed share of earned (1..=10000)
    pub funded: u64,              // total deposited (<= net_amount)
    pub withdrawn: u64,           // total advanced to employee
    pub end_ts: Option<i64>,      // employment ended (>= time of call)
    pub adjustment: u64,          // proposed reduction of final pay (grosze)
    pub adjustment_reason: u8,    // 0 none, 1 sick leave, 2 unpaid absence, 3 correction, 4 other
    pub adjustment_accepted: bool,// employee consent (needed only below floor)
    pub status: StreamStatus,     // Invited | Active | Settled | Cancelled
    pub income_commitment: [u8; 32], // ZK leaf commitment set by employee on accept (zeros if unused)
    pub bump: u8,
    pub vault_bump: u8,
}
// seeds: ["stream", employer, id_le_bytes]
// vault seeds: ["vault", stream]; token authority = stream PDA

#[account]
pub struct IncomeRegistry {       // optional, for ZK (§7)
    pub root: [u8; 32],
    pub next_index: u32,
    pub filled_subtrees: [[u8; 32]; DEPTH], // incremental Merkle tree, Poseidon
    pub recent_roots: [[u8; 32]; 8],
    pub bump: u8,
}
// seeds: ["registry"]

#[account]
pub struct IncomeAttestation {
    pub nonce: [u8; 32],          // landlord challenge
    pub threshold: u64,           // grosze per month
    pub min_months: u8,
    pub root_used: [u8; 32],
    pub verified_at: i64,
    pub expires_at: i64,          // e.g. +7 days
    pub bump: u8,
}
// seeds: ["attest", nonce]
```

### 5.2 Instructions

| # | Instruction | Signer | Rules (all enforced on-chain) |
|---|---|---|---|
| 1 | `init_employer(default_floor_bps)` | employer | creates Employer PDA |
| 2 | `create_stream(employee_hint, net_amount, period_start, period_end, payday, floor_bps)` | employer | `period_end > period_start`; `payday >= period_end` and `payday <= period_end + 10 days`; `1 <= floor_bps <= 10000`; `net_amount > 0`; status = `Invited`; creates vault |
| 3 | `accept_stream(income_commitment)` | employee | only if `Invited`; binds `employee = signer`; status = `Active`; optionally inserts the commitment leaf into `IncomeRegistry` |
| 4 | `fund_stream(amount)` | employer | `funded + amount <= net_amount`; transfer employer → vault; allowed while `Invited` or `Active` and `now < payday` |
| 5 | `withdraw_earned(amount)` | employee | status `Active`; `amount > 0`; `amount <= available(now)` (§4); transfer vault → employee; `withdrawn += amount` |
| 6 | `end_employment(end_ts)` | employer | status `Active`; `end_ts >= now` (**no backdating**); `end_ts <= period_end`; can only be set once, or moved **later**, never earlier |
| 7 | `propose_adjustment(amount, reason)` | employer | `now < payday`; `reason != 0`; resulting final pay may go **below floor only if** the employee later calls `accept_adjustment`; never below `withdrawn` |
| 8 | `accept_adjustment()` | employee | sets `adjustment_accepted = true` |
| 9 | `settle()` | **anyone** | `now >= payday`; status `Active`; computes final split (below); transfers; status `Settled`; emits event |
| 10 | `cancel_unaccepted()` | employer | only if `Invited` and `now >= period_start + grace`; refunds `funded` to employer |
| 11 | `verify_income_proof(proof, public_inputs)` | anyone | see §7; creates IncomeAttestation |

**`settle` split (exact):**
```
earned_final = earned(at min(end_ts, period_end))
floor_final  = earned_final * floor_bps / 10_000
max_cut      = adjustment_accepted ? (earned_final - withdrawn) : (earned_final - max(floor_final, withdrawn))
cut          = min(adjustment, max_cut)
owed         = earned_final - cut                         // what the employee is owed in total
pay_employee = min(owed, funded) - withdrawn               // saturating
refund_emp   = funded - withdrawn - pay_employee           // unearned or unfunded remainder back to employer
shortfall    = owed - min(owed, funded)                    // > 0 means the employer under-funded: emit WageShortfall event (public record)
```

**Errors (human-readable in the UI):**
- `ExceedsAvailable` → "You've earned X so far; up to Y is available now."
- `PaymentLocked` / `NotEmployer` → "This salary is secured. Nobody can take it back."
- `BackdatingNotAllowed` → "End date can't be in the past."
- `TooEarlyForPayday` → "Payday is on {date}."
- `Overfunded`, `InvalidPeriod`, `InvalidFloor`, `AlreadySettled`, `NotEmployee`, `ZeroAmount`, `ProofInvalid`, `UnknownRoot`.

**Events:** `StreamCreated`, `StreamAccepted`, `Funded`, `Withdrawn`, `EmploymentEnded`, `AdjustmentProposed`, `AdjustmentAccepted`, `Settled{pay_employee, refund_emp, shortfall}`, `WageShortfall`, `IncomeProofVerified`. The frontend timeline and the big screen read these.

### 5.3 Permissions summary (for the jury question "who can do what?")
- The **employer** can create, fund, end (future-only) and propose an adjustment (floor-limited). The employer **cannot** withdraw from a vault, backdate, cut below the floor without consent, or stop payday.
- The **employee** can withdraw up to available, accept an adjustment, and prove income. The employee **cannot** take more than earned × floor, or more than funded.
- **Anyone** can trigger payday after `payday`.
- **We (the authors)** have no admin key. The program is not upgradeable after the final deploy, and there is no fee switch or pause.

### 5.4 Program tests (must exist, `anchor test`)
1. Happy path: create → accept → fund → withdraw (day 12) → settle; balances match §4.
2. Withdraw more than available → `ExceedsAvailable`.
3. Withdraw when underfunded → limited by `funded`.
4. `end_employment` with a past timestamp → `BackdatingNotAllowed`.
5. End mid-period → settle pays earned to that date, refunds the rest to the employer.
6. Adjustment above the floor without consent → capped at the floor; with consent → full adjustment applied.
7. `settle` before payday fails; after payday succeeds **from a random third-party wallet**.
8. Employer tries to withdraw from the vault → fails (no such path; assert the token authority is the PDA).
9. Double settle → `AlreadySettled`.
10. Rounding: odd amounts never overpay (sum of payouts ≤ funded).

---

## 6. Frontend — UX and original layout

### 6.1 Stack
- React + Vite (or Next.js), TypeScript, `@solana/kit` (or web3.js) and the generated Anchor client.
- **P1 wallet:** Solana Wallet Adapter (Phantom/Solflare) on devnet.
- **P2:** **Kora** as fee payer, so employees and employers never need to hold SOL (fees are sponsored by the app). No passkeys / Face ID.
- Fonts: **Bricolage Grotesque** (display, 800) + **DM Mono** (body and numbers). No Inter, Roboto or Arial.
- i18n: English default, **Polish toggle** (P2). Keep all copy in a `copy.ts`.

### 6.2 Visual concept: "the month as a strip of day-coupons"
The whole identity comes from Polish paper finance: **payslips, tram-ticket booklets, rubber stamps**. It must not look like a generic dashboard.

- **Palette:**
  - Ink cobalt `#1B2CC1` (ground)
  - Paper `#FBFBF7`
  - Ink `#111111`
  - Highlighter yellow `#FFE45C` (earned, AI or auto-filled)
  - Stamp red `#C8102E` (refusals)
  - Mint `#7CF2B0` (money arriving)
- **The salary is a vertical strip of 30 perforated coupons**, one per day, like a ticket booklet.
  - Future days: outlined, greyed.
  - Earned days: filled yellow, showing the zł value (e.g. 200,00).
  - Days already taken: torn off (a missing coupon with a jagged edge) and moved to a small pile at the bottom labelled "taken".
  - The current day animates filling from left to right in real time (demo clock).
- **Taking money = tearing coupons.** The user drags a handle down the strip (or uses the stepper) to select how many earned coupons to tear off. The amount updates live. Release then confirm.
- **Refusal = a red rubber stamp** "ODMOWA" slammed over the strip, rotated about −12°, with the human reason underneath and a small "proof ↗" link.
- **Payday = the remaining strip gets a big stamp "WYPŁACONO"** and the coupons fly into the wallet total.
- **Receipts everywhere:** paper cards with a zigzag torn bottom edge (SVG pattern), dotted leaders between label and value, monospace numbers.
- **Layout breaks the usual card grid:** oversized numbers cropped by the screen edge, slightly rotated sticky notes for key facts, a left-aligned strip with content flowing to its right on desktop.

Reference mockups (Termin version, same visual language): see the existing design canvas the team has. Reuse its receipt, stamp and ticket components.

### 6.3 Screens

**Employee (mobile-first, 390 px)**

1. **Invite / onboarding** (opened from a link sent by the employer, via WhatsApp or SMS):
   - "Piekarnia Nowak secured your October salary: 6 000 zł."
   - One button: "Connect and join".
   - On join, `accept_stream` runs, with the commitment generated locally.
2. **Home: the strip**
   - Top: "Earned so far **2 400,00 zł**", the "Available now" pill, and a payday countdown.
   - Middle: the coupon strip.
   - Sticky note: "Secured by employer: 6 000 / 6 000 zł" (shows less if underfunded, with an honest note).
   - Primary button: **"Take money now"**.
3. **Take money:** tear interaction, then a summary receipt ("You get 800,00 zł · fee 0,00 zł · left this month 5 200,00 zł"), then a hold-to-confirm button. Success: mint-green "+800,00 zł", the coupon tears off, and a "proof ↗" link.
4. **Refused state:** the ODMOWA stamp over the strip ("You've earned 2 400 zł; 880 zł is available now").
5. **Payday:** the WYPŁACONO stamp, the final receipt (earned, taken, adjustments with reason, paid now) and a "proof ↗" link.
6. **Prove my income:** choose the threshold (a slider, e.g. 3× rent) and the minimum months. The proof generates and a QR plus share link appear. Copy: "Your landlord will see only: verified, at least X zł / month. Not your salary, not your employer."
7. **History:** one receipt per month.

**Employer (desktop, PAGE layout, fluid)**

1. **Payroll board:** one row per employee, each with a mini horizontal coupon strip showing funded, earned and taken. Totals sit at the top as oversized numbers: "Secured 18 000 zł · Earned 7 200 zł · Taken 1 300 zł".
2. **Add employee:** name (off-chain label), net monthly salary, floor % (default 70) and payday rule (end of month / +N days). This produces an invite link and QR.
3. **Fund:** "Secure October payroll", either full or weekly top-ups. Show "Your money keeps earning ~X zł" (simulated; see §8).
4. **End employment:** a date picker that cannot select past dates (and the program enforces it too). It explains what happens: "Earned until then is paid on payday; the rest returns to you."
5. **Payday adjustments:** reason dropdown and amount. The UI shows the floor limit: "You can reduce by at most N zł without the employee's consent."

**Landlord (verifier, no wallet)**
- Opened via QR or link: a big **"VERIFIED ✓"** stamp, "Income ≥ 4 500 zł / month for ≥ 3 months", issued date, expiry, and "proof ↗".
- If the proof is invalid or expired: an ODMOWA stamp.

**Big screen (demo, 1280×720)**
- Left: the vault total in oversized digits and a flip-clock countdown to payday.
- Right: a receipt "printing" live events from program logs.
- Bottom: integration labels (Token-2022, Kora, ZK/Noir, verified build, devnet).
- Includes a QR code so a judge can open the landlord view of a live proof.

### 6.4 UX rules
- One primary action per screen. Touch targets ≥ 44 px. Text contrast ≥ 4.5:1.
- Every state change shows the human result first and the proof link second.
- Optimistic UI is allowed, but always reconcile with the on-chain state, and show a "confirming…" stamp while pending.
- Errors map to human sentences (§5.2). Never show raw error codes, except in the "Under the hood" drawer.
- **"Under the hood" drawer** on every screen (for the jury): the instruction name, the accounts involved, the rule that was checked, and the Explorer link.
- Polish number formatting (`2 400,00 zł`) and dates as `02.12.2026`.

---

## 7. Zero-knowledge income proof (P3, the riskiest part, built last)

**Goal:** the landlord learns only "the owner of *some* active Dniówka salary has net ≥ T per month for ≥ N months". The landlord does not learn which vault, which employer, the exact salary, or the wallet.

**Leaf:** `leaf = Poseidon(secret, net_amount, employer, period_start, status_flag)`, where `secret` is known only to the employee's device.
- At `accept_stream`, the program stores `income_commitment = leaf` and inserts it into the `IncomeRegistry` incremental Merkle tree (Poseidon via the `sol_poseidon` syscall).
- At `settle`, a new leaf can be appended for history.
- Simplify for the hackathon if needed: one leaf per accepted stream; "N months" means the number of distinct leaves with the same `secret`, or drop `min_months` entirely.

**Circuit (Noir → Sunspot → Groth16 → on-chain verifier):**
- Private inputs: `secret`, `net_amount`, `employer`, `period_start`, `status_flag`, Merkle path.
- Public inputs: `root`, `threshold`, `nonce` (landlord challenge), `nullifier = Poseidon(secret, nonce)`.
- Constraints:
  - the leaf recomputes correctly and the Merkle path matches `root`
  - `net_amount >= threshold`
  - `status_flag == active`
  - the nullifier is correct

**On-chain:**
- `verify_income_proof` checks that `root` is in `recent_roots`.
- It CPIs into the Sunspot-generated verifier program (budget about 200k–500k CU; set the compute limit explicitly).
- It creates an `IncomeAttestation` at seeds `["attest", nonce]`.

**Landlord flow:** the landlord page generates a random `nonce` and shows it as a QR. The employee scans it, proves, and submits. The landlord page polls for an attestation with that nonce.

**Fallback if ZK slips:** ship the same flow with an attestation created by the employee's own signature over public stream data (clearly labelled "non-private mode"). Keep the circuit in the repo with passing `nargo test`.

**Honest limits (README):**
- Privacy depends on how many vaults exist (the anonymity set).
- Sunspot's trusted setup is dev-only.
- The proof shows the salary is secured in a vault, not that the job will last.

---

## 8. Integrations (and how each one appears in the demo)

| Integration | Role | Priority |
|---|---|---|
| Anchor program (devnet) | All rules from §5 | P1 |
| SPL Token / **Token-2022** test "zł" mint, 2 decimals | Salary money | P1 |
| Solana Explorer links | "proof ↗" on every action | P1 |
| **Verified build + immutable program** | Shown at the end of the demo | P1 |
| **Kora** fee payer | Users never need SOL | P2 |
| **Solana Actions / Blink** invite link | Employee joins from a WhatsApp link | P2 |
| **Simulated yield** | Employer sees "your money keeps earning ~X zł". P2a: computed in the UI and clearly labelled "simulated". P2b: a tiny `mock_yield` program where the vault holds yield shares and the interest goes back to the employer on settle | P2 |
| **Noir + Sunspot ZK** | Income proof | P3 |
| Contractor marketplace (sell earned portion; Civil Code art. 509) | Optional extension, shows awareness of art. 84 | P3 / stretch |

---

## 9. Demo script (3–4 min, live, devnet)

Seed data: employer **Piekarnia Nowak** (a bakery). Employees **Oksana** (baker) and **Marek**. Landlord **Pan Zieliński**. The demo period is 30 minutes, so 1 minute = 1 "day", with 6 000 zł net.

1. **Employer (laptop):** "Secure October payroll". The vault shows 6 000 zł, plus a proof link.
2. **Oksana (phone):** opens the WhatsApp invite and joins. Coupons start filling live.
3. Jump to "day 12" (pre-created stream that started 12 min earlier): earned 2 400 zł. She **takes 800 zł** and a coupon tears off, with a proof link.
4. She tries **5 000 zł**: the **ODMOWA** stamp appears. *"Impossible to borrow money you haven't earned. No debt spiral."*
5. **Employer** tries to end her job **yesterday**: ODMOWA, "End date can't be in the past."
6. **Landlord:** a judge scans the QR. Oksana proves income ≥ 4 500 zł. **VERIFIED ✓**, and her salary and employer stay hidden.
7. **Payday** (the pre-created stream reaches payday): the big screen countdown hits zero. A random wallet, or a judge, triggers payday. The **WYPŁACONO** stamp appears and 5 200 zł arrives.
8. **Close:** Solscan shows the program as verified and not upgradeable. *"No lender, no app, no promise. Just a rule nobody can change, not even us."*

**Demo prep:** pre-funded wallets for each role, pre-created streams at different phases (a fresh one, one at day 12, one about to hit payday), a "reset demo" script, a recorded backup video, and a tested RPC on the venue Wi-Fi plus a phone hotspot.

---

## 10. Jury Q&A (put in README)

- **Where does the intermediary disappear?** In `withdraw_earned` (the program computes what's yours and pays it, with no lender) and in `settle` (payday executes itself, triggerable by anyone).
- **What if a party disappears?**
  - The employer disappears: funded wages still pay on payday.
  - The employee disappears: anyone can settle; the funds go to the employee's address and the unearned part returns to the employer.
  - Nobody calls settle: the employee's app does it, any third party can too, and the funds stay safe in the vault meanwhile.
- **Who can do what? Can you change it?** See §5.3. No admin key, verified build, upgrades disabled.
- **Why blockchain and not a database?**
  - A database owner (employer, app or lender) can freeze, delay or reverse.
  - Here the employer cannot take earned wages back, and the app can't block withdrawals.
  - It keeps working if the company or Dniówka shuts down.
  - Shortfalls are a public record.
- **Why would an employer lock salaries early?** It's a free benefit that attracts and keeps workers. The money keeps earning (yield). Weekly funding is possible. It costs nothing compared to paying on the 10th.
- **Isn't this a loan?** No. It's an advance of wages already earned, from money already locked. No interest, no credit check, no debt. The employee cannot transfer their wages (art. 84), so there is no third-party buyer.
- **Next week:**
  - a regulated PLN stablecoin and bank off-ramp
  - real yield source (lending or tokenized treasuries)
  - payroll software and KSeF/ZUS integration
  - contractor marketplace
  - a bigger anonymity set for ZK

---

## 11. Repo structure & README requirements

```
/programs/dniowka        Anchor program (§5) + tests
/circuits/income         Noir circuit (§7) + nargo tests
/app                     Frontend (§6)
/scripts                 seed-demo.ts, reset-demo.ts, verify-build.sh
/docs                    design-rationale.md, architecture diagram, screenshots
README.md
```

The README must contain:
1. What it is, in one paragraph, and the explicitly named **target users**.
2. **Design rationale** (the brief requires it): which financial relationship was redesigned (wage payment and early access), who the intermediary was (payday lenders, EWA apps, blind trust in the employer), and what changes once they are removed.
3. Where each rule lives in the code: file and line for `withdraw_earned`, `settle`, `end_employment`, and the floor logic.
4. A permissions table, failure scenarios, and why blockchain.
5. Program ID, Explorer links, verified-build proof, and how to run locally plus the demo.
6. **Limitations, stated honestly** (§2, §7).

---

## 12. Build order (milestones)

1. **M1 Core program:** accounts and instructions 1–6 and 9, with tests 1–5, 7, 8 and 9. Deploy to devnet.
2. **M2 Minimal UI:** employer funds, employee sees the strip, withdraws and gets refused; payday works; Explorer links everywhere. *At this point the project is already a complete, demo-able submission.*
3. **M3 Adjustments and end-of-employment** UI, plus tests 6 and 10. Big screen.
4. **M4 Polish:** coupon-strip animations, stamps, receipts, Polish copy toggle, seed and reset scripts.
5. **M5 P2 integrations:** Kora, Blink invite, simulated yield.
6. **M6 ZK** (§7), with the fallback ready.
7. **M7 Freeze:** verified build, remove upgrade authority, README, backup video.

---

## 13. Sources (for README / pitch)

- Labour Code art. 84 (no waiver or transfer of wages): https://arslege.pl/niedopuszczalnosc-zrzeczenia-sie-lub-przeniesienia-na-inna-osobe-prawa-do-wynagrodzenia/k10/a1266/
- Wage payment deadline (up to the 10th of the next month): https://www.sdworx.pl/pl-pl/blog/place/termin-wyplaty-wynagrodzenia
- Advance on wages (zaliczka): https://poradnikprzedsiebiorcy.pl/-zaliczka-na-poczet-wynagrodzenia-jak-ja-rozliczyc
- BIK payday-loan data (Bankier): https://www.bankier.pl/wiadomosc/Polacy-wzieli-30-proc-wiecej-chwilowek-niz-rok-wczesniej-Nowe-dane-BIK-8910964.html
- BIK 2025 summary, non-bank loans to foreigners +111% (rp.pl): https://www.rp.pl/banki/art43785761-polacy-ruszyli-po-kredyty-i-pozyczki-bik-podsumowuje-rekordowy-rok-na-rynku
- Payflow (an earned-wage-access intermediary): https://www.eu-startups.com/2025/06/madrid-based-payflow-raises-e10-million-to-expand-their-earned-wage-access-platform-across-europe-and-lam/
- ILO study on earned wage access: https://www.ilo.org/sites/default/files/2025-04/Earned%20wage%20access.pdf
- Noir on Solana (Sunspot): https://github.com/solana-foundation/noir-examples
- Kora: https://solana.com/docs/tools/kora/getting-started
- Verified builds: https://solana.com/docs/programs/verified-builds
