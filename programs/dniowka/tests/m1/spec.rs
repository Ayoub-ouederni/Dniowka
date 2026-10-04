//! Program tests from spec §5.4 (M1: 1, 2, 3, 4, 5, 7, 8, 9).
//! Reference stream: 6 000,00 zł, 30 days from `T`, floor 70 %. Amounts in grosze.

use anchor_spl::token_2022::{spl_token_2022, ID as TOKEN_2022};
use dniowka::{error::DniowkaError, events as ev, state::StreamStatus};
use litesvm_token::get_spl_account;
use solana_signer::Signer;

use crate::harness::*;

/// 1. create → accept → fund → withdraw (day 12) → settle; balances match §4.
#[test]
fn t1_happy_path() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    env.set_time(day(12));
    ok(env.withdraw(&stream, &oksana, 80_000));
    assert_eq!(env.zl_of(&oksana.pubkey()), 80_000);
    // Earned 240 000, floor 168 000, already taken 80 000: 88 000 left, not a grosz more.
    assert_err(
        env.withdraw(&stream, &oksana, 88_001),
        DniowkaError::ExceedsAvailable,
    );

    env.set_time(day(30));
    let anyone = env.wallet();
    let boss_before = env.zl_of(&env.boss.pubkey());
    let meta = ok(env.settle(&stream, &anyone));

    assert_eq!(
        env.zl_of(&oksana.pubkey()),
        NET,
        "80 000 taken + 520 000 on payday"
    );
    assert_eq!(
        env.zl_of(&env.boss.pubkey()),
        boss_before,
        "nothing to refund"
    );
    let s = env.stream(&stream);
    assert_eq!(env.balance(&s.vault), 0);
    assert_eq!(s.withdrawn, 80_000);
    assert_eq!(s.status, StreamStatus::Settled);
    let settled = events::<ev::Settled>(&meta);
    assert_eq!(settled.len(), 1);
    assert_eq!(
        (
            settled[0].pay_employee,
            settled[0].refund_emp,
            settled[0].shortfall
        ),
        (520_000, 0, 0)
    );
    assert!(events::<ev::WageShortfall>(&meta).is_empty());

    assert_err(
        env.create_stream(None, NET, T, day(30), day(30), 10_001),
        DniowkaError::InvalidFloor,
    );
}

/// 2. Withdraw more than available → ExceedsAvailable, exactly at the floor boundary.
#[test]
fn t2_withdraw_more_than_available() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    env.set_time(day(12));
    assert_err(
        env.withdraw(&stream, &oksana, 500_000),
        DniowkaError::ExceedsAvailable,
    );
    assert_err(
        env.withdraw(&stream, &oksana, 168_001),
        DniowkaError::ExceedsAvailable,
    );
    ok(env.withdraw(&stream, &oksana, 168_000));
    assert_err(
        env.withdraw(&stream, &oksana, 1),
        DniowkaError::ExceedsAvailable,
    );
    assert_eq!(env.zl_of(&oksana.pubkey()), 168_000);
}

/// 3. Underfunded: withdrawals are limited by what the employer actually locked.
#[test]
fn t3_underfunded_stream() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.fund(&stream, 100_000)); // the demo order: fund while still invited
    ok(env.accept(&stream, &oksana));

    env.set_time(day(12));
    assert_err(
        env.withdraw(&stream, &oksana, 100_001),
        DniowkaError::ExceedsAvailable,
    );
    ok(env.withdraw(&stream, &oksana, 100_000));
    assert_err(env.fund(&stream, 500_001), DniowkaError::Overfunded);

    env.set_time(day(30));
    let anyone = env.wallet();
    let meta = ok(env.settle(&stream, &anyone));
    let settled = events::<ev::Settled>(&meta);
    assert_eq!(
        (
            settled[0].pay_employee,
            settled[0].refund_emp,
            settled[0].shortfall
        ),
        (0, 0, 500_000)
    );
    let shortfall = events::<ev::WageShortfall>(&meta);
    assert_eq!(shortfall.len(), 1);
    assert_eq!(shortfall[0].shortfall, 500_000);
    assert_eq!(env.zl_of(&oksana.pubkey()), 100_000);
}

/// 4. end_employment with a past timestamp → BackdatingNotAllowed.
#[test]
fn t4_no_backdating() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    env.set_time(day(5));
    assert_err(
        env.end(&stream, day(5) - 1),
        DniowkaError::BackdatingNotAllowed,
    );
    assert_eq!(env.stream(&stream).end_ts, None);
    ok(env.end(&stream, day(5)));
    assert_eq!(env.stream(&stream).end_ts, Some(day(5)));
}

/// 5. End mid-period → settle pays earned to that date, refunds the rest to the employer.
#[test]
fn t5_end_mid_period() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    env.set_time(day(12));
    ok(env.withdraw(&stream, &oksana, 80_000));
    ok(env.end(&stream, day(15)));

    env.set_time(day(13));
    assert_err(
        env.end(&stream, day(14)),
        DniowkaError::EndDateCannotMoveEarlier,
    );

    // Earned stops at day 15: 300 000, floor 210 000, minus 80 000 taken = 130 000.
    env.set_time(day(20));
    assert_err(
        env.withdraw(&stream, &oksana, 130_001),
        DniowkaError::ExceedsAvailable,
    );

    env.set_time(day(30));
    let anyone = env.wallet();
    let boss_before = env.zl_of(&env.boss.pubkey());
    let meta = ok(env.settle(&stream, &anyone));
    let settled = events::<ev::Settled>(&meta);
    assert_eq!(
        (
            settled[0].pay_employee,
            settled[0].refund_emp,
            settled[0].shortfall
        ),
        (220_000, 300_000, 0)
    );
    assert_eq!(env.zl_of(&oksana.pubkey()), 300_000);
    assert_eq!(env.zl_of(&env.boss.pubkey()), boss_before + 300_000);
    assert_eq!(env.balance(&env.stream(&stream).vault), 0);
}

/// 7. settle before payday fails; at payday it succeeds from a random third-party wallet.
#[test]
fn t7_payday_is_permissionless_and_on_time() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let payday = day(30) + 10 * DAY;
    let stream = env.reference_stream(Some(oksana.pubkey()), payday);
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    let oksana_account = ata(&oksana.pubkey(), &env.mint);
    assert!(env.svm.get_account(&oksana_account).is_none());

    let stranger = env.wallet();
    env.set_time(day(30));
    assert_err(
        env.settle(&stream, &stranger),
        DniowkaError::TooEarlyForPayday,
    );
    env.set_time(payday - 1);
    assert_err(
        env.settle(&stream, &stranger),
        DniowkaError::TooEarlyForPayday,
    );

    env.set_time(payday);
    let redirect = env.ix_settle(
        &stream,
        &stranger.pubkey(),
        &stranger.pubkey(),
        &env.boss.pubkey(),
    );
    assert_err(
        env.send(&[redirect], &stranger, &[]),
        DniowkaError::NotEmployee,
    );

    let meta = ok(env.settle(&stream, &stranger));
    assert_eq!(env.balance(&oksana_account), NET);
    assert_eq!(env.zl_of(&stranger.pubkey()), 0);
    assert_eq!(env.stream(&stream).status, StreamStatus::Settled);
    // Creating a payout account, a memo and a transfer must stay well inside the
    // default 200 000 compute-unit budget, so clients need no budget instruction.
    assert!(
        meta.compute_units_consumed < 100_000,
        "settle used {} compute units",
        meta.compute_units_consumed
    );
}

/// 8. The employer has no way to take money out of a vault.
#[test]
fn t8_employer_cannot_take_from_the_vault() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    env.set_time(day(12));

    let vault = env.stream(&stream).vault;
    let vault_state = get_spl_account::<spl_token_2022::state::Account>(&env.svm, &vault).unwrap();
    assert_eq!(
        vault_state.owner, stream,
        "token authority is the stream PDA"
    );
    assert!(vault_state.delegate.is_none());
    assert!(vault_state.close_authority.is_none());

    let boss = env.boss.insecure_clone();
    assert_err(
        env.withdraw(&stream, &boss, 100),
        DniowkaError::PaymentLocked,
    );

    let steal = spl_token_2022::instruction::transfer_checked(
        &TOKEN_2022,
        &vault,
        &env.mint,
        &ata(&boss.pubkey(), &env.mint),
        &boss.pubkey(),
        &[],
        100,
        2,
    )
    .unwrap();
    assert!(env.send(&[steal], &boss, &[]).is_err());
    assert_eq!(env.balance(&vault), NET);
}

/// 9. Double settle → AlreadySettled; nothing can be added afterwards either.
#[test]
fn t9_double_settle() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    env.set_time(day(30));
    let anyone = env.wallet();
    ok(env.settle(&stream, &anyone));
    assert_err(env.settle(&stream, &anyone), DniowkaError::AlreadySettled);
    assert_err(env.fund(&stream, 1), DniowkaError::AlreadySettled);
    assert_eq!(env.zl_of(&oksana.pubkey()), NET);
}
