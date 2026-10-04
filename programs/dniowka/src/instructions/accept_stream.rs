use anchor_lang::prelude::*;

use crate::{
    error::DniowkaError,
    events::StreamAccepted,
    state::{Employer, Stream, StreamStatus},
};

#[derive(Accounts)]
pub struct AcceptStream<'info> {
    pub employee: Signer<'info>,
    #[account(mut, has_one = employer)]
    pub stream: Account<'info, Stream>,
    pub employer: Account<'info, Employer>,
}

pub fn handle_accept_stream(ctx: Context<AcceptStream>, income_commitment: [u8; 32]) -> Result<()> {
    let employee = ctx.accounts.employee.key();
    let stream = &mut ctx.accounts.stream;
    require!(
        stream.status == StreamStatus::Invited,
        DniowkaError::NotInvited
    );
    // With one wallet on both sides, both payday payouts would target the same
    // token account and settle could never run.
    require!(
        employee != ctx.accounts.employer.authority,
        DniowkaError::EmployerCannotBeEmployee
    );
    // While invited, `employee` holds the hint; the default key means open invite.
    require!(
        stream.employee == Pubkey::default() || stream.employee == employee,
        DniowkaError::NotEmployee
    );

    stream.employee = employee;
    stream.status = StreamStatus::Active;
    // Inserting the commitment into the income registry comes with the ZK proof (M6).
    stream.income_commitment = income_commitment;

    emit!(StreamAccepted {
        stream: stream.key(),
        employee,
    });
    Ok(())
}
