//! LiteSVM test harness: one program instance, an exact clock, a clean Token-2022 zł mint
//! and one helper per instruction.

use std::path::Path;

use anchor_lang::{
    prelude::{Clock, Pubkey},
    solana_program::{instruction::Instruction, system_program},
    AccountDeserialize, AnchorDeserialize, Event, InstructionData, ToAccountMetas,
};
use anchor_spl::{
    associated_token::{self, get_associated_token_address_with_program_id},
    memo,
    token_2022::{spl_token_2022, ID as TOKEN_2022},
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use dniowka::{
    error::DniowkaError,
    state::{Employer, Stream},
    EMPLOYER_SEED, STREAM_SEED, VAULT_SEED,
};
use litesvm::{
    types::{FailedTransactionMetadata, TransactionMetadata},
    LiteSVM,
};
use litesvm_token::{get_spl_account, CreateAssociatedTokenAccount, CreateMint, MintTo};
use solana_instruction::error::InstructionError;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;
use solana_transaction_error::TransactionError;

pub type TxResult = Result<TransactionMetadata, FailedTransactionMetadata>;

pub const DAY: i64 = 86_400;
/// Fixed start of every reference period (2027-01-15).
pub const T: i64 = 1_800_000_000;
/// 6 000,00 zł in grosze.
pub const NET: u64 = 600_000;
pub const FLOOR_BPS: u16 = 7_000;
const SOL: u64 = 1_000_000_000;
/// What the employer holds before funding anything: 100 000,00 zł.
const EMPLOYER_ZL: u64 = 10_000_000;

pub fn day(n: i64) -> i64 {
    T + n * DAY
}

pub fn employer_pda(authority: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[EMPLOYER_SEED, authority.as_ref()], &dniowka::ID).0
}

pub fn stream_pda(employer: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[STREAM_SEED, employer.as_ref(), &id.to_le_bytes()],
        &dniowka::ID,
    )
    .0
}

pub fn vault_pda(stream: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[VAULT_SEED, stream.as_ref()], &dniowka::ID).0
}

pub fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, &TOKEN_2022)
}

/// Asserts the transaction failed with exactly this program error in instruction `ix`.
pub fn assert_err_at<T: std::fmt::Debug>(
    res: Result<T, FailedTransactionMetadata>,
    ix: u8,
    expected: DniowkaError,
) {
    let failed = res.expect_err("transaction should have failed");
    assert_eq!(
        failed.err,
        TransactionError::InstructionError(ix, InstructionError::Custom(u32::from(expected))),
        "logs:\n{}",
        failed.meta.pretty_logs()
    );
}

pub fn assert_err<T: std::fmt::Debug>(
    res: Result<T, FailedTransactionMetadata>,
    expected: DniowkaError,
) {
    assert_err_at(res, 0, expected);
}

pub fn ok(res: TxResult) -> TransactionMetadata {
    res.unwrap_or_else(|f| panic!("{:?}\nlogs:\n{}", f.err, f.meta.pretty_logs()))
}

/// Decodes every `emit!`ed event of type `E` from the transaction logs.
pub fn events<E: Event + AnchorDeserialize>(meta: &TransactionMetadata) -> Vec<E> {
    meta.logs
        .iter()
        .filter_map(|line| line.strip_prefix("Program data: "))
        .filter_map(|b64| BASE64.decode(b64).ok())
        .filter(|data| data.starts_with(E::DISCRIMINATOR))
        .map(|data| E::try_from_slice(&data[E::DISCRIMINATOR.len()..]).expect("event decodes"))
        .collect()
}

pub struct Env {
    pub svm: LiteSVM,
    /// Employer wallet: signs as authority and pays rent and fees for employer actions.
    pub boss: Keypair,
    pub mint: Pubkey,
    pub employer: Pubkey,
}

impl Env {
    /// Program loaded, clock at `T`, clean zł mint, employer registered and holding zł.
    pub fn new() -> Self {
        let mut env = Self::bare();
        let boss = env.wallet();
        let mint = env.clean_mint(&boss);
        let source = CreateAssociatedTokenAccount::new(&mut env.svm, &boss, &mint)
            .owner(&boss.pubkey())
            .token_program_id(&TOKEN_2022)
            .send()
            .unwrap();
        MintTo::new(&mut env.svm, &boss, &mint, &source, EMPLOYER_ZL)
            .token_program_id(&TOKEN_2022)
            .send()
            .unwrap();
        let employer = employer_pda(&boss.pubkey());
        env.boss = boss;
        env.mint = mint;
        env.employer = employer;
        let ix = env.ix_init_employer(&env.boss.pubkey(), &env.boss.pubkey(), &mint, FLOOR_BPS);
        let boss = env.boss.insecure_clone();
        ok(env.send(&[ix], &boss, &[]));
        env
    }

    /// Program loaded and clock at `T`; nothing else.
    pub fn bare() -> Self {
        let mut svm = LiteSVM::new();
        let so = concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/dniowka.so");
        assert!(
            Path::new(so).exists(),
            "{so} is missing: run `anchor build` first"
        );
        svm.add_program_from_file(dniowka::ID, so)
            .unwrap_or_else(|e| {
                panic!("cannot load {so}: {e:?} (built as SBPF v3? set ANCHOR_BUILD_SBF_ARCH=v2)")
            });
        let mut env = Self {
            svm,
            boss: Keypair::new(),
            mint: Pubkey::default(),
            employer: Pubkey::default(),
        };
        env.set_time(T);
        env
    }

    pub fn set_time(&mut self, unix_timestamp: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp = unix_timestamp;
        self.svm.set_sysvar(&clock);
    }

    /// A funded wallet (10 SOL) for fees and rent.
    pub fn wallet(&mut self) -> Keypair {
        let kp = Keypair::new();
        self.svm.expire_blockhash();
        self.svm.airdrop(&kp.pubkey(), 10 * SOL).unwrap();
        kp
    }

    /// Token-2022, 2 decimals, no freeze authority, no extensions.
    pub fn clean_mint(&mut self, authority: &Keypair) -> Pubkey {
        self.svm.expire_blockhash();
        CreateMint::new(&mut self.svm, authority)
            .decimals(2)
            .token_program_id(&TOKEN_2022)
            .send()
            .unwrap()
    }

    /// Sends with a fresh blockhash, so an identical retry reaches the program
    /// instead of being rejected as already processed.
    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, others: &[&Keypair]) -> TxResult {
        self.svm.expire_blockhash();
        let mut signers = vec![payer];
        signers.extend_from_slice(others);
        let tx = Transaction::new_signed_with_payer(
            ixs,
            Some(&payer.pubkey()),
            &signers,
            self.svm.latest_blockhash(),
        );
        self.svm.send_transaction(tx)
    }

    pub fn stream(&self, stream: &Pubkey) -> Stream {
        let account = self.svm.get_account(stream).expect("stream exists");
        Stream::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    pub fn employer_account(&self, employer: &Pubkey) -> Employer {
        let account = self.svm.get_account(employer).expect("employer exists");
        Employer::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    /// Token balance, 0 if the account does not exist.
    pub fn balance(&self, token_account: &Pubkey) -> u64 {
        get_spl_account::<spl_token_2022::state::Account>(&self.svm, token_account)
            .map(|a| a.amount)
            .unwrap_or(0)
    }

    pub fn zl_of(&self, owner: &Pubkey) -> u64 {
        self.balance(&ata(owner, &self.mint))
    }

    // ---------------------------------------------------------------- instructions

    pub fn ix_init_employer(
        &self,
        payer: &Pubkey,
        authority: &Pubkey,
        mint: &Pubkey,
        default_floor_bps: u16,
    ) -> Instruction {
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::InitEmployer { default_floor_bps }.data(),
            dniowka::accounts::InitEmployer {
                payer: *payer,
                authority: *authority,
                employer: employer_pda(authority),
                mint: *mint,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    /// `create_stream` by the employer for its next stream id.
    pub fn ix_create_stream(
        &self,
        hint: Option<Pubkey>,
        net_amount: u64,
        period_start: i64,
        period_end: i64,
        payday: i64,
        floor_bps: u16,
    ) -> (Instruction, Pubkey) {
        let id = self.employer_account(&self.employer).stream_count;
        let stream = stream_pda(&self.employer, id);
        let ix = Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::CreateStream {
                employee_hint: hint,
                net_amount,
                period_start,
                period_end,
                payday,
                floor_bps,
            }
            .data(),
            dniowka::accounts::CreateStream {
                payer: self.boss.pubkey(),
                authority: self.boss.pubkey(),
                employer: self.employer,
                stream,
                vault: vault_pda(&stream),
                mint: self.mint,
                token_program: TOKEN_2022,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        (ix, stream)
    }

    pub fn create_stream(
        &mut self,
        hint: Option<Pubkey>,
        net_amount: u64,
        period_start: i64,
        period_end: i64,
        payday: i64,
        floor_bps: u16,
    ) -> Result<Pubkey, FailedTransactionMetadata> {
        let (ix, stream) = self.ix_create_stream(
            hint,
            net_amount,
            period_start,
            period_end,
            payday,
            floor_bps,
        );
        let boss = self.boss.insecure_clone();
        self.send(&[ix], &boss, &[]).map(|_| stream)
    }

    /// Reference stream from spec §4: 6 000 zł over 30 days from `T`, floor 70 %.
    pub fn reference_stream(&mut self, hint: Option<Pubkey>, payday: i64) -> Pubkey {
        self.create_stream(hint, NET, T, day(30), payday, FLOOR_BPS)
            .unwrap_or_else(|f| panic!("{:?}\n{}", f.err, f.meta.pretty_logs()))
    }

    pub fn ix_accept(&self, stream: &Pubkey, employee: &Pubkey) -> Instruction {
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::AcceptStream {
                income_commitment: [0; 32],
            }
            .data(),
            dniowka::accounts::AcceptStream {
                employee: *employee,
                stream: *stream,
                employer: self.stream(stream).employer,
            }
            .to_account_metas(None),
        )
    }

    pub fn accept(&mut self, stream: &Pubkey, employee: &Keypair) -> TxResult {
        let ix = self.ix_accept(stream, &employee.pubkey());
        self.send(&[ix], employee, &[])
    }

    pub fn ix_fund(
        &self,
        authority: &Pubkey,
        employer: &Pubkey,
        stream: &Pubkey,
        amount: u64,
    ) -> Instruction {
        let s = self.stream(stream);
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::FundStream { amount }.data(),
            dniowka::accounts::FundStream {
                authority: *authority,
                employer: *employer,
                stream: *stream,
                vault: s.vault,
                mint: s.mint,
                source: ata(authority, &s.mint),
                token_program: TOKEN_2022,
            }
            .to_account_metas(None),
        )
    }

    pub fn fund(&mut self, stream: &Pubkey, amount: u64) -> TxResult {
        let ix = self.ix_fund(&self.boss.pubkey(), &self.employer, stream, amount);
        let boss = self.boss.insecure_clone();
        self.send(&[ix], &boss, &[])
    }

    pub fn ix_withdraw(&self, stream: &Pubkey, signer: &Pubkey, amount: u64) -> Instruction {
        let s = self.stream(stream);
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::WithdrawEarned { amount }.data(),
            dniowka::accounts::WithdrawEarned {
                payer: *signer,
                employee: *signer,
                stream: *stream,
                vault: s.vault,
                mint: s.mint,
                destination: ata(signer, &s.mint),
                token_program: TOKEN_2022,
                associated_token_program: associated_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    pub fn withdraw(&mut self, stream: &Pubkey, employee: &Keypair, amount: u64) -> TxResult {
        let ix = self.ix_withdraw(stream, &employee.pubkey(), amount);
        self.send(&[ix], employee, &[])
    }

    pub fn ix_end(
        &self,
        authority: &Pubkey,
        employer: &Pubkey,
        stream: &Pubkey,
        end_ts: i64,
    ) -> Instruction {
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::EndEmployment { end_ts }.data(),
            dniowka::accounts::EndEmployment {
                authority: *authority,
                employer: *employer,
                stream: *stream,
            }
            .to_account_metas(None),
        )
    }

    pub fn end(&mut self, stream: &Pubkey, end_ts: i64) -> TxResult {
        let ix = self.ix_end(&self.boss.pubkey(), &self.employer, stream, end_ts);
        let boss = self.boss.insecure_clone();
        self.send(&[ix], &boss, &[])
    }

    /// `settle` sent by `caller`, paying `employee` and refunding `employer_wallet`.
    pub fn ix_settle(
        &self,
        stream: &Pubkey,
        caller: &Pubkey,
        employee: &Pubkey,
        employer_wallet: &Pubkey,
    ) -> Instruction {
        let s = self.stream(stream);
        Instruction::new_with_bytes(
            dniowka::ID,
            &dniowka::instruction::Settle {}.data(),
            dniowka::accounts::Settle {
                payer: *caller,
                stream: *stream,
                employer: s.employer,
                employee: *employee,
                employer_authority: *employer_wallet,
                vault: s.vault,
                mint: s.mint,
                employee_token: ata(employee, &s.mint),
                employer_token: ata(employer_wallet, &s.mint),
                token_program: TOKEN_2022,
                associated_token_program: associated_token::ID,
                memo_program: memo::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        )
    }

    /// `settle` with the stream's real parties, sent by `caller`.
    pub fn settle(&mut self, stream: &Pubkey, caller: &Keypair) -> TxResult {
        let employee = self.stream(stream).employee;
        let ix = self.ix_settle(stream, &caller.pubkey(), &employee, &self.boss.pubkey());
        self.send(&[ix], caller, &[])
    }
}
