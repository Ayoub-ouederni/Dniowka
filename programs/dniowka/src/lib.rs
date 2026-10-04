pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3");

#[program]
pub mod dniowka {
    use super::*;

    /// Registers a company and the zł token it pays in.
    pub fn init_employer(ctx: Context<InitEmployer>, default_floor_bps: u16) -> Result<()> {
        crate::instructions::init_employer::handle_init_employer(ctx, default_floor_bps)
    }

    /// Opens one employee's salary for one pay period and creates its vault.
    pub fn create_stream(
        ctx: Context<CreateStream>,
        employee_hint: Option<Pubkey>,
        net_amount: u64,
        period_start: i64,
        period_end: i64,
        payday: i64,
        floor_bps: u16,
    ) -> Result<()> {
        crate::instructions::create_stream::handle_create_stream(
            ctx,
            employee_hint,
            net_amount,
            period_start,
            period_end,
            payday,
            floor_bps,
        )
    }

    /// The employee joins; from now on only they can withdraw.
    pub fn accept_stream(ctx: Context<AcceptStream>, income_commitment: [u8; 32]) -> Result<()> {
        crate::instructions::accept_stream::handle_accept_stream(ctx, income_commitment)
    }

    /// The employer locks salary into the vault.
    pub fn fund_stream(ctx: Context<FundStream>, amount: u64) -> Result<()> {
        crate::instructions::fund_stream::handle_fund_stream(ctx, amount)
    }

    /// The employee takes part of what they have already earned. No lender, no approval.
    pub fn withdraw_earned(ctx: Context<WithdrawEarned>, amount: u64) -> Result<()> {
        crate::instructions::withdraw_earned::handle_withdraw_earned(ctx, amount)
    }

    /// The employer ends employment, never in the past.
    pub fn end_employment(ctx: Context<EndEmployment>, end_ts: i64) -> Result<()> {
        crate::instructions::end_employment::handle_end_employment(ctx, end_ts)
    }

    /// Payday: anyone can trigger it; the program pays the employee and refunds the rest.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        crate::instructions::settle::handle_settle(ctx)
    }
}
