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

/// Memo logged before every payday transfer, so a token account that requires
/// incoming-transfer memos cannot block payday.
pub const PAYDAY_MEMO: &[u8] = b"dniowka:payday";
