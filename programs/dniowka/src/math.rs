//! Salary math from spec §4 and the settle split from §5.2. Integer only, floor rounding.

use anchor_lang::prelude::*;

use crate::{constants::BPS_DENOMINATOR, error::DniowkaError};

/// Wages earned by `now`: `net_amount * elapsed / duration`, where the clock stops at
/// `end_ts` (if set) and at `period_end`.
pub fn earned(
    net_amount: u64,
    period_start: i64,
    period_end: i64,
    end_ts: Option<i64>,
    now: i64,
) -> Result<u64> {
    // i128 so no pair of i64 timestamps can overflow.
    let duration = i128::from(period_end) - i128::from(period_start);
    require!(duration > 0, DniowkaError::InvalidPeriod);
    let t_end = now.min(end_ts.unwrap_or(period_end));
    let elapsed = (i128::from(t_end) - i128::from(period_start)).clamp(0, duration);
    // 0 <= elapsed <= duration < 2^65, net < 2^64: the product fits in u128
    // and the quotient is at most net_amount.
    let earned = u128::from(net_amount) * elapsed.unsigned_abs() / duration.unsigned_abs();
    u64::try_from(earned).map_err(|_| error!(DniowkaError::MathOverflow))
}

/// Guaranteed share of `earned`.
pub fn floor_of(earned: u64, floor_bps: u16) -> Result<u64> {
    let floor = u128::from(earned) * u128::from(floor_bps) / u128::from(BPS_DENOMINATOR);
    u64::try_from(floor).map_err(|_| error!(DniowkaError::MathOverflow))
}

/// What the employee may withdraw now: the floor of earned, capped by what was funded,
/// minus what was already taken.
pub fn available(earned: u64, floor_bps: u16, funded: u64, withdrawn: u64) -> Result<u64> {
    Ok(floor_of(earned, floor_bps)?
        .min(funded)
        .saturating_sub(withdrawn))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettleSplit {
    pub cut: u64,
    pub owed: u64,
    pub pay_employee: u64,
    pub refund_emp: u64,
    pub shortfall: u64,
}

/// Final payday split (spec §5.2). `pay_employee + refund_emp == funded - withdrawn`.
pub fn settle_split(
    earned_final: u64,
    floor_bps: u16,
    funded: u64,
    withdrawn: u64,
    adjustment: u64,
    adjustment_accepted: bool,
) -> Result<SettleSplit> {
    let floor_final = floor_of(earned_final, floor_bps)?;
    // Without the employee's consent a cut can never reach below the floor;
    // with it, never below what was already withdrawn.
    let max_cut = if adjustment_accepted {
        earned_final.saturating_sub(withdrawn)
    } else {
        earned_final.saturating_sub(floor_final.max(withdrawn))
    };
    let cut = adjustment.min(max_cut);
    let owed = earned_final - cut; // cut <= max_cut <= earned_final
    let covered = owed.min(funded);
    let pay_employee = covered.saturating_sub(withdrawn);
    // withdrawn <= funded and pay_employee <= funded - withdrawn always hold;
    // checked anyway so a broken invariant fails loudly instead of wrapping.
    let refund_emp = funded
        .checked_sub(withdrawn)
        .and_then(|left| left.checked_sub(pay_employee))
        .ok_or(DniowkaError::MathOverflow)?;
    Ok(SettleSplit {
        cut,
        owed,
        pay_employee,
        refund_emp,
        shortfall: owed - covered,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 86_400;
    const T: i64 = 1_800_000_000;
    const NET: u64 = 600_000; // 6 000,00 zł
    const END: i64 = T + 30 * DAY;

    fn split(
        earned_final: u64,
        floor_bps: u16,
        funded: u64,
        withdrawn: u64,
        adjustment: u64,
        accepted: bool,
    ) -> SettleSplit {
        let s = settle_split(
            earned_final,
            floor_bps,
            funded,
            withdrawn,
            adjustment,
            accepted,
        )
        .unwrap();
        assert_eq!(
            withdrawn + s.pay_employee + s.refund_emp,
            funded,
            "vault must end empty"
        );
        s
    }

    #[test]
    fn spec_section_4_example() {
        let e = earned(NET, T, END, None, T + 12 * DAY).unwrap();
        assert_eq!(e, 240_000);
        assert_eq!(floor_of(e, 7000).unwrap(), 168_000);
        assert_eq!(available(e, 7000, NET, 0).unwrap(), 168_000);
        assert_eq!(available(e, 7000, NET, 80_000).unwrap(), 88_000);

        let s = split(NET, 7000, NET, 80_000, 0, false);
        assert_eq!(s.pay_employee, 520_000);
        assert_eq!(s.refund_emp, 0);
        assert_eq!(s.shortfall, 0);
    }

    #[test]
    fn earned_clamps_to_the_period_and_end_date() {
        assert_eq!(earned(NET, T, END, None, T - DAY).unwrap(), 0);
        assert_eq!(earned(NET, T, END, None, END + 5 * DAY).unwrap(), NET);
        let ended = Some(T + 15 * DAY);
        assert_eq!(earned(NET, T, END, ended, T + 20 * DAY).unwrap(), 300_000);
        assert_eq!(earned(NET, T, END, ended, T + 10 * DAY).unwrap(), 200_000);
        assert_eq!(earned(NET, T, END, Some(T - DAY), END).unwrap(), 0);
    }

    #[test]
    fn earned_uses_wide_intermediates() {
        assert_eq!(
            earned(u64::MAX, 0, 30 * DAY, None, 15 * DAY).unwrap(),
            u64::MAX / 2
        );
        assert_eq!(floor_of(u64::MAX, 10_000).unwrap(), u64::MAX);
        assert_eq!(
            earned(1, i64::MIN, i64::MAX, None, i64::MAX).unwrap(),
            1,
            "full i64 range must not overflow"
        );
    }

    #[test]
    fn rounding_always_floors() {
        let e = earned(100_001, T, END, None, T + 7 * DAY).unwrap();
        assert_eq!(e, 23_333);
        assert_eq!(floor_of(e, 7000).unwrap(), 16_333);
    }

    #[test]
    fn available_is_capped_by_funding() {
        assert_eq!(available(240_000, 7000, 100_000, 0).unwrap(), 100_000);
        assert_eq!(available(240_000, 7000, 100_000, 100_000).unwrap(), 0);
    }

    #[test]
    fn settle_underfunded_and_ended() {
        let s = split(300_000, 7000, 200_000, 80_000, 0, false);
        assert_eq!(s.pay_employee, 120_000);
        assert_eq!(s.refund_emp, 0);
        assert_eq!(s.shortfall, 100_000);
    }

    #[test]
    fn settle_refunds_unearned_pay() {
        let s = split(300_000, 7000, NET, 80_000, 0, false);
        assert_eq!(s.pay_employee, 220_000);
        assert_eq!(s.refund_emp, 300_000);
        assert_eq!(s.shortfall, 0);
    }

    #[test]
    fn adjustment_without_consent_stops_at_the_floor() {
        let s = split(NET, 7000, NET, 80_000, 300_000, false);
        assert_eq!(s.cut, 180_000);
        assert_eq!(s.owed, 420_000);
        assert_eq!(s.pay_employee, 340_000);
        assert_eq!(s.refund_emp, 180_000);
    }

    #[test]
    fn adjustment_with_consent_applies_in_full() {
        let s = split(NET, 7000, NET, 80_000, 300_000, true);
        assert_eq!(s.cut, 300_000);
        assert_eq!(s.owed, 300_000);
        assert_eq!(s.pay_employee, 220_000);
        assert_eq!(s.refund_emp, 300_000);
    }

    #[test]
    fn settle_after_full_floor_withdrawal() {
        let s = split(NET, 10_000, NET, NET, 0, false);
        assert_eq!(s.pay_employee, 0);
        assert_eq!(s.refund_emp, 0);
    }
}
