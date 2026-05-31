use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

declare_id!("FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL");

pub const CONFIG_SEED: &[u8] = b"config";
pub const STAKE_POSITION_SEED: &[u8] = b"stake-position";
pub const VOTING_RIGHTS_DELAY_SECONDS: i64 = 14 * 24 * 60 * 60;

#[program]
pub mod cryptoseeds_protocol {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        base_fee_bps: u16,
        tier_thresholds: [u64; 5],
        tier_fee_reduction_bps: [u16; 5],
    ) -> Result<()> {
        require!(base_fee_bps <= 1_000, CryptoSeedsError::FeeTooHigh);
        validate_thresholds(&tier_thresholds)?;
        validate_fee_reductions(base_fee_bps, &tier_fee_reduction_bps)?;

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.ryp_mint = ctx.accounts.ryp_mint.key();
        config.ryp_vault = ctx.accounts.ryp_vault.key();
        config.base_fee_bps = base_fee_bps;
        config.tier_thresholds = tier_thresholds;
        config.tier_fee_reduction_bps = tier_fee_reduction_bps;
        config.total_staked = 0;
        config.paused = false;
        config.bump = ctx.bumps.config;

        emit!(ConfigInitialized {
            authority: config.authority,
            ryp_mint: config.ryp_mint,
            base_fee_bps,
        });

        Ok(())
    }

    pub fn set_pause(ctx: Context<SetPause>, paused: bool) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require_keys_eq!(
            config.authority,
            ctx.accounts.authority.key(),
            CryptoSeedsError::Unauthorized
        );

        config.paused = paused;

        emit!(PauseUpdated { paused });

        Ok(())
    }

    pub fn stake_ryp(ctx: Context<StakeRyp>, amount: u64) -> Result<()> {
        require!(amount > 0, CryptoSeedsError::InvalidAmount);
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );

        let current_amount = ctx.accounts.position.staked_amount;
        if ctx.accounts.position.owner != Pubkey::default() {
            require_keys_eq!(
                ctx.accounts.position.owner,
                ctx.accounts.owner.key(),
                CryptoSeedsError::Unauthorized
            );
        }

        let previous_tier = if current_amount == 0 {
            StakeTier::None
        } else {
            ctx.accounts.position.tier
        };
        let new_amount = current_amount
            .checked_add(amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        let new_tier = StakeTier::from_amount(new_amount, &ctx.accounts.config.tier_thresholds);
        require!(
            new_tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.owner_ryp_account.to_account_info(),
            mint: ctx.accounts.ryp_mint.to_account_info(),
            to: ctx.accounts.ryp_vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.token_program.key(), cpi_accounts);
        transfer_checked(cpi_context, amount, ctx.accounts.ryp_mint.decimals)?;

        let clock = Clock::get()?;
        let position = &mut ctx.accounts.position;
        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.owner.key();
            position.bump = ctx.bumps.position;
        }

        if current_amount == 0 {
            position.staking_start_ts = clock.unix_timestamp;
            position.voting_rights_eligible_ts = clock
                .unix_timestamp
                .checked_add(VOTING_RIGHTS_DELAY_SECONDS)
                .ok_or(CryptoSeedsError::MathOverflow)?;
            position.last_reward_claim_ts = clock.unix_timestamp;
            position.voting_rights_active = false;
        }

        position.staked_amount = new_amount;
        position.tier = new_tier;
        position.golden_key_active = true;

        let config = &mut ctx.accounts.config;
        config.total_staked = config
            .total_staked
            .checked_add(amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(StakeDeposited {
            owner: position.owner,
            amount,
            staked_amount: position.staked_amount,
            previous_tier,
            new_tier: position.tier,
            voting_rights_eligible_ts: position.voting_rights_eligible_ts,
        });

        emit!(StakeUpdated {
            owner: position.owner,
            staked_amount: position.staked_amount,
            tier: position.tier,
            golden_key_active: position.golden_key_active,
            voting_rights_active: position.voting_rights_active,
        });

        Ok(())
    }

    pub fn unstake_ryp(ctx: Context<UnstakeRyp>, amount: u64) -> Result<()> {
        require!(amount > 0, CryptoSeedsError::InvalidAmount);
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.staked_amount >= amount,
            CryptoSeedsError::InsufficientStake
        );

        let config_bump = ctx.accounts.config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[CONFIG_SEED, &[config_bump]]];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.ryp_vault.to_account_info(),
            mint: ctx.accounts.ryp_mint.to_account_info(),
            to: ctx.accounts.owner_ryp_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        transfer_checked(cpi_context, amount, ctx.accounts.ryp_mint.decimals)?;

        let previous_tier = ctx.accounts.position.tier;
        let new_amount = ctx.accounts.position.staked_amount - amount;
        let new_tier = StakeTier::from_amount(new_amount, &ctx.accounts.config.tier_thresholds);

        let position = &mut ctx.accounts.position;
        position.staked_amount = new_amount;
        position.tier = new_tier;
        if new_tier == StakeTier::None {
            position.staking_start_ts = 0;
            position.voting_rights_eligible_ts = 0;
            position.golden_key_active = false;
            position.voting_rights_active = false;
        }

        let config = &mut ctx.accounts.config;
        config.total_staked = config
            .total_staked
            .checked_sub(amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(StakeWithdrawn {
            owner: position.owner,
            amount,
            staked_amount: position.staked_amount,
            previous_tier,
            new_tier: position.tier,
        });

        emit!(StakeUpdated {
            owner: position.owner,
            staked_amount: position.staked_amount,
            tier: position.tier,
            golden_key_active: position.golden_key_active,
            voting_rights_active: position.voting_rights_active,
        });

        Ok(())
    }

    pub fn activate_voting_rights(ctx: Context<ActivateVotingRights>) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );
        require!(
            !ctx.accounts.position.voting_rights_active,
            CryptoSeedsError::VotingRightsAlreadyActive
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= ctx.accounts.position.voting_rights_eligible_ts,
            CryptoSeedsError::VotingRightsLocked
        );

        let position = &mut ctx.accounts.position;
        position.voting_rights_active = true;

        emit!(VotingRightsActivated {
            owner: position.owner,
            activated_at: clock.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub ryp_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = ryp_mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub ryp_vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPause<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct StakeRyp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = ryp_mint, has_one = ryp_vault)]
    pub config: Account<'info, ProtocolConfig>,
    pub ryp_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = ryp_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub owner_ryp_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = ryp_mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub ryp_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + StakePosition::INIT_SPACE,
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, StakePosition>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeRyp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = ryp_mint, has_one = ryp_vault)]
    pub config: Account<'info, ProtocolConfig>,
    pub ryp_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = ryp_mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program
    )]
    pub owner_ryp_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = ryp_mint,
        associated_token::authority = config,
        associated_token::token_program = token_program
    )]
    pub ryp_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ActivateVotingRights<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
}

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub ryp_mint: Pubkey,
    pub ryp_vault: Pubkey,
    pub base_fee_bps: u16,
    pub tier_thresholds: [u64; 5],
    pub tier_fee_reduction_bps: [u16; 5],
    pub total_staked: u64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub tier: StakeTier,
    pub staking_start_ts: i64,
    pub voting_rights_eligible_ts: i64,
    pub last_reward_claim_ts: i64,
    pub golden_key_active: bool,
    pub voting_rights_active: bool,
    pub vote_count: u32,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum StakeTier {
    None,
    Seed,
    Sprout,
    Sapling,
    Tree,
    Fruit,
}

impl StakeTier {
    pub fn from_amount(amount: u64, thresholds: &[u64; 5]) -> Self {
        if amount >= thresholds[4] {
            Self::Fruit
        } else if amount >= thresholds[3] {
            Self::Tree
        } else if amount >= thresholds[2] {
            Self::Sapling
        } else if amount >= thresholds[1] {
            Self::Sprout
        } else if amount >= thresholds[0] {
            Self::Seed
        } else {
            Self::None
        }
    }
}

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub ryp_mint: Pubkey,
    pub base_fee_bps: u16,
}

#[event]
pub struct PauseUpdated {
    pub paused: bool,
}

#[event]
pub struct StakeDeposited {
    pub owner: Pubkey,
    pub amount: u64,
    pub staked_amount: u64,
    pub previous_tier: StakeTier,
    pub new_tier: StakeTier,
    pub voting_rights_eligible_ts: i64,
}

#[event]
pub struct StakeWithdrawn {
    pub owner: Pubkey,
    pub amount: u64,
    pub staked_amount: u64,
    pub previous_tier: StakeTier,
    pub new_tier: StakeTier,
}

#[event]
pub struct StakeUpdated {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub tier: StakeTier,
    pub golden_key_active: bool,
    pub voting_rights_active: bool,
}

#[event]
pub struct VotingRightsActivated {
    pub owner: Pubkey,
    pub activated_at: i64,
}

#[error_code]
pub enum CryptoSeedsError {
    #[msg("The provided amount is invalid.")]
    InvalidAmount,
    #[msg("The protocol is paused.")]
    ProtocolPaused,
    #[msg("The caller is not authorized for this action.")]
    Unauthorized,
    #[msg("The fee is too high for the configured safety bounds.")]
    FeeTooHigh,
    #[msg("Tier thresholds must be sorted and non-zero.")]
    InvalidTierThresholds,
    #[msg("Tier fee reductions cannot exceed the base fee.")]
    InvalidFeeReduction,
    #[msg("Stake amount is below the Seed tier minimum.")]
    StakeBelowSeedTier,
    #[msg("Insufficient staked RYP.")]
    InsufficientStake,
    #[msg("Voting rights are still locked.")]
    VotingRightsLocked,
    #[msg("Voting rights are already active.")]
    VotingRightsAlreadyActive,
    #[msg("Math overflow or underflow.")]
    MathOverflow,
}

fn validate_thresholds(thresholds: &[u64; 5]) -> Result<()> {
    require!(thresholds[0] > 0, CryptoSeedsError::InvalidTierThresholds);
    for index in 1..thresholds.len() {
        require!(
            thresholds[index] > thresholds[index - 1],
            CryptoSeedsError::InvalidTierThresholds
        );
    }

    Ok(())
}

fn validate_fee_reductions(base_fee_bps: u16, reductions: &[u16; 5]) -> Result<()> {
    for reduction in reductions {
        require!(
            *reduction <= base_fee_bps,
            CryptoSeedsError::InvalidFeeReduction
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const THRESHOLDS: [u64; 5] = [
        5_000_000_000,
        20_000_000_000,
        50_000_000_000,
        100_000_000_000,
        150_000_000_000,
    ];

    #[test]
    fn maps_stake_amounts_to_expected_tiers() {
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[0] - 1, &THRESHOLDS),
            StakeTier::None
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[0], &THRESHOLDS),
            StakeTier::Seed
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[1], &THRESHOLDS),
            StakeTier::Sprout
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[2], &THRESHOLDS),
            StakeTier::Sapling
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[3], &THRESHOLDS),
            StakeTier::Tree
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[4], &THRESHOLDS),
            StakeTier::Fruit
        ));
        assert!(matches!(
            StakeTier::from_amount(THRESHOLDS[4] + 1, &THRESHOLDS),
            StakeTier::Fruit
        ));
    }

    #[test]
    fn validates_strictly_increasing_nonzero_thresholds() {
        assert!(validate_thresholds(&THRESHOLDS).is_ok());
        assert!(validate_thresholds(&[0, 20, 50, 100, 150]).is_err());
        assert!(validate_thresholds(&[5, 20, 20, 100, 150]).is_err());
        assert!(validate_thresholds(&[5, 20, 50, 40, 150]).is_err());
    }

    #[test]
    fn blocks_fee_reductions_above_base_fee() {
        assert!(validate_fee_reductions(350, &[0, 35, 70, 105, 140]).is_ok());
        assert!(validate_fee_reductions(350, &[0, 35, 70, 105, 351]).is_err());
    }
}
