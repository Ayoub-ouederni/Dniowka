use anchor_lang::prelude::*;

#[event]
pub struct StreamCreated {
    pub stream: Pubkey,
    pub employer: Pubkey,
    pub id: u64,
    pub employee_hint: Option<Pubkey>,
    pub net_amount: u64,
    pub period_start: i64,
    pub period_end: i64,
    pub payday: i64,
    pub floor_bps: u16,
}

#[event]
pub struct StreamAccepted {
    pub stream: Pubkey,
    pub employee: Pubkey,
}

#[event]
pub struct Funded {
    pub stream: Pubkey,
    pub amount: u64,
    pub funded: u64,
}

#[event]
pub struct Withdrawn {
    pub stream: Pubkey,
    pub employee: Pubkey,
    pub amount: u64,
    pub withdrawn: u64,
    pub earned: u64,
    pub available_after: u64,
    pub timestamp: i64,
}

#[event]
pub struct EmploymentEnded {
    pub stream: Pubkey,
    pub end_ts: i64,
    pub timestamp: i64,
}

#[event]
pub struct Settled {
    pub stream: Pubkey,
    pub pay_employee: u64,
    pub refund_emp: u64,
    pub shortfall: u64,
    pub earned_final: u64,
    pub cut: u64,
    pub timestamp: i64,
}

/// Public record that the employer under-funded what the employee earned.
#[event]
pub struct WageShortfall {
    pub stream: Pubkey,
    pub employer: Pubkey,
    pub employee: Pubkey,
    pub shortfall: u64,
}
