use anchor_lang::prelude::*;

/// Order is part of the interface: codes are 6000 + position and the UI maps them
/// to human sentences. Spec names come first; append new errors at the end only.
#[error_code]
pub enum DniowkaError {
    #[msg("Amount is more than is available now")]
    ExceedsAvailable,
    #[msg("This salary is secured. Nobody can take it back")]
    PaymentLocked,
    #[msg("Only the employer can do this")]
    NotEmployer,
    #[msg("End date can't be in the past")]
    BackdatingNotAllowed,
    #[msg("Payday has not come yet")]
    TooEarlyForPayday,
    #[msg("Funding would exceed the net salary")]
    Overfunded,
    #[msg("Period end must be after period start")]
    InvalidPeriod,
    #[msg("Floor must be between 1 and 10000 basis points")]
    InvalidFloor,
    #[msg("This salary has already been paid out")]
    AlreadySettled,
    #[msg("Only the employee can do this")]
    NotEmployee,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Income proof is invalid")]
    ProofInvalid,
    #[msg("Unknown income registry root")]
    UnknownRoot,
    #[msg("Payday must be between period end and 10 days after it")]
    InvalidPayday,
    #[msg("This invite has already been accepted")]
    NotInvited,
    #[msg("This salary is not active")]
    NotActive,
    #[msg("End date can't be after the period end")]
    InvalidEndDate,
    #[msg("End date can only be moved later")]
    EndDateCannotMoveEarlier,
    #[msg("Funding is closed after payday")]
    FundingClosed,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Salary token must be a plain Token-2022 mint without freeze authority or extensions")]
    UnsupportedMint,
    #[msg("An employer can't be their own employee")]
    EmployerCannotBeEmployee,
    #[msg(
        "Adjustment reason must be 1 (sick leave), 2 (unpaid absence), 3 (correction) or 4 (other)"
    )]
    InvalidAdjustmentReason,
    #[msg("Adjustment would cut into pay that was already taken")]
    AdjustmentTooLarge,
    #[msg("Adjustments close at payday")]
    AdjustmentClosed,
    #[msg("There is no adjustment to accept")]
    NoAdjustment,
    #[msg("The adjustment changed; review it again")]
    AdjustmentChanged,
    #[msg("This invite can't be cancelled yet")]
    CancelTooEarly,
}
