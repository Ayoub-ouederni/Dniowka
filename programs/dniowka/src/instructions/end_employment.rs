use anchor_lang::prelude::*;

use crate::{
    error::DniowkaError,
    events::EmploymentEnded,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct EndEmployment<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority @ DniowkaError::NotEmployer)]
    pub employer: Account<'info, Employer>,
    #[account(mut, has_one = employer @ DniowkaError::NotEmployer)]
    pub stream: Account<'info, Stream>,
}

/// Earned is earned: the end date can never be in the past and can only move later,
/// so ending employment never takes back a grosz that was already earned.
pub fn handle_end_employment(ctx: Context<EndEmployment>, end_ts: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stream = &mut ctx.accounts.stream;
    require!(
        stream.status == StreamStatus::Active,
        DniowkaError::NotActive
    );
    require!(end_ts >= now, DniowkaError::BackdatingNotAllowed);
    require!(end_ts <= stream.period_end, DniowkaError::InvalidEndDate);
    if let Some(current) = stream.end_ts {
        require!(end_ts > current, DniowkaError::EndDateCannotMoveEarlier);
    }

    stream.end_ts = Some(end_ts);
    emit!(EmploymentEnded {
        stream: stream.key(),
        end_ts,
        timestamp: now,
    });
    Ok(())
}
