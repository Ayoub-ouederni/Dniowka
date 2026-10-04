use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    memo::{build_memo, BuildMemo, Memo},
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::{PAYDAY_MEMO, STREAM_SEED},
    error::DniowkaError,
    events::{Settled, WageShortfall},
    math,
    state::{Employer, Stream, StreamStatus},
};

/// Permissionless: anyone can trigger payday once it has come.
#[derive(Accounts)]
pub struct Settle<'info> {
    /// Whoever triggers payday; pays rent for any missing payout account.
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = employer, has_one = vault, has_one = mint)]
    pub stream: Box<Account<'info, Stream>>,
    pub employer: Box<Account<'info, Employer>>,
    /// CHECK: only the owner of the employee payout account; must be the stream's employee.
    #[account(address = stream.employee @ DniowkaError::NotEmployee)]
    pub employee: UncheckedAccount<'info>,
    /// CHECK: only the owner of the refund account; must be the employer's authority.
    #[account(address = employer.authority @ DniowkaError::NotEmployer)]
    pub employer_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = employee,
        associated_token::token_program = token_program,
    )]
    pub employee_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = employer_authority,
        associated_token::token_program = token_program,
    )]
    pub employer_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub memo_program: Program<'info, Memo>,
    pub system_program: Program<'info, System>,
}

/// Payday executes itself: the program computes the final split (spec §5.2),
/// pays the employee, refunds the unearned or unfunded rest to the employer and
/// records any shortfall publicly. Nobody approves anything.
pub fn handle_settle(ctx: Context<Settle>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stream = &ctx.accounts.stream;
    require!(
        stream.status != StreamStatus::Settled,
        DniowkaError::AlreadySettled
    );
    require!(
        stream.status == StreamStatus::Active,
        DniowkaError::NotActive
    );
    require!(now >= stream.payday, DniowkaError::TooEarlyForPayday);

    // Earned up to min(end_ts, period_end).
    let earned_final = stream.earned_final()?;
    let split = math::settle_split(
        earned_final,
        stream.floor_bps,
        stream.funded,
        stream.withdrawn,
        stream.adjustment,
        stream.adjustment_accepted,
    )?;

    let id_bytes = stream.id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        STREAM_SEED,
        stream.employer.as_ref(),
        &id_bytes,
        &[stream.bump],
    ];
    let accounts = &ctx.accounts;
    pay_out(
        accounts,
        &accounts.employee_token,
        split.pay_employee,
        seeds,
    )?;
    pay_out(accounts, &accounts.employer_token, split.refund_emp, seeds)?;

    let employer_authority = ctx.accounts.employer.authority;
    let stream = &mut ctx.accounts.stream;
    stream.status = StreamStatus::Settled;
    emit!(Settled {
        stream: stream.key(),
        pay_employee: split.pay_employee,
        refund_emp: split.refund_emp,
        shortfall: split.shortfall,
        earned_final,
        cut: split.cut,
        timestamp: now,
    });
    if split.shortfall > 0 {
        emit!(WageShortfall {
            stream: stream.key(),
            employer: employer_authority,
            employee: stream.employee,
            shortfall: split.shortfall,
        });
    }
    Ok(())
}

/// Vault → `to`, signed by the stream PDA. A zero amount is skipped, so an account
/// that would reject transfers can never block a payout it does not receive.
/// The memo right before the transfer satisfies accounts that require one.
fn pay_out<'info>(
    accounts: &Settle<'info>,
    to: &InterfaceAccount<'info, TokenAccount>,
    amount: u64,
    stream_seeds: &[&[u8]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    build_memo(
        CpiContext::new(accounts.memo_program.key(), BuildMemo {}),
        PAYDAY_MEMO,
    )?;
    transfer_checked(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            TransferChecked {
                from: accounts.vault.to_account_info(),
                mint: accounts.mint.to_account_info(),
                to: to.to_account_info(),
                authority: accounts.stream.to_account_info(),
            },
            &[stream_seeds],
        ),
        amount,
        accounts.mint.decimals,
    )
}
