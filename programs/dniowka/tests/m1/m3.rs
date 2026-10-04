//! M3 program tests: spec §5.4 tests 6 and 10, plus the rules of propose_adjustment,
//! accept_adjustment and cancel_unaccepted. Amounts in grosze.

use anchor_lang::prelude::Pubkey;
use dniowka::{error::DniowkaError, events as ev, state::StreamStatus};
use litesvm::types::FailedTransactionMetadata;
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::harness::*;

/// Reads `prefix A <middle> B` from a program log line (the lines the UI reads too).
fn log_pair(failed: &FailedTransactionMetadata, prefix: &str, middle: &str) -> (u64, u64) {
    let wanted = format!("Program log: {prefix} ");
    for line in &failed.meta.logs {
        if let Some(rest) = line.strip_prefix(&wanted) {
            let (a, b) = rest.split_once(&format!(" {middle} ")).expect("log shape");
            return (a.parse().unwrap(), b.parse().unwrap());
        }
    }
    panic!("no `{prefix}` log line:\n{}", failed.meta.pretty_logs());
}

/// Available now, as the program reports it before refusing an impossible withdrawal.
fn available_now(env: &mut Env, stream: &Pubkey, employee: &Keypair) -> u64 {
    let failed = env
        .withdraw(stream, employee, u64::MAX)
        .expect_err("u64::MAX is never available");
    log_pair(&failed, "earned", "available").1
}

/// The adjustment caps the program logs: (without consent, with consent).
fn cut_caps(env: &mut Env, stream: &Pubkey) -> (u64, u64) {
    let failed = env
        .propose(stream, u64::MAX, 4)
        .expect_err("u64::MAX can never be cut");
    log_pair(&failed, "cut cap", "with consent")
}

fn settled(meta: &litesvm::types::TransactionMetadata) -> ev::Settled {
    let mut all = events::<ev::Settled>(meta);
    assert_eq!(all.len(), 1);
    all.remove(0)
}

/// Test 6: an adjustment above the floor without consent is capped at the floor;
/// with the employee's consent the full adjustment applies.
#[test]
fn t6_adjustment_needs_consent_below_the_floor() {
    // Without consent.
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    env.set_time(day(12));
    ok(env.withdraw(&stream, &oksana, 80_000));

    // earned_final 600 000, floor 420 000: 180 000 without consent, 520 000 with it.
    assert_eq!(cut_caps(&mut env, &stream), (180_000, 520_000));
    let meta = ok(env.propose(&stream, 300_000, 1));
    let proposed = events::<ev::AdjustmentProposed>(&meta);
    assert_eq!(proposed.len(), 1);
    assert_eq!(
        (
            proposed[0].amount,
            proposed[0].reason,
            proposed[0].cap_without_consent,
            proposed[0].cap_with_consent
        ),
        (300_000, 1, 180_000, 520_000)
    );
    let s = env.stream(&stream);
    assert_eq!(
        (s.adjustment, s.adjustment_reason, s.adjustment_accepted),
        (300_000, 1, false)
    );

    env.set_time(day(30));
    let anyone = env.wallet();
    let boss_before = env.zl_of(&env.boss.pubkey());
    let paid = settled(&ok(env.settle(&stream, &anyone)));
    assert_eq!(paid.cut, 180_000, "capped at the floor");
    assert_eq!((paid.pay_employee, paid.refund_emp), (340_000, 180_000));
    assert_eq!(env.zl_of(&oksana.pubkey()), 420_000, "exactly the floor");
    assert_eq!(env.zl_of(&env.boss.pubkey()), boss_before + 180_000);

    // With consent.
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    env.set_time(day(12));
    ok(env.withdraw(&stream, &oksana, 80_000));
    ok(env.propose(&stream, 300_000, 2));
    let meta = ok(env.accept_adjustment(&stream, &oksana, 300_000));
    let accepted = events::<ev::AdjustmentAccepted>(&meta);
    assert_eq!(accepted.len(), 1);
    assert_eq!(accepted[0].amount, 300_000);
    assert!(env.stream(&stream).adjustment_accepted);

    env.set_time(day(30));
    let anyone = env.wallet();
    let paid = settled(&ok(env.settle(&stream, &anyone)));
    assert_eq!(paid.cut, 300_000, "applied in full");
    assert_eq!((paid.pay_employee, paid.refund_emp), (220_000, 300_000));
    assert_eq!(env.zl_of(&oksana.pubkey()), 300_000);
    assert_eq!(env.balance(&env.stream(&stream).vault), 0);
}

struct Case {
    net: u64,
    floor_bps: u16,
    /// Period length in seconds.
    duration: i64,
    funded: u64,
    /// Seconds after period start at which the employee takes everything available.
    takes: &'static [i64],
    /// End of employment, seconds after period start (set at the first take).
    end_at: Option<i64>,
    /// Requested cut, clamped to what the program accepts.
    adjustment: u64,
    accepted: bool,
}

/// Test 10, rounding: odd amounts and odd times never overpay. Every payout floors, the vault
/// ends empty, and the employee never receives more than the exact (unrounded) earned pay.
#[test]
fn t10_rounding_never_overpays() {
    let cases = [
        Case {
            net: 100_001,
            floor_bps: 7_001,
            duration: 7 * DAY + 13,
            funded: 100_001,
            takes: &[1, 3 * DAY + 7, 5 * DAY + 11],
            end_at: None,
            adjustment: 0,
            accepted: false,
        },
        Case {
            net: 99_999,
            floor_bps: 3_333,
            duration: 30 * DAY - 1,
            funded: 77_777,
            takes: &[DAY + 1, 11 * DAY + 3, 29 * DAY],
            end_at: Some(17 * DAY + 5),
            adjustment: 12_345,
            accepted: false,
        },
        Case {
            net: 1,
            floor_bps: 9_999,
            duration: 3,
            funded: 1,
            takes: &[1, 2],
            end_at: None,
            adjustment: 1,
            accepted: true,
        },
        Case {
            net: 7,
            floor_bps: 1,
            duration: 300,
            funded: 5,
            takes: &[299],
            end_at: Some(299),
            adjustment: 0,
            accepted: false,
        },
        Case {
            net: 600_001,
            floor_bps: 10_000,
            duration: 31 * DAY + 17,
            funded: 600_001,
            takes: &[13, 12 * DAY + 1, 20 * DAY + 3],
            end_at: Some(20 * DAY + 4),
            adjustment: u64::MAX,
            accepted: true,
        },
        Case {
            net: 333_333,
            floor_bps: 6_667,
            duration: 299,
            funded: 333_332,
            takes: &[7, 101, 211],
            end_at: None,
            adjustment: u64::MAX,
            accepted: false,
        },
    ];

    for (i, c) in cases.iter().enumerate() {
        let mut env = Env::new();
        let oksana = env.wallet();
        let (start, end) = (T, T + c.duration);
        let stream = env
            .create_stream(Some(oksana.pubkey()), c.net, start, end, end, c.floor_bps)
            .unwrap_or_else(|f| panic!("case {i}: {:?}", f.err));
        ok(env.accept(&stream, &oksana));
        ok(env.fund(&stream, c.funded));
        let boss_before = env.zl_of(&env.boss.pubkey());

        for (n, &at) in c.takes.iter().enumerate() {
            env.set_time(start + at);
            if n == 0 {
                if let Some(e) = c.end_at {
                    ok(env.end(&stream, start + e));
                }
            }
            let available = available_now(&mut env, &stream, &oksana);
            if available > 0 {
                ok(env.withdraw(&stream, &oksana, available));
            }
        }

        if c.adjustment > 0 {
            let (_, with_consent) = cut_caps(&mut env, &stream);
            let amount = c.adjustment.min(with_consent);
            if amount > 0 {
                ok(env.propose(&stream, amount, 3));
                if c.accepted {
                    ok(env.accept_adjustment(&stream, &oksana, amount));
                }
            }
        }

        env.set_time(end);
        let anyone = env.wallet();
        let paid = settled(&ok(env.settle(&stream, &anyone)));
        let s = env.stream(&stream);
        let received = env.zl_of(&oksana.pubkey());

        assert_eq!(
            s.withdrawn + paid.pay_employee + paid.refund_emp,
            c.funded,
            "case {i}: every grosz accounted for"
        );
        assert_eq!(env.balance(&s.vault), 0, "case {i}: vault ends empty");
        assert_eq!(received, s.withdrawn + paid.pay_employee, "case {i}");
        assert_eq!(
            env.zl_of(&env.boss.pubkey()),
            boss_before + paid.refund_emp,
            "case {i}"
        );
        assert!(received <= c.funded, "case {i}: never above funding");
        // Exact earned is net * elapsed / duration; compare without rounding.
        let elapsed = c.end_at.unwrap_or(c.duration).min(c.duration);
        assert!(
            u128::from(received) * c.duration as u128 <= u128::from(c.net) * elapsed as u128,
            "case {i}: received {received} is more than exactly earned"
        );
        assert!(received <= paid.earned_final - paid.cut, "case {i}");
    }
}

#[test]
fn propose_adjustment_rules() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.fund(&stream, NET));
    assert_err(env.propose(&stream, 1_000, 1), DniowkaError::NotActive);
    ok(env.accept(&stream, &oksana));

    let stranger = env.wallet();
    let ix = env.ix_propose(&stranger.pubkey(), &env.employer, &stream, 1_000, 1);
    assert_err(env.send(&[ix], &stranger, &[]), DniowkaError::NotEmployer);
    assert_err(
        env.propose(&stream, 1_000, 0),
        DniowkaError::InvalidAdjustmentReason,
    );
    assert_err(
        env.propose(&stream, 1_000, 5),
        DniowkaError::InvalidAdjustmentReason,
    );
    assert_err(env.propose(&stream, 0, 1), DniowkaError::ZeroAmount);

    // Never below what was already taken: 600 000 − 80 000 is the most.
    env.set_time(day(12));
    ok(env.withdraw(&stream, &oksana, 80_000));
    assert_err(
        env.propose(&stream, 520_001, 3),
        DniowkaError::AdjustmentTooLarge,
    );
    ok(env.propose(&stream, 520_000, 3));
    // An ended contract shrinks the cap: earned to day 15 is 300 000.
    ok(env.end(&stream, day(15)));
    assert_eq!(cut_caps(&mut env, &stream), (90_000, 220_000));

    env.set_time(day(30));
    assert_err(
        env.propose(&stream, 1_000, 1),
        DniowkaError::AdjustmentClosed,
    );
}

/// Fixes the M2 known limitation: a new proposal needs fresh consent.
#[test]
fn a_new_proposal_needs_fresh_consent() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    env.set_time(day(5));

    assert_err(
        env.accept_adjustment(&stream, &oksana, 0),
        DniowkaError::NoAdjustment,
    );
    ok(env.propose(&stream, 100_000, 1));
    let stranger = env.wallet();
    assert_err(
        env.accept_adjustment(&stream, &stranger, 100_000),
        DniowkaError::NotEmployee,
    );
    ok(env.accept_adjustment(&stream, &oksana, 100_000));
    assert!(env.stream(&stream).adjustment_accepted);

    // The employer swaps in a bigger cut: consent is gone, and a stale consent fails.
    ok(env.propose(&stream, 400_000, 4));
    assert!(!env.stream(&stream).adjustment_accepted);
    assert_err(
        env.accept_adjustment(&stream, &oksana, 100_000),
        DniowkaError::AdjustmentChanged,
    );

    env.set_time(day(30));
    let anyone = env.wallet();
    let paid = settled(&ok(env.settle(&stream, &anyone)));
    assert_eq!(paid.cut, 180_000, "unaccepted: only down to the floor");
    assert_eq!(env.zl_of(&oksana.pubkey()), 420_000);
}

#[test]
fn cancel_unaccepted_refunds_after_the_grace_period() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.fund(&stream, NET));
    let boss_before = env.zl_of(&env.boss.pubkey());

    // Grace = 1/10 of the period: 3 days.
    env.set_time(day(3) - 1);
    assert_err(env.cancel(&stream), DniowkaError::CancelTooEarly);
    let stranger = env.wallet();
    let ix = env.ix_cancel(&stranger.pubkey(), &env.employer, &stream);
    assert_err(env.send(&[ix], &stranger, &[]), DniowkaError::NotEmployer);

    env.set_time(day(3));
    let meta = ok(env.cancel(&stream));
    let cancelled = events::<ev::StreamCancelled>(&meta);
    assert_eq!(cancelled.len(), 1);
    assert_eq!(cancelled[0].refund_emp, NET);
    assert_eq!(env.zl_of(&env.boss.pubkey()), boss_before + NET);
    let s = env.stream(&stream);
    assert_eq!(s.status, StreamStatus::Cancelled);
    assert_eq!(env.balance(&s.vault), 0);

    assert_err(env.cancel(&stream), DniowkaError::NotInvited);
    assert_err(env.accept(&stream, &oksana), DniowkaError::NotInvited);
    assert_err(env.fund(&stream, 1), DniowkaError::NotActive);
    let anyone = env.wallet();
    assert_err(env.settle(&stream, &anyone), DniowkaError::NotActive);
}

#[test]
fn an_accepted_salary_cannot_be_cancelled() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.fund(&stream, NET));
    ok(env.accept(&stream, &oksana));
    env.set_time(day(20));
    assert_err(env.cancel(&stream), DniowkaError::NotInvited);
}
