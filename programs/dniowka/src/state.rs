use anchor_lang::prelude::*;

/// A company that pays salaries through Dniówka. Seeds: ["employer", authority].
#[account]
#[derive(InitSpace)]
pub struct Employer {
    pub authority: Pubkey,
    /// The zł token every stream of this employer is paid in.
    pub mint: Pubkey,
    /// Suggested floor for new streams (UI default; each stream stores its own).
    pub default_floor_bps: u16,
    /// Next stream id, used in the stream PDA seeds.
    pub stream_count: u64,
    pub bump: u8,
}

/// One employee × one pay period. Seeds: ["stream", employer, id_le_bytes].
/// Its vault is the token account at ["vault", stream], owned by this PDA.
#[account]
#[derive(InitSpace)]
pub struct Stream {
    /// Employer PDA.
    pub employer: Pubkey,
    /// While `Invited`: the invite hint (`Pubkey::default()` = open invite).
    /// From `Active` on: the employee who accepted.
    pub employee: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub id: u64,
    /// Net salary for the period, in grosze.
    pub net_amount: u64,
    pub period_start: i64,
    pub period_end: i64,
    pub payday: i64,
    /// Guaranteed share of earned pay, 1..=10_000 basis points.
    pub floor_bps: u16,
    /// Total deposited by the employer (never above `net_amount`).
    pub funded: u64,
    /// Total already advanced to the employee.
    pub withdrawn: u64,
    /// Employment end, set by the employer; never in the past, only ever moved later.
    pub end_ts: Option<i64>,
    /// Proposed reduction of the final pay (M3).
    pub adjustment: u64,
    pub adjustment_reason: u8,
    pub adjustment_accepted: bool,
    pub status: StreamStatus,
    /// ZK leaf commitment given by the employee on accept (M6).
    pub income_commitment: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
}

impl Stream {
    /// Wages earned by the end of employment (or of the period): what payday settles.
    pub fn earned_final(&self) -> Result<u64> {
        crate::math::earned(
            self.net_amount,
            self.period_start,
            self.period_end,
            self.end_ts,
            self.period_end,
        )
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum StreamStatus {
    Invited,
    Active,
    Settled,
    Cancelled,
}
