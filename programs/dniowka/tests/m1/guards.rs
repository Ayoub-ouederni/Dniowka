//! Guard tests beyond spec §5.4: each protects a hard rule or an agreed design decision.

use anchor_lang::{prelude::Pubkey, solana_program::system_instruction};
use anchor_spl::{
    token::ID as CLASSIC_TOKEN,
    token_2022::{
        spl_token_2022::{
            self,
            extension::{memo_transfer, ExtensionType},
            state::Mint,
        },
        ID as TOKEN_2022,
    },
};
use dniowka::{error::DniowkaError, state::StreamStatus};
use litesvm_token::{CreateAssociatedTokenAccount, CreateMint};
use solana_keypair::Keypair;
use solana_signer::Signer;

use crate::harness::*;

#[test]
fn accept_respects_the_invite_hint() {
    let mut env = Env::new();
    let (a, b) = (env.wallet(), env.wallet());
    let stream = env.reference_stream(Some(a.pubkey()), day(30));

    assert_err(env.accept(&stream, &b), DniowkaError::NotEmployee);
    ok(env.accept(&stream, &a));
    assert_err(env.accept(&stream, &b), DniowkaError::NotInvited);

    let s = env.stream(&stream);
    assert_eq!(s.employee, a.pubkey());
    assert_eq!(s.status, StreamStatus::Active);
}

#[test]
fn open_invite_binds_the_first_signer() {
    let mut env = Env::new();
    let (b, c) = (env.wallet(), env.wallet());
    let open = env.reference_stream(None, day(30));
    ok(env.accept(&open, &b));
    assert_eq!(env.stream(&open).employee, b.pubkey());

    // An explicit default key is the same as no hint.
    let also_open = env.reference_stream(Some(Pubkey::default()), day(30));
    ok(env.accept(&also_open, &c));
    assert_eq!(env.stream(&also_open).employee, c.pubkey());
}

#[test]
fn employer_cannot_be_their_own_employee() {
    let mut env = Env::new();
    let boss = env.boss.insecure_clone();
    let open = env.reference_stream(None, day(30));
    assert_err(
        env.accept(&open, &boss),
        DniowkaError::EmployerCannotBeEmployee,
    );
    assert_err(
        env.create_stream(Some(boss.pubkey()), NET, T, day(30), day(30), FLOOR_BPS),
        DniowkaError::EmployerCannotBeEmployee,
    );
}

#[test]
fn only_the_employer_can_end_employment() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));

    // A stranger with an Employer account of their own.
    let stranger = env.wallet();
    let init = env.ix_init_employer(&stranger.pubkey(), &stranger.pubkey(), &env.mint, FLOOR_BPS);
    ok(env.send(&[init], &stranger, &[]));
    let own = env.ix_end(
        &stranger.pubkey(),
        &employer_pda(&stranger.pubkey()),
        &stream,
        T,
    );
    assert_err(env.send(&[own], &stranger, &[]), DniowkaError::NotEmployer);
    let borrowed = env.ix_end(&stranger.pubkey(), &env.employer, &stream, T);
    assert_err(
        env.send(&[borrowed], &stranger, &[]),
        DniowkaError::NotEmployer,
    );

    let by_employee = env.ix_end(&oksana.pubkey(), &env.employer, &stream, T);
    assert_err(
        env.send(&[by_employee], &oksana, &[]),
        DniowkaError::NotEmployer,
    );
    assert_eq!(env.stream(&stream).end_ts, None);
}

#[test]
fn invited_stream_pays_nothing_until_accepted() {
    let mut env = Env::new();
    let a = env.wallet();
    let stream = env.reference_stream(Some(a.pubkey()), day(30));
    ok(env.fund(&stream, NET));

    env.set_time(day(12));
    assert_err(env.withdraw(&stream, &a, 1), DniowkaError::NotActive);
    env.set_time(day(30));
    let anyone = env.wallet();
    assert_err(env.settle(&stream, &anyone), DniowkaError::NotActive);
    assert_eq!(env.balance(&env.stream(&stream).vault), NET);
}

fn init_employer_with(env: &mut Env, boss: &Keypair, mint: &Pubkey) -> TxResult {
    let ix = env.ix_init_employer(&boss.pubkey(), &boss.pubkey(), mint, FLOOR_BPS);
    env.send(&[ix], boss, &[])
}

#[test]
fn mint_with_freeze_authority_is_rejected() {
    let mut env = Env::bare();
    let boss = env.wallet();
    let mint = CreateMint::new(&mut env.svm, &boss)
        .decimals(2)
        .freeze_authority(&boss.pubkey())
        .token_program_id(&TOKEN_2022)
        .send()
        .unwrap();
    assert_err(
        init_employer_with(&mut env, &boss, &mint),
        DniowkaError::UnsupportedMint,
    );
}

#[test]
fn mint_with_permanent_delegate_is_rejected() {
    let mut env = Env::bare();
    let boss = env.wallet();
    let mint = Keypair::new();
    let len = ExtensionType::try_calculate_account_len::<Mint>(&[ExtensionType::PermanentDelegate])
        .unwrap();
    let ixs = [
        system_instruction::create_account(
            &boss.pubkey(),
            &mint.pubkey(),
            env.svm.minimum_balance_for_rent_exemption(len),
            len as u64,
            &TOKEN_2022,
        ),
        spl_token_2022::instruction::initialize_permanent_delegate(
            &TOKEN_2022,
            &mint.pubkey(),
            &boss.pubkey(),
        )
        .unwrap(),
        spl_token_2022::instruction::initialize_mint2(
            &TOKEN_2022,
            &mint.pubkey(),
            &boss.pubkey(),
            None,
            2,
        )
        .unwrap(),
    ];
    ok(env.send(&ixs, &boss, &[&mint]));
    assert_err(
        init_employer_with(&mut env, &boss, &mint.pubkey()),
        DniowkaError::UnsupportedMint,
    );
}

#[test]
fn classic_token_mint_is_rejected() {
    let mut env = Env::bare();
    let boss = env.wallet();
    let mint = CreateMint::new(&mut env.svm, &boss)
        .decimals(2)
        .token_program_id(&CLASSIC_TOKEN)
        .send()
        .unwrap();
    assert_err(
        init_employer_with(&mut env, &boss, &mint),
        DniowkaError::UnsupportedMint,
    );
}

/// Either party switching on "required memo" for incoming transfers must not block payday.
#[test]
fn required_memos_cannot_block_payday() {
    let mut env = Env::new();
    let oksana = env.wallet();
    let stream = env.reference_stream(Some(oksana.pubkey()), day(30));
    ok(env.accept(&stream, &oksana));
    ok(env.fund(&stream, NET));
    env.set_time(day(12));
    ok(env.end(&stream, day(15))); // so a refund to the employer is due

    let oksana_account = CreateAssociatedTokenAccount::new(&mut env.svm, &oksana, &env.mint)
        .owner(&oksana.pubkey())
        .token_program_id(&TOKEN_2022)
        .send()
        .unwrap();
    let boss = env.boss.insecure_clone();
    for (owner, account) in [
        (&boss, ata(&boss.pubkey(), &env.mint)),
        (&oksana, oksana_account),
    ] {
        let ixs = [
            spl_token_2022::instruction::reallocate(
                &TOKEN_2022,
                &account,
                &owner.pubkey(),
                &owner.pubkey(),
                &[],
                &[ExtensionType::MemoTransfer],
            )
            .unwrap(),
            memo_transfer::instruction::enable_required_transfer_memos(
                &TOKEN_2022,
                &account,
                &owner.pubkey(),
                &[],
            )
            .unwrap(),
        ];
        ok(env.send(&ixs, owner, &[]));
    }

    env.set_time(day(30));
    let anyone = env.wallet();
    let boss_before = env.zl_of(&boss.pubkey());
    ok(env.settle(&stream, &anyone));
    assert_eq!(env.balance(&oksana_account), 300_000);
    assert_eq!(env.zl_of(&boss.pubkey()), boss_before + 300_000);
}
