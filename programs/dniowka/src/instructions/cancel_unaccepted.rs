use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    memo::{build_memo, BuildMemo, Memo},
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::{CANCEL_MEMO, GRACE_DIVISOR, STREAM_SEED},
    error::DniowkaError,
    events::StreamCancelled,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct CancelUnaccepted<'info> {
    /// The employer; also pays rent if their refund account does not exist.
    #[account(mut)]
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
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub employer_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub memo_program: Program<'info, Memo>,
    pub system_program: Program<'info, System>,
}

/// An invite nobody accepted would otherwise lock its funding forever. After a grace period
/// (a tenth of the pay period) the employer gets exactly what they funded back.
/// Once the employee has joined, this path is closed for good.
pub fn handle_cancel_unaccepted(ctx: Context<CancelUnaccepted>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stream = &ctx.accounts.stream;
    require!(
        stream.status == StreamStatus::Invited,
        DniowkaError::NotInvited
    );
    // period_end > period_start (create_stream), so the grace is never negative.
    let grace = (stream.period_end - stream.period_start) / GRACE_DIVISOR;
    let allowed_from = stream
        .period_start
        .checked_add(grace)
        .ok_or(DniowkaError::MathOverflow)?;
    msg!("cancel allowed from {}", allowed_from);
    require!(now >= allowed_from, DniowkaError::CancelTooEarly);

    let refund = stream.funded;
    if refund > 0 {
        let id_bytes = stream.id.to_le_bytes();
        let seeds: &[&[u8]] = &[
            STREAM_SEED,
            stream.employer.as_ref(),
            &id_bytes,
            &[stream.bump],
        ];
        let accounts = &ctx.accounts;
        build_memo(
            CpiContext::new(accounts.memo_program.key(), BuildMemo {}),
            CANCEL_MEMO,
        )?;
        transfer_checked(
            CpiContext::new_with_signer(
                accounts.token_program.key(),
                TransferChecked {
                    from: accounts.vault.to_account_info(),
                    mint: accounts.mint.to_account_info(),
                    to: accounts.employer_token.to_account_info(),
                    authority: accounts.stream.to_account_info(),
                },
                &[seeds],
            ),
            refund,
            accounts.mint.decimals,
        )?;
    }

    let stream = &mut ctx.accounts.stream;
    stream.status = StreamStatus::Cancelled;
    emit!(StreamCancelled {
        stream: stream.key(),
        refund_emp: refund,
        timestamp: now,
    });
    Ok(())
}
