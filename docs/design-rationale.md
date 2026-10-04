# Design rationale

## The problem

A worker earns monthly but life costs daily. A mid-month emergency (car, dentist, a rent deposit) pushes
people towards *chwilówki*, fast loans with very high costs. BIK reports strong growth in payday-loan
value, and non-bank lending to foreigners in Poland grew +111 % year on year in 2025. On the 12th of the
month a worker has already earned about 40 % of their salary; they just can't reach it until payday.

Earned-wage-access apps (Payflow and others) fix this as **intermediaries**: they front the money, charge
a fee, and still depend on the employer paying them back. And if the employer pays late or goes
bankrupt, the worker waits; the state guarantee fund (FGŚP) is slow.

## The relationship we redesigned

Wage payment, and early access to wages already earned. Three intermediaries disappear:

| Before | After |
|---|---|
| A payday lender lends against wages already earned | The worker withdraws their own earned wages from a vault (`withdraw_earned`) |
| An EWA app fronts the money and charges a fee | The program computes what is earned at the cluster clock; no fee, no approval |
| "I'll pay you on the 10th": trust in the employer | The salary is locked before the work is done; payday runs itself (`settle`, callable by anyone) |

## Constraints that shaped the design

| Real-world constraint | Consequence |
|---|---|
| **Labour Code art. 84:** wages can't be waived or transferred to someone else | No market where investors buy a worker's salary. Early access is an *advance on wages* (*zaliczka*), paid from the worker's own vault. Free. |
| **Art. 85:** wages may be paid up to the 10th of the next month | Payday is configurable: period end + 0 to 10 days. |
| Sick leave, unpaid absence and corrections change the final net pay | Only a **guaranteed floor** (70 % of earned by default) is withdrawable. The employer may lower the final pay down to that floor with a public reason code; below it needs the employee's signature. |
| Taxes (PIT, ZUS) are withheld by the employer | The vault holds net pay only; taxes stay in normal payroll. |
| **Art. 86:** wages are paid in money, normally to a bank account | Devnet uses a test "zł" token. Production needs a regulated PLN e-money or stablecoin partner and a bank off-ramp. |
| An employer could fire someone and backdate it to claw back pay | `end_employment` refuses any end date in the past. Earned is earned. |
| The employer goes bankrupt or disappears | Funded money stays in the vault and is paid on payday regardless. |
| Employers want to keep their cash | They can fund in several steps (`fund_stream` can be called repeatedly); the UI shows *secured* vs *earned*. (Yield on locked funds: not built.) |
| Contractors (umowa zlecenie / B2B) are not covered by art. 84 | They could sell receivables (Civil Code art. 509). Out of scope. |

## Protections beyond the brief

Each one closes a way around "the employer cannot take back earned wages or stop payday":

1. **Only a clean Token-2022 mint** is accepted: no freeze authority and no extensions. A freeze authority
   could freeze the vault; a permanent delegate could move its funds; a transfer fee or hook could block
   payouts.
2. **`settle` logs a memo before each payout and skips zero amounts**, so an account that requires memos
   or rejects transfers can't block payday.
3. **A separate rent payer** on the instructions that may create accounts, so whoever triggers payday can
   pay the fees and rent without holding any power.
4. **An employer can't be their own employee.**
5. **Anyone but the employee** calling `withdraw_earned` gets `PaymentLocked`.
6. **`accept_adjustment(amount)`**: the employee consents to the exact amount they reviewed; if the
   employer swapped the proposal in between, it fails with `AdjustmentChanged`.
7. **One vault per salary**, owned by the salary's program address: funds can never be shuffled between
   employees.

## What the interface does and does not do

The app never computes what is available. It simulates `withdraw_earned` and reads the program's own log
line (`earned X available Y`), so the number on screen is the program's number. "Now" is the cluster
clock, not the phone's. The "Try anyway" button signs and sends a transaction without preflight so the
judges see the **program** refuse it, with a failed transaction on Explorer.

The interface speaks to non-crypto users: no wallet, token, transaction or blockchain on screen (except in
an "Under the hood" drawer), amounts as `2 400,00 zł`, English and Polish. The month is a booklet of 30
day-coupons that fill as the worker earns and tear off when they take money.
