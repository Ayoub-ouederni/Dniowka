use anchor_lang::prelude::*;

use crate::{
    error::DniowkaError,
    events::AdjustmentAccepted,
    state::{Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct AcceptAdjustment<'info> {
    pub employee: Signer<'info>,
    #[account(
        mut,
        constraint = stream.employee == employee.key() @ DniowkaError::NotEmployee,
    )]
    pub stream: Account<'info, Stream>,
}

/// Consent to exactly the amount the employee reviewed: if the employer replaced the
/// proposal in the meantime, this fails instead of accepting something unseen.
pub fn handle_accept_adjustment(ctx: Context<AcceptAdjustment>, amount: u64) -> Result<()> {
    let stream = &mut ctx.accounts.stream;
    require!(
        stream.status == StreamStatus::Active,
        DniowkaError::NotActive
    );
    require!(stream.adjustment > 0, DniowkaError::NoAdjustment);
    require!(amount == stream.adjustment, DniowkaError::AdjustmentChanged);

    stream.adjustment_accepted = true;
    emit!(AdjustmentAccepted {
        stream: stream.key(),
        employee: stream.employee,
        amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
