/**
 * Every user-facing string, in English (`en`, default) and Polish (`pl`). No crypto vocabulary
 * outside `hood` (spec §3.3): never wallet, token, mint, PDA, SOL, lamports, transaction,
 * signature, hash, Solana, blockchain (`copy.test.ts` checks both languages).
 * `copy` is a live binding: `setLang` swaps it and the app re-renders.
 */
import { formatDateTime, formatZl } from "./format";

export type ErrorContext = {
  earned?: bigint;
  available?: bigint;
  payday?: number;
  cancelFrom?: number;
};

type Errors = Record<string, (c: ErrorContext) => string>;

/** Adjustment reason codes as the program stores them (1..=4). */
const reasonsEn: Record<number, string> = {
  1: "sick leave",
  2: "unpaid absence",
  3: "correction",
  4: "other",
};
const reasonOfEn = (code: number) => reasonsEn[code] ?? reasonsEn[4];

const errorsEn: Errors = {
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

/** "Under the hood" drawer: for the jury; technical words are allowed here. */
const hoodEn = {
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
    "uses the cluster Clock sysvar. The strip glides between two readings; it never estimates pay.",
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
};

export const en = {
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
    close: "Close",
  },

  lang: {
    label: "Language",
    switchTo: "Polski",
  },

  connect: {
    connect: "Connect",
    join: "Connect and join",
    joinConnected: "Join",
    disconnect: "Disconnect",
    connected: "Connected",
    pickTitle: "Connect your account",
    pickIntro: "Pick the app that holds your account. Nothing is shared until you approve.",
    none: "No account app found on this device. Install Phantom or Solflare, then reload this page.",
    testAccount: "Test account (this browser only)",
    connecting: "Connecting…",
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
    reasons: [1, 2, 3, 4].map((code) => ({ code, label: reasonOfEn(code) })),
    adjustAmount: "Reduce final pay by (zł)",
    capsLoading: "Checking how far an adjustment can go…",
    caps: (alone: string, withConsent: string) =>
      `You can reduce by at most ${alone} without the employee's consent (up to ${withConsent} if they accept).`,
    needsConsent: (alone: string) =>
      `Above ${alone}, the rest applies only if the employee accepts.`,
    overCap: (withConsent: string) => `At most ${withConsent}: pay already taken can't be cut.`,
    propose: "Propose adjustment",
    proposed: (amount: string) => `Adjustment of −${amount} proposed. The employee can see it.`,
    adjustment: (amount: string, reason: number) => `Adjustment −${amount} (${reasonOfEn(reason)})`,
    adjustmentAccepted: "accepted by the employee",
    adjustmentWaiting: "waiting for the employee",
    cancel: (amount: string) => `Cancel invite and get ${amount} back`,
    cancelEmpty: "Cancel invite",
    cancelled: "Invite cancelled. The secured money is back in your account.",
    labelsSaved: "Names saved on this device.",
  },

  status: {
    invited: "Waiting for the employee to join",
    active: "Running",
    settled: "Paid",
    cancelled: "Cancelled",
  } as Record<string, string>,

  salary: {
    notFound: "This salary doesn't exist. Check the link.",
    eyebrow: (company: string | null) =>
      company ? `${company} · this month's salary` : "This month's salary",
    inviteTitle: (company: string | null) =>
      company ? `${company} set up your salary` : "Your employer set up your salary",
    inviteSecured: (secured: string, net: string) =>
      `${secured} of ${net} is already secured in a vault in your name.`,
    inviteHow: "Join, and every day you work part of it becomes yours to take, anytime.",
    inviteNet: "Net salary this month",
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
    stripLegend:
      "Each coupon is one day of pay. Yellow: earned. Torn off: taken. Outlined: still to come.",
    stripTitle: "The month, day by day",
    perDay: "zł a day",
    day: (n: number) => `Day ${n}`,
    today: "today",
    offContract: "after the contract",
    couponLabel: (day: number, state: string, value: string) => `Day ${day}, ${value}: ${state}`,
    couponState: {
      taken: "taken",
      earned: "earned",
      today: "being earned today",
      future: "still to come",
      off: "after the end of the contract",
    },
    pile: "taken",
    pileText: (days: number, amount: string) =>
      `${days} ${days === 1 ? "day" : "days"} torn off · ${amount}`,
    tearLine: "tear here",
    takeTitle: "Take money now",
    amount: "How much (zł)",
    take: "Take money now",
    tooMuch: "That's more than is available now.",
    tryAnyway: "Try anyway",
    tryAnywayHint: "Send it anyway and let the rules refuse it.",
    tearIntro: "Tear off the days you want. You can only take what you've already earned.",
    tearAmount: "Amount to take",
    less: "One day less",
    more: "One day more",
    all: "All available",
    typeAmount: "Type an exact amount",
    hideTyped: "Use the coupons",
    nothingYet: "Nothing is available yet. Come back after a few hours of work.",
    continue: "Continue",
    cancel: "Cancel",
    receiptTitle: "Before you take it",
    youGet: "You get",
    fee: "Fee",
    takenAfter: "Taken in total",
    staysInVault: "Left in the vault",
    hold: (amount: string) => `Hold to take ${amount}`,
    holdHint: "Press and hold until the bar fills.",
    holding: "Keep holding…",
    took: (amount: string) => `+${amount} is yours.`,
    tookBig: (amount: string) => `+${amount}`,
    tookSub: "is in your account. Nobody had to approve it.",
    done: "Done",
    paydayReady: "Payday has come. Anyone can run it, no approval needed.",
    runPayday: "Run payday",
    paidTitle: "Paid",
    paidReceiptTitle: "Payday receipt",
    paidEarned: "Earned this month",
    paidTaken: "Taken early",
    paidCut: "Payday adjustments",
    paidNow: "Paid on payday",
    paidRefund: "Returned to the employer",
    paidShortfall: "Not covered by the employer (public record)",
    paidLoading: "Reading the payday receipt…",
    paidCutReason: (reason: number, accepted: boolean) =>
      `Payday adjustment (${reasonOfEn(reason)}${accepted ? ", accepted" : ""})`,
    paidCutAsked: (asked: string) =>
      `Asked ${asked}; the guaranteed share can't be cut without consent.`,
    paidEnded: "Employment ended",
    endsOn: (date: string) =>
      `Your employment ends ${date}. Pay stops counting then; what you earned is paid on payday.`,
    endsOnOther: (date: string) =>
      `Employment ends ${date}. Pay stops counting then; what was earned is paid on payday.`,
    adjustTitle: "Payday adjustment",
    adjustProposedOther: (amount: string, reason: number) =>
      `The employer proposes to reduce the final pay by ${amount} (${reasonOfEn(reason)}).`,
    adjustAloneOther: (alone: string) =>
      `Without the employee's consent, at most ${alone} can apply: the guaranteed share is protected.`,
    adjustProposed: (amount: string, reason: number) =>
      `Your employer proposes to reduce your final pay by ${amount} (${reasonOfEn(reason)}).`,
    adjustAlone: (alone: string) =>
      `Without your consent, at most ${alone} can apply: your guaranteed share is protected.`,
    adjustWithinFloor: "This stays within what your employer can apply without your consent.",
    adjustAccepted: "You accepted this adjustment.",
    adjustAccept: (amount: string) => `Accept −${amount}`,
    adjustAcceptedNow: "Accepted. It applies on payday.",
    adjustEmployerView: (waiting: boolean): string =>
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
    receiptHead: "PARAGON · Dniówka",
    units: { d: "days", h: "hours", min: "min", s: "sec" },
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
        `Adjustment proposed for ${who}: −${amount} (${reasonOfEn(reason)})`,
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
      errorsEn[name]?.(c) ?? "The rules refused this. Nothing was taken.",
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

  hood: hoodEn,
};

export type Copy = typeof en;

/* ------------------------------------------------------------------ Polski */

const reasonsPl: Record<number, string> = {
  1: "zwolnienie lekarskie",
  2: "nieobecność bez wynagrodzenia",
  3: "korekta",
  4: "inne",
};
const reasonOfPl = (code: number) => reasonsPl[code] ?? reasonsPl[4];

const errorsPl: Errors = {
  ExceedsAvailable: ({ earned, available }) =>
    earned !== undefined && available !== undefined
      ? `Masz już zarobione ${formatZl(earned)}; teraz możesz odebrać do ${formatZl(available)}.`
      : "To więcej, niż jest teraz dostępne.",
  PaymentLocked: () => "Ta pensja jest zabezpieczona. Nikt nie może jej zabrać.",
  NotEmployer: () => "Ta pensja jest zabezpieczona. Nikt nie może jej zabrać.",
  BackdatingNotAllowed: () => "Data zakończenia nie może być w przeszłości.",
  TooEarlyForPayday: ({ payday }) =>
    payday ? `Dzień wypłaty: ${formatDateTime(payday)}.` : "Dzień wypłaty jeszcze nie nadszedł.",
  Overfunded: () => "To więcej, niż ta pensja jeszcze potrzebuje.",
  InvalidPeriod: () => "Miesiąc musi kończyć się po swoim początku.",
  InvalidFloor: () => "Część dostępna wcześniej musi wynosić od 0,01 % do 100 %.",
  AlreadySettled: () => "Ta pensja została już wypłacona.",
  NotEmployee: () => "To zaproszenie jest dla kogoś innego.",
  ZeroAmount: () => "Wpisz kwotę większą od zera.",
  InvalidPayday: () => "Dzień wypłaty musi przypaść między końcem miesiąca a 10 dniami po nim.",
  NotInvited: () => "To zaproszenie zostało już przyjęte.",
  NotActive: () => "Ta pensja nie jest aktywna.",
  InvalidEndDate: () => "Data zakończenia nie może wypaść po końcu miesiąca.",
  EndDateCannotMoveEarlier: () => "Datę zakończenia można tylko przesunąć na później.",
  FundingClosed: () => "Dzień wypłaty minął; tej pensji nie można już uzupełnić.",
  MathOverflow: () => "Te liczby są za duże.",
  UnsupportedMint: () => "Ten rodzaj pieniędzy nie jest obsługiwany.",
  EmployerCannotBeEmployee: () => "Nie możesz być własnym pracownikiem. Dołącz z innego konta.",
  InvalidAdjustmentReason: () => "Wybierz powód korekty.",
  AdjustmentTooLarge: () => "Korekta nie może objąć pieniędzy, które już zostały odebrane.",
  AdjustmentClosed: () => "Korekty zamykają się w dniu wypłaty.",
  NoAdjustment: () => "Nie ma korekty do zaakceptowania.",
  AdjustmentChanged: () => "Pracodawca zmienił korektę. Sprawdź nową, zanim ją zaakceptujesz.",
  CancelTooEarly: ({ cancelFrom }) =>
    cancelFrom
      ? `To zaproszenie można anulować od ${formatDateTime(cancelFrom)}.`
      : "Tego zaproszenia nie można jeszcze anulować.",
  ProofInvalid: () => "To potwierdzenie dochodu jest nieważne.",
  UnknownRoot: () => "To potwierdzenie dochodu jest nieaktualne.",
};

export const pl: Copy = {
  appName: "Dniówka",
  tagline: "Twoja pensja, zabezpieczona.",
  taglineMore:
    "Odbieraj to, co już zarobione, każdego dnia. Bez pożyczki, bez opłat, bez czyjejś zgody.",
  devnetNote: "Wersja testowa: tylko pieniądze na niby.",

  common: {
    back: "← Wstecz",
    loading: "Wczytywanie…",
    confirming: "Potwierdzanie…",
    proof: "dowód ↗",
    copyLink: "Kopiuj link z zaproszeniem",
    copied: "Skopiowano ✓",
    retry: "Spróbuj ponownie",
    close: "Zamknij",
  },

  lang: {
    label: "Język",
    switchTo: "English",
  },

  connect: {
    connect: "Połącz",
    join: "Połącz i dołącz",
    joinConnected: "Dołącz",
    disconnect: "Rozłącz",
    connected: "Połączono",
    pickTitle: "Połącz swoje konto",
    pickIntro:
      "Wybierz aplikację, w której masz konto. Nic nie zostanie udostępnione bez Twojej zgody.",
    none: "Na tym urządzeniu nie ma aplikacji z kontem. Zainstaluj Phantom lub Solflare i odśwież stronę.",
    testAccount: "Konto testowe (tylko ta przeglądarka)",
    connecting: "Łączenie…",
  },

  start: {
    title: "Kim dziś jesteś?",
    employer: "Wypłacam pensje",
    employerHint:
      "Zabezpiecz wynagrodzenia zespołu. Każdy odbiera tylko to, co zarobił; wypłata dzieje się sama.",
    employee: "Dostaję pensję",
    employeeHint: "Otwórz link z zaproszeniem od pracodawcy.",
  },

  employer: {
    title: "Lista płac",
    connectFirst: "Połącz się, aby zarządzać listą płac.",
    registerTitle: "Zarejestruj firmę",
    companyName: "Nazwa firmy",
    companyPlaceholder: "Piekarnia Nowak",
    register: "Zarejestruj",
    registered: "Firma zarejestrowana.",
    balance: "Gotowe do zabezpieczenia",
    noMoney: "Nie masz jeszcze testowych złotych. Poproś organizatora o przelew.",
    addTitle: "Dodaj pracownika",
    employeeName: "Imię pracownika",
    employeePlaceholder: "Oksana",
    net: "Pensja netto (zł)",
    floor: "Dostępne wcześniej (% zarobionego)",
    monthLength: "Długość miesiąca",
    lengths: [
      { label: "5 minut (demo: 10 s = 1 dzień)", seconds: 300 },
      { label: "30 minut (demo: 1 min = 1 dzień)", seconds: 1_800 },
      { label: "30 dni", seconds: 2_592_000 },
    ],
    worked: "Dni już przepracowane",
    paydayDelay: "Wypłata: ile dni po końcu miesiąca",
    lockTo: "Numer konta pracownika (opcjonalnie)",
    lockToHint: "Zostaw puste, a dołączy ten, kto pierwszy otworzy link.",
    create: "Utwórz pensję",
    created: (name: string) =>
      `Pensja dla: ${name} utworzona. Zabezpiecz ją, potem wyślij link z zaproszeniem.`,
    listTitle: "Pensje",
    empty: "Nie ma jeszcze żadnych pensji.",
    secure: (amount: string) => `Zabezpiecz ${amount}`,
    secured: (amount: string) => `${amount} zabezpieczone w sejfie. Nikt nie może tego zabrać.`,
    open: "Otwórz →",
    salaryNo: (id: bigint) => `Pensja nr ${id.toString()}`,
    invalidAmount: "Wpisz kwotę, np. 6000 albo 6000,00.",
    invalidLock: "Ten numer konta wygląda na błędny.",
    bigScreen: "Otwórz duży ekran →",
    endsOn: (date: string) => `Zatrudnienie kończy się ${date}`,
    manage: "Zakończ zatrudnienie lub skoryguj wypłatę",
    manageClose: "Zamknij",
    endTitle: "Zakończ zatrudnienie",
    endDate: "Ostatnia chwila pracy",
    endExplain:
      "To, co zarobione do tego momentu, trafi do pracownika w dniu wypłaty; reszta wraca do Ciebie.",
    endPast: "Data zakończenia nie może być w przeszłości.",
    endAfterMonth: "Data zakończenia nie może wypaść po końcu miesiąca.",
    endBeforeCurrent: (date: string) =>
      `Zatrudnienie kończy się już ${date}; datę można tylko przesunąć na później.`,
    end: "Zakończ zatrudnienie",
    ended: (date: string) => `Zatrudnienie kończy się ${date}. Nikt nie może tego cofnąć w czasie.`,
    adjustTitle: "Korekta wypłaty",
    reason: "Powód",
    reasons: [1, 2, 3, 4].map((code) => ({ code, label: reasonOfPl(code) })),
    adjustAmount: "Zmniejsz końcową wypłatę o (zł)",
    capsLoading: "Sprawdzanie, jak duża może być korekta…",
    caps: (alone: string, withConsent: string) =>
      `Bez zgody pracownika możesz zmniejszyć wypłatę najwyżej o ${alone} (do ${withConsent}, jeśli ją zaakceptuje).`,
    needsConsent: (alone: string) =>
      `Powyżej ${alone} reszta obowiązuje tylko po akceptacji pracownika.`,
    overCap: (withConsent: string) =>
      `Najwyżej ${withConsent}: pieniędzy już odebranych nie można zabrać.`,
    propose: "Zaproponuj korektę",
    proposed: (amount: string) => `Zaproponowano korektę −${amount}. Pracownik ją widzi.`,
    adjustment: (amount: string, reason: number) => `Korekta −${amount} (${reasonOfPl(reason)})`,
    adjustmentAccepted: "zaakceptowana przez pracownika",
    adjustmentWaiting: "czeka na pracownika",
    cancel: (amount: string) => `Anuluj zaproszenie i odzyskaj ${amount}`,
    cancelEmpty: "Anuluj zaproszenie",
    cancelled: "Zaproszenie anulowane. Zabezpieczone pieniądze wróciły na Twoje konto.",
    labelsSaved: "Imiona zapisane na tym urządzeniu.",
  },

  status: {
    invited: "Czeka, aż pracownik dołączy",
    active: "W toku",
    settled: "Wypłacona",
    cancelled: "Anulowana",
  } as Record<string, string>,

  salary: {
    notFound: "Ta pensja nie istnieje. Sprawdź link.",
    eyebrow: (company: string | null) =>
      company ? `${company} · pensja za ten miesiąc` : "Pensja za ten miesiąc",
    inviteTitle: (company: string | null) =>
      company ? `${company} przygotowała Twoją pensję` : "Pracodawca przygotował Twoją pensję",
    inviteSecured: (secured: string, net: string) =>
      `${secured} z ${net} jest już zabezpieczone w sejfie na Twoje nazwisko.`,
    inviteHow:
      "Dołącz, a z każdym dniem pracy część pensji staje się Twoja i możesz ją odebrać w każdej chwili.",
    inviteNet: "Pensja netto w tym miesiącu",
    joined: "Jesteś w środku. Patrz, jak pensja rośnie dzień po dniu.",
    wrongPerson: "To zaproszenie jest dla kogoś innego.",
    employerWaiting: "Czekamy, aż pracownik dołączy. Wyślij mu link z zaproszeniem.",
    youAreEmployer: "Jesteś pracodawcą: możesz patrzeć, ale nie odbierać.",
    youAreGuest: "Oglądasz cudzą pensję. Gdy nadejdzie dzień wypłaty, możesz uruchomić wypłatę.",
    earned: "Zarobione do tej pory",
    available: "Dostępne teraz",
    secured: "Zabezpieczone przez pracodawcę",
    taken: "Odebrane do tej pory",
    inAccount: "Na Twoim koncie",
    payday: "Wypłata za",
    paydayLabel: "Wypłata",
    paydayAt: (ts: number) => `Wypłata ${formatDateTime(ts)}`,
    underfunded: (secured: string, net: string) =>
      `Pracodawca zabezpieczył na razie ${secured} z ${net}. Nigdy nie odbierzesz więcej, niż jest zabezpieczone.`,
    fromProgram: "Liczby pochodzą prosto z programu i odświeżają się co kilka sekund.",
    stripLegend:
      "Każdy kupon to jedna dniówka. Żółte: zarobione. Oderwane: odebrane. Puste: jeszcze przed Tobą.",
    stripTitle: "Miesiąc, dzień po dniu",
    perDay: "zł za dzień",
    day: (n: number) => `Dzień ${n}`,
    today: "dziś",
    offContract: "po końcu umowy",
    couponLabel: (day: number, state: string, value: string) => `Dzień ${day}, ${value}: ${state}`,
    couponState: {
      taken: "odebrane",
      earned: "zarobione",
      today: "zarabiane dzisiaj",
      future: "jeszcze przed Tobą",
      off: "po zakończeniu umowy",
    },
    pile: "odebrane",
    pileText: (days: number, amount: string) => `oderwane dni: ${days} · ${amount}`,
    tearLine: "oderwij tutaj",
    takeTitle: "Odbierz pieniądze teraz",
    amount: "Ile (zł)",
    take: "Odbierz pieniądze teraz",
    tooMuch: "To więcej, niż jest teraz dostępne.",
    tryAnyway: "Spróbuj mimo to",
    tryAnywayHint: "Wyślij mimo to i pozwól, by zasady odmówiły.",
    tearIntro: "Oderwij tyle dni, ile chcesz. Odbierzesz tylko to, co już zarobione.",
    tearAmount: "Kwota do odebrania",
    less: "Jeden dzień mniej",
    more: "Jeden dzień więcej",
    all: "Wszystko dostępne",
    typeAmount: "Wpisz dokładną kwotę",
    hideTyped: "Wróć do kuponów",
    nothingYet: "Na razie nic nie jest dostępne. Wróć po kilku godzinach pracy.",
    continue: "Dalej",
    cancel: "Anuluj",
    receiptTitle: "Zanim odbierzesz",
    youGet: "Otrzymujesz",
    fee: "Opłata",
    takenAfter: "Odebrane łącznie",
    staysInVault: "Zostaje w sejfie",
    hold: (amount: string) => `Przytrzymaj, by odebrać ${amount}`,
    holdHint: "Naciśnij i trzymaj, aż pasek się wypełni.",
    holding: "Trzymaj dalej…",
    took: (amount: string) => `+${amount} jest Twoje.`,
    tookBig: (amount: string) => `+${amount}`,
    tookSub: "jest na Twoim koncie. Nikt nie musiał tego zatwierdzać.",
    done: "Gotowe",
    paydayReady: "Nadszedł dzień wypłaty. Każdy może ją uruchomić, bez niczyjej zgody.",
    runPayday: "Uruchom wypłatę",
    paidTitle: "Wypłacono",
    paidReceiptTitle: "Odcinek wypłaty",
    paidEarned: "Zarobione w tym miesiącu",
    paidTaken: "Odebrane wcześniej",
    paidCut: "Korekty wypłaty",
    paidNow: "Wypłacone w dniu wypłaty",
    paidRefund: "Zwrócone pracodawcy",
    paidShortfall: "Niepokryte przez pracodawcę (jawny zapis)",
    paidLoading: "Wczytywanie odcinka wypłaty…",
    paidCutReason: (reason: number, accepted: boolean) =>
      `Korekta wypłaty (${reasonOfPl(reason)}${accepted ? ", zaakceptowana" : ""})`,
    paidCutAsked: (asked: string) =>
      `Zaproponowano ${asked}; gwarantowanej części nie można obciąć bez zgody.`,
    paidEnded: "Koniec zatrudnienia",
    endsOn: (date: string) =>
      `Twoje zatrudnienie kończy się ${date}. Wtedy pensja przestaje rosnąć; to, co zarobione, trafi do Ciebie w dniu wypłaty.`,
    endsOnOther: (date: string) =>
      `Zatrudnienie kończy się ${date}. Wtedy pensja przestaje rosnąć; to, co zarobione, zostanie wypłacone w dniu wypłaty.`,
    adjustTitle: "Korekta wypłaty",
    adjustProposedOther: (amount: string, reason: number) =>
      `Pracodawca proponuje zmniejszyć końcową wypłatę o ${amount} (${reasonOfPl(reason)}).`,
    adjustAloneOther: (alone: string) =>
      `Bez zgody pracownika obowiązuje najwyżej ${alone}: gwarantowana część jest chroniona.`,
    adjustProposed: (amount: string, reason: number) =>
      `Pracodawca proponuje zmniejszyć Twoją końcową wypłatę o ${amount} (${reasonOfPl(reason)}).`,
    adjustAlone: (alone: string) =>
      `Bez Twojej zgody obowiązuje najwyżej ${alone}: Twoja gwarantowana część jest chroniona.`,
    adjustWithinFloor: "To mieści się w tym, co pracodawca może zastosować bez Twojej zgody.",
    adjustAccepted: "Zaakceptowano tę korektę.",
    adjustAccept: (amount: string) => `Akceptuję −${amount}`,
    adjustAcceptedNow: "Zaakceptowano. Korekta obowiązuje w dniu wypłaty.",
    adjustEmployerView: (waiting: boolean) =>
      waiting ? "Czeka na akceptację pracownika." : "Pracownik zaakceptował.",
    cancelledTitle: "Zaproszenie anulowane",
    cancelledText: "Nikt nie dołączył na czas, więc pracodawca odebrał zabezpieczone pieniądze.",
  },

  bigScreen: {
    vault: "Teraz w sejfach",
    nextPayday: "Najbliższa wypłata za",
    noPayday: "Brak nadchodzącej wypłaty",
    paydayNow: "Nadszedł dzień wypłaty",
    feedTitle: "Na żywo z programu",
    receiptHead: "PARAGON · Dniówka",
    units: { d: "dni", h: "godz.", min: "min", s: "sek." },
    employeeNo: (id: bigint) => `Pracownik nr ${id.toString()}`,
    feedEmpty: "Czekamy na pierwsze zdarzenie…",
    unknownEmployer: "Tu nie ma listy płac. Otwórz ten ekran ze strony listy płac.",
    integrations: en.bigScreen.integrations,
    line: {
      created: (who: string, net: string) => `Pensja dla: ${who}, ${net}`,
      funded: (who: string, amount: string) => `${amount} zabezpieczone dla: ${who}`,
      joined: (who: string) => `${who} dołącza`,
      took: (who: string, amount: string) => `${who} odbiera ${amount} już zarobione`,
      ended: (who: string, date: string) => `${who}: zatrudnienie kończy się ${date}`,
      proposed: (who: string, amount: string, reason: number) =>
        `Korekta dla: ${who}, −${amount} (${reasonOfPl(reason)})`,
      accepted: (who: string, amount: string) => `${who} akceptuje korektę −${amount}`,
      paid: (who: string, pay: string) => `Wypłata dla: ${who}, ${pay}, bez niczyjej zgody`,
      paidRefund: (refund: string) => `${refund} wraca do pracodawcy`,
      shortfall: (who: string, amount: string) => `${amount} niepokryte dla: ${who} (jawny zapis)`,
      cancelled: (who: string, refund: string) =>
        `Zaproszenie dla: ${who} anulowane, ${refund} wraca`,
    },
  },

  failure: {
    program: (name: string, c: ErrorContext) =>
      errorsPl[name]?.(c) ?? "Zasady na to nie pozwalają. Nic nie zostało pobrane.",
    cancelled: "Anulowano. Nic się nie stało.",
    noFees:
      "Twoje konto nie pokryje jeszcze drobnej opłaty sieciowej. Poproś organizatora o testowe środki i spróbuj ponownie.",
    network: "Sieć nie odpowiada. Sprawdź połączenie i spróbuj ponownie.",
    unknown: "Coś poszło nie tak. Nic nie zostało pobrane.",
  },

  stamps: en.stamps,

  // Technical rules stay in English for the jury; the drawer's labels are translated.
  hood: {
    ...hoodEn,
    title: "Pod maską",
    rule: "Reguła sprawdzana w programie",
    accounts: "Konta",
    instruction: "Instrukcja",
  },
};

/* ------------------------------------------------------------------ switch */

export type Lang = "en" | "pl";

let lang: Lang = "en";

/** The current language's copy (live binding). */
export let copy: Copy = en;

export function setLang(next: Lang) {
  lang = next;
  copy = next === "pl" ? pl : en;
}

export function getLang(): Lang {
  return lang;
}
