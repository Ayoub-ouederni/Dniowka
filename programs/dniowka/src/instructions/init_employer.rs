use anchor_lang::{prelude::*, solana_program::program_pack::Pack};
use anchor_spl::{
    token_2022::{self, spl_token_2022},
    token_interface::Mint,
};

use crate::{constants::*, error::DniowkaError, state::Employer};

#[derive(Accounts)]
pub struct InitEmployer<'info> {
    /// Pays rent only.
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Employer::INIT_SPACE,
        seeds = [EMPLOYER_SEED, authority.key().as_ref()],
        bump
    )]
    pub employer: Account<'info, Employer>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_employer(ctx: Context<InitEmployer>, default_floor_bps: u16) -> Result<()> {
    require!(
        (1..=BPS_DENOMINATOR).contains(&default_floor_bps),
        DniowkaError::InvalidFloor
    );
    // The employer picks the mint, so the mint must not give them a way around the
    // program: no freeze authority (freezing a vault would stop payday) and no
    // extensions at all (a permanent delegate could move vault funds, a transfer fee
    // or hook could make payouts fail). A plain Token-2022 mint is exactly 82 bytes.
    let mint = &ctx.accounts.mint;
    let mint_info = mint.to_account_info();
    require!(
        *mint_info.owner == token_2022::ID
            && mint_info.data_len() == spl_token_2022::state::Mint::LEN
            && mint.freeze_authority.is_none(),
        DniowkaError::UnsupportedMint
    );

    ctx.accounts.employer.set_inner(Employer {
        authority: ctx.accounts.authority.key(),
        mint: mint.key(),
        default_floor_bps,
        stream_count: 0,
        bump: ctx.bumps.employer,
    });
    Ok(())
}
