use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::*,
    error::DniowkaError,
    events::StreamCreated,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct CreateStream<'info> {
    /// Pays rent only.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority @ DniowkaError::NotEmployer,
        has_one = mint,
    )]
    pub employer: Box<Account<'info, Employer>>,
    #[account(
        init,
        payer = payer,
        space = 8 + Stream::INIT_SPACE,
        seeds = [STREAM_SEED, employer.key().as_ref(), employer.stream_count.to_le_bytes().as_ref()],
        bump
    )]
    pub stream: Box<Account<'info, Stream>>,
    #[account(
        init,
        payer = payer,
        seeds = [VAULT_SEED, stream.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = stream,
        token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_stream(
    ctx: Context<CreateStream>,
    employee_hint: Option<Pubkey>,
    net_amount: u64,
    period_start: i64,
    period_end: i64,
    payday: i64,
    floor_bps: u16,
) -> Result<()> {
    require!(net_amount > 0, DniowkaError::ZeroAmount);
    require!(period_end > period_start, DniowkaError::InvalidPeriod);
    let latest_payday = period_end
        .checked_add(MAX_PAYDAY_DELAY)
        .ok_or(DniowkaError::InvalidPayday)?;
    require!(
        payday >= period_end && payday <= latest_payday,
        DniowkaError::InvalidPayday
    );
    require!(
        (1..=BPS_DENOMINATOR).contains(&floor_bps),
        DniowkaError::InvalidFloor
    );
    // `Some(Pubkey::default())` means the same as no hint: an open invite.
    let hint = employee_hint.filter(|key| *key != Pubkey::default());
    require!(
        hint != Some(ctx.accounts.authority.key()),
        DniowkaError::EmployerCannotBeEmployee
    );

    let employer = &mut ctx.accounts.employer;
    let id = employer.stream_count;
    employer.stream_count = id.checked_add(1).ok_or(DniowkaError::MathOverflow)?;

    let stream_key = ctx.accounts.stream.key();
    ctx.accounts.stream.set_inner(Stream {
        employer: employer.key(),
        employee: hint.unwrap_or_default(),
        mint: ctx.accounts.mint.key(),
        vault: ctx.accounts.vault.key(),
        id,
        net_amount,
        period_start,
        period_end,
        payday,
        floor_bps,
        funded: 0,
        withdrawn: 0,
        end_ts: None,
        adjustment: 0,
        adjustment_reason: 0,
        adjustment_accepted: false,
        status: StreamStatus::Invited,
        income_commitment: [0; 32],
        bump: ctx.bumps.stream,
        vault_bump: ctx.bumps.vault,
    });

    emit!(StreamCreated {
        stream: stream_key,
        employer: employer.key(),
        id,
        employee_hint: hint,
        net_amount,
        period_start,
        period_end,
        payday,
        floor_bps,
    });
    Ok(())
}
