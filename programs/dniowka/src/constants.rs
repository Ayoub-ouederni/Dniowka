use anchor_lang::prelude::*;

#[constant]
pub const EMPLOYER_SEED: &[u8] = b"employer";

#[constant]
pub const STREAM_SEED: &[u8] = b"stream";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Basis points in 100 %.
pub const BPS_DENOMINATOR: u16 = 10_000;

/// Payday may fall at most this long after the period ends (Labour Code art. 85: up to the 10th).
#[constant]
pub const MAX_PAYDAY_DELAY: i64 = 10 * 86_400;

/// Highest adjustment reason code: 1 sick leave, 2 unpaid absence, 3 correction, 4 other.
pub const MAX_ADJUSTMENT_REASON: u8 = 4;

/// An unaccepted invite can be cancelled once 1/GRACE_DIVISOR of its period has passed
/// (3 days of a 30-day month; 30 s of a 5-minute demo month).
pub const GRACE_DIVISOR: i64 = 10;

/// Memo logged before every payday transfer, so a token account that requires
/// incoming-transfer memos cannot block payday.
pub const PAYDAY_MEMO: &[u8] = b"dniowka:payday";

/// Memo logged before the refund of a cancelled invite.
pub const CANCEL_MEMO: &[u8] = b"dniowka:cancel";
