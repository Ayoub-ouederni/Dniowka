/**
 * Every user-facing string (EN). No crypto vocabulary outside `hood` (spec §3.3):
 * never wallet, token, mint, PDA, SOL, lamports, transaction, signature, hash, Solana, blockchain.
 */
import { formatDateTime, formatZl } from "./format";

export type ErrorContext = {
  earned?: bigint;
  available?: bigint;
  payday?: number;
  cancelFrom?: number;
};

/** Adjustment reason codes as the program stores them (1..=4). */
const reasons: Record<number, string> = {
  1: "sick leave",
  2: "unpaid absence",
  3: "correction",
  4: "other",
};
const reasonOf = (code: number) => reasons[code] ?? "other";

const programErrors: Record<string, (c: ErrorContext) => string> = {
  ExceedsAvailable: ({ earned, available }) =>
    earned !== undefined && available !== undefined
      ? `You've earned ${formatZl(earned)} so far; up to ${formatZl(available)} is available now.`
      : "That's more than is available now.",
  PaymentLocked: () => "This salary is secured. Nobody can take it back.",
  NotEmployer: () => "This salary is secured. Nobody can take it back.",
  BackdatingNotAllowed: () => "End date can't be in the past.",
  TooEarlyForPayday: ({ payday }) =>
    payday ? `Payday is on ${formatDateTime(payday)}.` : "Payday hasn't come yet.",
  Overfunded: () => "That's more than this salary still needs.",
  InvalidPeriod: () => "The month must end after it starts.",
  InvalidFloor: () => "The early-access share must be between 0,01 % and 100 %.",
  AlreadySettled: () => "This salary has already been paid out.",
  NotEmployee: () => "This invite is for someone else.",
  ZeroAmount: () => "Enter an amount above zero.",
  InvalidPayday: () => "Payday must fall between the end of the month and 10 days after it.",
  NotInvited: () => "This invite has already been accepted.",
  NotActive: () => "This salary isn't running.",
  InvalidEndDate: () => "End date can't be after the end of the month.",
  EndDateCannotMoveEarlier: () => "The end date can only be moved later.",
  FundingClosed: () => "Payday has passed; this salary can't be topped up any more.",
  MathOverflow: () => "Those numbers are too large.",
  UnsupportedMint: () => "This kind of money isn't supported.",
  EmployerCannotBeEmployee: () => "You can't be your own employee. Join from another account.",
  InvalidAdjustmentReason: () => "Pick a reason for the adjustment.",
  AdjustmentTooLarge: () => "An adjustment can't take back pay that was already taken.",
  AdjustmentClosed: () => "Adjustments close on payday.",
  NoAdjustment: () => "There's no adjustment to accept.",
  AdjustmentChanged: () =>
    "Your employer changed the adjustment. Check the new one before accepting.",
  CancelTooEarly: ({ cancelFrom }) =>
    cancelFrom
      ? `This invite can be cancelled from ${formatDateTime(cancelFrom)}.`
      : "This invite can't be cancelled yet.",
  ProofInvalid: () => "This income proof is not valid.",
  UnknownRoot: () => "This income proof is out of date.",
};

export const copy = {
  appName: "Dniówka",
  tagline: "Your salary, secured.",
  taglineMore: "Take what you've already earned, any day. No loan, no fee, no approval.",
  devnetNote: "Test version: play money only.",

  common: {
    back: "← Back",
    loading: "Loading…",
    confirming: "Confirming…",
    proof: "proof ↗",
    copyLink: "Copy invite link",
    copied: "Copied ✓",
    retry: "Try again",
  },

  connect: {
    connect: "Connect",
    join: "Connect and join",
    joinConnected: "Join",
    disconnect: "Disconnect",
    connected: "Connected",
  },

  start: {
    title: "Who are you today?",
    employer: "I pay salaries",
    employerHint:
      "Secure your team's pay. They can take only what they've earned; payday runs itself.",
    employee: "I get paid",
    employeeHint: "Open the invite link your employer sent you.",
  },

  employer: {
    title: "Payroll",
    connectFirst: "Connect to manage your payroll.",
    registerTitle: "Register your company",
    companyName: "Company name",
    companyPlaceholder: "Piekarnia Nowak",
    register: "Register",
    registered: "Company registered.",
    balance: "Ready to secure",
    noMoney: "You have no test zł yet. Ask the organiser to send you some.",
    addTitle: "Add employee",
    employeeName: "Employee name",
    employeePlaceholder: "Oksana",
    net: "Net salary (zł)",
    floor: "Available early (% of earned)",
    monthLength: "Month length",
    lengths: [
      { label: "5 minutes (demo: 10 s = 1 day)", seconds: 300 },
      { label: "30 minutes (demo: 1 min = 1 day)", seconds: 1_800 },
      { label: "30 days", seconds: 2_592_000 },
    ],
    worked: "Days already worked",
    paydayDelay: "Payday: days after the month ends",
    lockTo: "Their account number (optional)",
    lockToHint: "Leave empty and whoever opens the link first joins.",
    create: "Create salary",
    created: (name: string) => `Salary created for ${name}. Secure it, then send the invite link.`,
    listTitle: "Salaries",
    empty: "No salaries yet.",
    secure: (amount: string) => `Secure ${amount}`,
    secured: (amount: string) => `${amount} secured in the vault. Nobody can take it back.`,
    open: "Open →",
    salaryNo: (id: bigint) => `Salary #${id.toString()}`,
    invalidAmount: "Enter an amount like 6000 or 6000,00.",
    invalidLock: "That account number doesn't look right.",
    bigScreen: "Open the big screen →",
    endsOn: (date: string) => `Employment ends ${date}`,
    manage: "End employment or adjust pay",
    manageClose: "Close",
    endTitle: "End employment",
    endDate: "Last moment of work",
    endExplain: "Earned until then is paid on payday; the rest returns to you.",
    endPast: "End date can't be in the past.",
    endAfterMonth: "End date can't be after the end of the month.",
    endBeforeCurrent: (date: string) => `It already ends ${date}; it can only move later.`,
    end: "End employment",
    ended: (date: string) => `Employment ends ${date}. Nobody can backdate it.`,
    adjustTitle: "Payday adjustment",
    reason: "Reason",
    reasons: [1, 2, 3, 4].map((code) => ({ code, label: reasonOf(code) })),
    adjustAmount: "Reduce final pay by (zł)",
    capsLoading: "Checking how far an adjustment can go…",
    caps: (alone: string, withConsent: string) =>
      `You can reduce by at most ${alone} without the employee's consent (up to ${withConsent} if they accept).`,
    needsConsent: (alone: string) =>
      `Above ${alone}, the rest applies only if the employee accepts.`,
    overCap: (withConsent: string) => `At most ${withConsent}: pay already taken can't be cut.`,
    propose: "Propose adjustment",
    proposed: (amount: string) => `Adjustment of −${amount} proposed. The employee can see it.`,
    adjustment: (amount: string, reason: number) => `Adjustment −${amount} (${reasonOf(reason)})`,
    adjustmentAccepted: "accepted by the employee",
    adjustmentWaiting: "waiting for the employee",
    cancel: (amount: string) => `Cancel invite and get ${amount} back`,
    cancelEmpty: "Cancel invite",
    cancelled: "Invite cancelled. The secured money is back in your account.",
  },

  status: {
    invited: "Waiting for the employee to join",
    active: "Running",
    settled: "Paid",
    cancelled: "Cancelled",
  } as Record<string, string>,

  salary: {
    notFound: "This salary doesn't exist. Check the link.",
    inviteTitle: (company: string | null) =>
      company ? `${company} set up your salary` : "Your employer set up your salary",
    inviteSecured: (secured: string, net: string) =>
      `${secured} of ${net} is already secured in a vault in your name.`,
    inviteHow: "Join, and every day you work part of it becomes yours to take, anytime.",
    joined: "You're in. Watch your salary fill up, day by day.",
    wrongPerson: "This invite is for someone else.",
    employerWaiting: "Waiting for your employee to join. Send them the invite link.",
    youAreEmployer: "You're the employer: you can watch, not take.",
    youAreGuest: "You're looking at someone else's salary. You can still run payday when it comes.",
    earned: "Earned so far",
    available: "Available now",
    secured: "Secured by employer",
    taken: "Taken so far",
    inAccount: "In your account",
    payday: "Payday in",
    paydayLabel: "Payday",
    paydayAt: (ts: number) => `Payday ${formatDateTime(ts)}`,
    underfunded: (secured: string, net: string) =>
      `Your employer has secured ${secured} of ${net} so far. What you can take never goes above what is secured.`,
    fromProgram: "Figures come from the program itself, refreshed every few seconds.",
    stripLegend: "Each square is one day of pay. Yellow: earned. Striped: taken.",
    takeTitle: "Take money now",
    amount: "How much (zł)",
    take: "Take money now",
    tooMuch: "That's more than is available now.",
    tryAnyway: "Try anyway",
    tryAnywayHint: "Send it anyway and let the rules refuse it.",
    took: (amount: string) => `+${amount} is yours.`,
    paydayReady: "Payday has come. Anyone can run it, no approval needed.",
    runPayday: "Run payday",
    paidTitle: "Paid",
    paidEarned: "Earned this month",
    paidTaken: "Taken early",
    paidCut: "Payday adjustments",
    paidNow: "Paid on payday",
    paidRefund: "Returned to the employer (not earned)",
    paidShortfall: "Not covered by the employer (public record)",
    paidLoading: "Reading the payday receipt…",
    paidCutReason: (reason: number, accepted: boolean) =>
      `Payday adjustment (${reasonOf(reason)}${accepted ? ", accepted" : ""})`,
    paidCutAsked: (asked: string) =>
      `Asked ${asked}; the guaranteed share can't be cut without consent.`,
    paidEnded: "Employment ended",
    endsOn: (date: string) =>
      `Your employment ends ${date}. Pay stops counting then; what you earned is paid on payday.`,
    endsOnOther: (date: string) =>
      `Employment ends ${date}. Pay stops counting then; what was earned is paid on payday.`,
    adjustTitle: "Payday adjustment",
    adjustProposedOther: (amount: string, reason: number) =>
      `The employer proposes to reduce the final pay by ${amount} (${reasonOf(reason)}).`,
    adjustAloneOther: (alone: string) =>
      `Without the employee's consent, at most ${alone} can apply: the guaranteed share is protected.`,
    adjustProposed: (amount: string, reason: number) =>
      `Your employer proposes to reduce your final pay by ${amount} (${reasonOf(reason)}).`,
    adjustAlone: (alone: string) =>
      `Without your consent, at most ${alone} can apply: your guaranteed share is protected.`,
    adjustWithinFloor: "This stays within what your employer can apply without your consent.",
    adjustAccepted: "You accepted this adjustment.",
    adjustAccept: (amount: string) => `Accept −${amount}`,
    adjustAcceptedNow: "Accepted. It applies on payday.",
    adjustEmployerView: (waiting: boolean) =>
      waiting ? "Waiting for the employee to accept." : "The employee accepted.",
    cancelledTitle: "Invite cancelled",
    cancelledText: "Nobody joined in time, so the employer took back the secured money.",
  },

  bigScreen: {
    vault: "In the vaults now",
    nextPayday: "Next payday in",
    noPayday: "No payday coming",
    paydayNow: "Payday has come",
    feedTitle: "Live from the program",
    employeeNo: (id: bigint) => `Employee #${id.toString()}`,
    feedEmpty: "Waiting for the first event…",
    unknownEmployer: "No payroll here. Open this screen from the payroll page.",
    integrations: [
      { label: "Token-2022", on: true },
      { label: "Anchor program", on: true },
      { label: "devnet", on: true },
      { label: "Kora", on: false },
      { label: "ZK / Noir", on: false },
      { label: "verified build", on: false },
    ],
    line: {
      created: (who: string, net: string) => `Salary set up for ${who}: ${net}`,
      funded: (who: string, amount: string) => `${amount} secured for ${who}`,
      joined: (who: string) => `${who} joined`,
      took: (who: string, amount: string) => `${who} took ${amount} already earned`,
      ended: (who: string, date: string) => `${who}: employment ends ${date}`,
      proposed: (who: string, amount: string, reason: number) =>
        `Adjustment proposed for ${who}: −${amount} (${reasonOf(reason)})`,
      accepted: (who: string, amount: string) => `${who} accepted the adjustment −${amount}`,
      paid: (who: string, pay: string) => `Payday for ${who}: ${pay} paid, no approval`,
      paidRefund: (refund: string) => `${refund} back to the employer`,
      shortfall: (who: string, amount: string) =>
        `${amount} not covered for ${who} (public record)`,
      cancelled: (who: string, refund: string) => `Invite for ${who} cancelled: ${refund} back`,
    },
  },

  failure: {
    program: (name: string, c: ErrorContext) =>
      programErrors[name]?.(c) ?? "The rules refused this. Nothing was taken.",
    cancelled: "You cancelled. Nothing happened.",
    noFees:
      "Your account can't cover the small network fee yet. Ask the organiser for test funds, then try again.",
    network: "The network didn't answer. Check your connection and try again.",
    unknown: "Something went wrong. Nothing was taken.",
  },

  stamps: {
    refused: "ODMOWA",
    paid: "WYPŁACONO",
    confirming: "…",
  },

  /** "Under the hood" drawer: for the jury; technical words are allowed here. */
  hood: {
    title: "Under the hood",
    program: "Program (devnet)",
    instruction: "Instruction",
    rule: "Rule checked on-chain",
    accounts: "Accounts",
    lastTx: "Last transaction",
    failedTx: "Refused transaction (failed on-chain)",
    errorCode: "Program error",
    viewer: "Connected wallet",
    fees: "Fees are paid in devnet SOL by the connected wallet (faucet.solana.com).",
    capsRule:
      "Adjustment limits are the program's own numbers: the app simulates propose_adjustment " +
      "with an impossible amount (nothing is signed or sent) and reads its log line " +
      "`cut cap X with consent Y`.",
    feedRule:
      "The receipt reads the program's events (Anchor `Program data:` logs) from its recent " +
      "transactions, plus refused transactions (failed on-chain) with their error code.",
    readRule:
      "Earned and available are the program's own numbers: the app simulates withdraw_earned " +
      "(nothing is signed or sent) and reads its log line `earned X available Y`. Payday countdown " +
      "uses the cluster Clock sysvar.",
    rules: {
      init_employer:
        'Creates the Employer PDA ["employer", authority]. Accepts only a plain Token-2022 mint ' +
        "with no freeze authority and no extensions.",
      create_stream:
        "net > 0; period_end > period_start; period_end ≤ payday ≤ period_end + 10 days; " +
        "1 ≤ floor_bps ≤ 10 000. Creates the stream PDA and its vault (token authority = stream PDA).",
      fund_stream:
        "funded + amount ≤ net_amount; only while Invited/Active and before payday. " +
        "Transfer employer → vault.",
      accept_stream:
        "Only while Invited; binds employee = signer (must equal the hint if one was set); " +
        "employer ≠ employee.",
      withdraw_earned:
        "amount ≤ min(earned × floor_bps / 10 000, funded) − withdrawn, with earned = net × elapsed / " +
        "duration from the cluster clock (spec §4). Vault → employee, signed by the stream PDA. " +
        "No lender, no approval.",
      end_employment:
        "Employer only; status Active; end_ts ≥ now (no backdating, BackdatingNotAllowed); " +
        "end_ts ≤ period_end; can only move later. Earned stops at end_ts.",
      propose_adjustment:
        "Employer only; status Active; now < payday; reason 1..=4; 0 < amount ≤ earned_final − " +
        "withdrawn. Without consent settle caps the cut at earned_final − max(floor, withdrawn). " +
        "Resets adjustment_accepted. Logs `cut cap X with consent Y` (the app reads it by simulation).",
      accept_adjustment:
        "Employee only; status Active; amount must equal the stored adjustment (AdjustmentChanged " +
        "if the employer replaced it), then adjustment_accepted = true.",
      cancel_unaccepted:
        "Employer only; status Invited; now ≥ period_start + (period_end − period_start) / 10. " +
        "Refunds funded from the vault to the employer; status Cancelled.",
      settle:
        "Anyone may call it once now ≥ payday. Pays earned − withdrawn to the employee, refunds the " +
        "rest to the employer, emits Settled (and WageShortfall if under-funded).",
    } as Record<string, string>,
  },
};
