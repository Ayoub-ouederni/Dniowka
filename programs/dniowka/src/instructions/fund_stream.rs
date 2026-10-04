use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    error::DniowkaError,
    events::Funded,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct FundStream<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority @ DniowkaError::NotEmployer)]
    pub employer: Box<Account<'info, Employer>>,
    #[account(
        mut,
        has_one = employer @ DniowkaError::NotEmployer,
        has_one = vault,
        has_one = mint,
    )]
    pub stream: Box<Account<'info, Stream>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub source: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_fund_stream(ctx: Context<FundStream>, amount: u64) -> Result<()> {
    require!(amount > 0, DniowkaError::ZeroAmount);
    let stream = &ctx.accounts.stream;
    require!(
        stream.status != StreamStatus::Settled,
        DniowkaError::AlreadySettled
    );
    require!(
        matches!(stream.status, StreamStatus::Invited | StreamStatus::Active),
        DniowkaError::NotActive
    );
    require!(
        Clock::get()?.unix_timestamp < stream.payday,
        DniowkaError::FundingClosed
    );
    let funded = stream
        .funded
        .checked_add(amount)
        .ok_or(DniowkaError::Overfunded)?;
    require!(funded <= stream.net_amount, DniowkaError::Overfunded);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.source.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let stream = &mut ctx.accounts.stream;
    stream.funded = funded;
    emit!(Funded {
        stream: stream.key(),
        amount,
        funded,
    });
    Ok(())
}
