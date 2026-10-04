use anchor_lang::prelude::*;

use crate::{
    constants::MAX_ADJUSTMENT_REASON,
    error::DniowkaError,
    events::AdjustmentProposed,
    math,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct ProposeAdjustment<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority @ DniowkaError::NotEmployer)]
    pub employer: Account<'info, Employer>,
    #[account(mut, has_one = employer @ DniowkaError::NotEmployer)]
    pub stream: Account<'info, Stream>,
}

/// The employer may ask to reduce the final pay, but the program decides how much of it
/// applies: down to the floor on their word alone, below it only with the employee's
/// consent, and never into pay that was already taken.
pub fn handle_propose_adjustment(
    ctx: Context<ProposeAdjustment>,
    amount: u64,
    reason: u8,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let stream = &mut ctx.accounts.stream;
    require!(
        stream.status == StreamStatus::Active,
        DniowkaError::NotActive
    );
    require!(now < stream.payday, DniowkaError::AdjustmentClosed);
    require!(
        (1..=MAX_ADJUSTMENT_REASON).contains(&reason),
        DniowkaError::InvalidAdjustmentReason
    );
    require!(amount > 0, DniowkaError::ZeroAmount);

    let caps = math::cut_caps(stream.earned_final()?, stream.floor_bps, stream.withdrawn)?;
    // Logged before the checks below so the app can read the caps by simulation.
    msg!(
        "cut cap {} with consent {}",
        caps.without_consent,
        caps.with_consent
    );
    require!(
        amount <= caps.with_consent,
        DniowkaError::AdjustmentTooLarge
    );

    stream.adjustment = amount;
    stream.adjustment_reason = reason;
    // A new proposal is a new question: any earlier consent no longer applies.
    stream.adjustment_accepted = false;
    emit!(AdjustmentProposed {
        stream: stream.key(),
        amount,
        reason,
        cap_without_consent: caps.without_consent,
        cap_with_consent: caps.with_consent,
        timestamp: now,
    });
    Ok(())
}
