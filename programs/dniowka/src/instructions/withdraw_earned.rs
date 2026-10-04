use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::STREAM_SEED,
    error::DniowkaError,
    events::Withdrawn,
    math,
    state::{Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct WithdrawEarned<'info> {
    /// Pays rent for the employee's token account if it does not exist yet.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub employee: Signer<'info>,
    #[account(
        mut,
        constraint = stream.employee == employee.key() @ DniowkaError::PaymentLocked,
        has_one = vault,
        has_one = mint,
    )]
    pub stream: Box<Account<'info, Stream>>,
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
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Where the intermediary disappears: the program computes what is already earned
/// and pays it out directly. No lender, no approval, no fee.
pub fn handle_withdraw_earned(ctx: Context<WithdrawEarned>, amount: u64) -> Result<()> {
    let stream = &ctx.accounts.stream;
    require!(
        stream.status != StreamStatus::Settled,
        DniowkaError::AlreadySettled
    );
    require!(
        stream.status == StreamStatus::Active,
        DniowkaError::NotActive
    );
    require!(amount > 0, DniowkaError::ZeroAmount);

    let now = Clock::get()?.unix_timestamp;
    let earned = math::earned(
        stream.net_amount,
        stream.period_start,
        stream.period_end,
        stream.end_ts,
        now,
    )?;
    let available = math::available(earned, stream.floor_bps, stream.funded, stream.withdrawn)?;
    msg!("earned {} available {}", earned, available);
    require!(amount <= available, DniowkaError::ExceedsAvailable);

    let id_bytes = stream.id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        STREAM_SEED,
        stream.employer.as_ref(),
        &id_bytes,
        &[stream.bump],
    ];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.stream.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let stream = &mut ctx.accounts.stream;
    // amount <= available <= funded - withdrawn, so this cannot overflow.
    stream.withdrawn = stream
        .withdrawn
        .checked_add(amount)
        .ok_or(DniowkaError::MathOverflow)?;
    emit!(Withdrawn {
        stream: stream.key(),
        employee: stream.employee,
        amount,
        withdrawn: stream.withdrawn,
        earned,
        available_after: available - amount,
        timestamp: now,
    });
    Ok(())
}
