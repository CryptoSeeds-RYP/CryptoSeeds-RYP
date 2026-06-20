use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use sha3::{Digest, Keccak256};

declare_id!("5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb");

pub const CONFIG_SEED: &[u8] = b"config";
pub const STAKE_POSITION_SEED: &[u8] = b"stake-position";
pub const REWARD_CONFIG_SEED: &[u8] = b"reward-config";
pub const REWARD_VAULT_STATE_SEED: &[u8] = b"reward-vault";
pub const REWARD_EPOCH_SEED: &[u8] = b"reward-epoch";
pub const REWARD_CLAIM_SEED: &[u8] = b"reward-claim";
pub const GOVERNANCE_PROPOSAL_SEED: &[u8] = b"governance-proposal";
pub const GOVERNANCE_VOTE_SEED: &[u8] = b"governance-vote";
pub const PROJECT_RECORD_SEED: &[u8] = b"project-record";
pub const PROJECT_PARTICIPATION_SEED: &[u8] = b"project-participation";
pub const PROJECT_DISCLOSURE_REVISION_SEED: &[u8] = b"project-disclosure-revision";
pub const PROJECT_OPERATOR_SEED: &[u8] = b"project-operator";
pub const SEEDBOT_PERMISSION_SEED: &[u8] = b"seedbot-permission";
pub const VOTING_RIGHTS_DELAY_SECONDS: i64 = 14 * 24 * 60 * 60;
pub const MAX_REWARD_EPOCH_CADENCE_SECONDS: i64 = 366 * 24 * 60 * 60;
pub const MAX_SEEDBOT_PERMISSION_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const SEEDBOT_USAGE_WINDOW_SECONDS: i64 = 24 * 60 * 60;
pub const MAX_SEEDBOT_DAILY_TRADES: u16 = 50;
pub const MAX_SEEDBOT_SLIPPAGE_BPS: u16 = 500;
pub const MAX_REWARD_MERKLE_PROOF_NODES: usize = 32;
pub const MAX_REWARD_CLAIM_WINDOW_SECONDS: i64 = 366 * 24 * 60 * 60;
pub const MIN_GOVERNANCE_VOTING_WINDOW_SECONDS: i64 = 1;
pub const MAX_GOVERNANCE_VOTING_WINDOW_SECONDS: i64 = 90 * 24 * 60 * 60;
pub const MAX_GOVERNANCE_MINIMUM_VOTES: u64 = 1_000_000;
pub const BPS_DENOMINATOR: u16 = 10_000;
pub const VOTING_RIGHTS_LEVEL_TWO_VOTE_COUNT: u32 = 100;
pub const MAX_PROJECT_OPERATOR_PERMISSION_SECONDS: i64 = 90 * 24 * 60 * 60;
pub const PROJECT_OPERATOR_PERMISSION_STATUS: u16 = 1;
pub const PROJECT_OPERATOR_PERMISSION_PAUSE: u16 = 2;
pub const PROJECT_OPERATOR_PERMISSION_MASK: u16 =
    PROJECT_OPERATOR_PERMISSION_STATUS | PROJECT_OPERATOR_PERMISSION_PAUSE;

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
        config.pending_authority = Pubkey::default();
        config.project_authority = ctx.accounts.authority.key();
        config.pending_project_authority = Pubkey::default();

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
            position.golden_key_issued_at = clock.unix_timestamp;
            position.golden_key_revoked_at = 0;
            position.voting_rights_activated_at = 0;
            position.voting_rights_level = 0;

            emit!(GoldenKeyReceiptUpdated {
                owner: position.owner,
                active: true,
                issued_at: position.golden_key_issued_at,
                revoked_at: position.golden_key_revoked_at,
            });
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
        let previous_tier = ctx.accounts.position.tier;
        let new_amount = ctx
            .accounts
            .position
            .staked_amount
            .checked_sub(amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        let new_tier = StakeTier::from_amount(new_amount, &ctx.accounts.config.tier_thresholds);
        validate_unstake_remainder(new_amount, new_tier)?;

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

        let position = &mut ctx.accounts.position;
        position.staked_amount = new_amount;
        position.tier = new_tier;
        if new_tier == StakeTier::None {
            position.staking_start_ts = 0;
            position.voting_rights_eligible_ts = 0;
            position.golden_key_active = false;
            position.voting_rights_active = false;
            position.golden_key_revoked_at = Clock::get()?.unix_timestamp;
            position.voting_rights_activated_at = 0;
            position.voting_rights_level = 0;

            emit!(GoldenKeyReceiptUpdated {
                owner: position.owner,
                active: false,
                issued_at: position.golden_key_issued_at,
                revoked_at: position.golden_key_revoked_at,
            });
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
        position.voting_rights_activated_at = clock.unix_timestamp;
        position.voting_rights_level = 1;

        emit!(VotingRightsActivated {
            owner: position.owner,
            activated_at: clock.unix_timestamp,
            voting_rights_level: position.voting_rights_level,
        });

        Ok(())
    }

    pub fn initialize_reward_config(
        ctx: Context<InitializeRewardConfig>,
        epoch_cadence_seconds: i64,
        holder_split_bps: u16,
        staker_split_bps: u16,
        treasury_split_bps: u16,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_reward_cadence(epoch_cadence_seconds)?;
        validate_reward_split(holder_split_bps, staker_split_bps, treasury_split_bps)?;

        let reward_config = &mut ctx.accounts.reward_config;
        reward_config.authority = ctx.accounts.authority.key();
        reward_config.protocol_config = ctx.accounts.config.key();
        reward_config.ryp_mint = ctx.accounts.ryp_mint.key();
        reward_config.epoch_cadence_seconds = epoch_cadence_seconds;
        reward_config.holder_split_bps = holder_split_bps;
        reward_config.staker_split_bps = staker_split_bps;
        reward_config.treasury_split_bps = treasury_split_bps;
        reward_config.registered_vault_roles_mask = 0;
        reward_config.verified_vault_roles_mask = 0;
        reward_config.total_epoch_drafts = 0;
        reward_config.total_routed_fee_amount = 0;
        reward_config.paused = false;
        reward_config.draft_only = true;
        reward_config.bump = ctx.bumps.reward_config;
        reward_config.pending_authority = Pubkey::default();

        emit!(RewardConfigInitialized {
            authority: reward_config.authority,
            ryp_mint: reward_config.ryp_mint,
            epoch_cadence_seconds,
            holder_split_bps,
            staker_split_bps,
            treasury_split_bps,
        });

        Ok(())
    }

    pub fn register_reward_vault(
        ctx: Context<RegisterRewardVault>,
        role: RewardVaultRole,
        vault_address: Pubkey,
        custody_model: RewardVaultCustodyModel,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        require!(
            !ctx.accounts.reward_config.paused,
            CryptoSeedsError::RewardConfigPaused
        );
        require!(
            vault_address != Pubkey::default(),
            CryptoSeedsError::InvalidRewardVault
        );
        require!(
            metadata_hash != [0; 32],
            CryptoSeedsError::InvalidRewardMetadata
        );

        let reward_config = &mut ctx.accounts.reward_config;
        reward_config.registered_vault_roles_mask |= role.mask();

        let vault_state = &mut ctx.accounts.reward_vault_state;
        vault_state.reward_config = reward_config.key();
        vault_state.role = role;
        vault_state.reward_mint = reward_config.ryp_mint;
        vault_state.vault_address = vault_address;
        vault_state.custody_model = custody_model;
        vault_state.verification_status = RewardVaultVerificationStatus::PendingVerification;
        vault_state.metadata_hash = metadata_hash;
        vault_state.total_funded_amount = 0;
        vault_state.receives_user_funds = false;
        vault_state.bump = ctx.bumps.reward_vault_state;

        emit!(RewardVaultRegistered {
            reward_config: reward_config.key(),
            role,
            vault_address,
            custody_model,
        });

        Ok(())
    }

    pub fn verify_reward_vault(
        ctx: Context<VerifyRewardVault>,
        role: RewardVaultRole,
        expected_metadata_hash: [u8; 32],
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        require!(
            !ctx.accounts.reward_config.paused,
            CryptoSeedsError::RewardConfigPaused
        );

        let vault_state = &mut ctx.accounts.reward_vault_state;
        require!(
            vault_state.role == role,
            CryptoSeedsError::InvalidRewardVault
        );
        require!(
            vault_state.verification_status != RewardVaultVerificationStatus::Disabled,
            CryptoSeedsError::RewardVaultDisabled
        );
        require!(
            vault_state.metadata_hash == expected_metadata_hash,
            CryptoSeedsError::RewardMetadataMismatch
        );
        require!(
            vault_state.custody_model != RewardVaultCustodyModel::DisclosurePending,
            CryptoSeedsError::RewardCustodyDisclosurePending
        );

        vault_state.verification_status = RewardVaultVerificationStatus::Verified;
        ctx.accounts.reward_config.verified_vault_roles_mask |= role.mask();

        emit!(RewardVaultVerified {
            reward_config: ctx.accounts.reward_config.key(),
            role,
            vault_address: vault_state.vault_address,
        });

        Ok(())
    }

    pub fn route_platform_fee(ctx: Context<RoutePlatformFee>, fee_amount: u64) -> Result<()> {
        require!(fee_amount > 0, CryptoSeedsError::InvalidAmount);
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        require!(
            !ctx.accounts.reward_config.paused,
            CryptoSeedsError::RewardConfigPaused
        );
        validate_reward_config_for_fee_route(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
        )?;

        let reward_config_key = ctx.accounts.reward_config.key();
        let reward_mint = ctx.accounts.ryp_mint.key();
        validate_reward_vault_for_fee_route(
            &ctx.accounts.holder_reward_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::HolderReward,
        )?;
        validate_reward_vault_for_fee_route(
            &ctx.accounts.staker_reward_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::StakerReward,
        )?;
        validate_reward_vault_for_fee_route(
            &ctx.accounts.independent_treasury_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::IndependentTreasury,
        )?;

        let (holder_amount, staker_amount, treasury_amount) = calculate_fee_route_amounts(
            fee_amount,
            ctx.accounts.reward_config.holder_split_bps,
            ctx.accounts.reward_config.staker_split_bps,
        )?;

        transfer_platform_fee_bucket(
            ctx.accounts.payer_fee_account.to_account_info(),
            ctx.accounts.ryp_mint.to_account_info(),
            ctx.accounts.holder_reward_vault.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_program.key(),
            holder_amount,
            ctx.accounts.ryp_mint.decimals,
        )?;
        transfer_platform_fee_bucket(
            ctx.accounts.payer_fee_account.to_account_info(),
            ctx.accounts.ryp_mint.to_account_info(),
            ctx.accounts.staker_reward_vault.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_program.key(),
            staker_amount,
            ctx.accounts.ryp_mint.decimals,
        )?;
        transfer_platform_fee_bucket(
            ctx.accounts.payer_fee_account.to_account_info(),
            ctx.accounts.ryp_mint.to_account_info(),
            ctx.accounts.independent_treasury_vault.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.token_program.key(),
            treasury_amount,
            ctx.accounts.ryp_mint.decimals,
        )?;

        ctx.accounts.reward_config.total_routed_fee_amount = ctx
            .accounts
            .reward_config
            .total_routed_fee_amount
            .checked_add(fee_amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        ctx.accounts.holder_reward_vault_state.total_funded_amount = ctx
            .accounts
            .holder_reward_vault_state
            .total_funded_amount
            .checked_add(holder_amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        ctx.accounts.staker_reward_vault_state.total_funded_amount = ctx
            .accounts
            .staker_reward_vault_state
            .total_funded_amount
            .checked_add(staker_amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        ctx.accounts
            .independent_treasury_vault_state
            .total_funded_amount = ctx
            .accounts
            .independent_treasury_vault_state
            .total_funded_amount
            .checked_add(treasury_amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(PlatformFeeRouted {
            payer: ctx.accounts.payer.key(),
            reward_config: reward_config_key,
            fee_amount,
            holder_amount,
            staker_amount,
            treasury_amount,
        });

        Ok(())
    }

    pub fn draft_reward_epoch(
        ctx: Context<DraftRewardEpoch>,
        epoch_id: u64,
        snapshot_taken_at: i64,
        claim_window_seconds: i64,
        reward_pool_amount: u64,
        distributed_net_amount: u64,
        reserved_delivery_cost_amount: u64,
        rolled_forward_amount: u64,
        exclusion_list_hash: [u8; 32],
        claim_merkle_root: [u8; 32],
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        require!(
            !ctx.accounts.reward_config.paused,
            CryptoSeedsError::RewardConfigPaused
        );
        require!(
            ctx.accounts.reward_config.draft_only,
            CryptoSeedsError::RewardExecutionNotApproved
        );
        validate_reward_epoch_accounting(
            reward_pool_amount,
            distributed_net_amount,
            reserved_delivery_cost_amount,
            rolled_forward_amount,
        )?;
        let clock = Clock::get()?;
        let claim_expires_at =
            calculate_reward_claim_expiry(clock.unix_timestamp, claim_window_seconds)?;
        validate_reward_snapshot_timing(
            snapshot_taken_at,
            clock.unix_timestamp,
            ctx.accounts.reward_config.epoch_cadence_seconds,
        )?;

        let reward_config_key = ctx.accounts.reward_config.key();
        let reward_mint = ctx.accounts.reward_config.ryp_mint;
        validate_reward_vault_for_epoch(
            &ctx.accounts.holder_reward_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::HolderReward,
        )?;
        validate_reward_vault_for_epoch(
            &ctx.accounts.staker_reward_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::StakerReward,
        )?;
        validate_reward_vault_for_epoch(
            &ctx.accounts.independent_treasury_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::IndependentTreasury,
        )?;
        validate_reward_vault_for_epoch(
            &ctx.accounts.delivery_cost_reserve_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::DeliveryCostReserve,
        )?;
        validate_reward_vault_for_epoch(
            &ctx.accounts.rollover_vault_state,
            reward_config_key,
            reward_mint,
            RewardVaultRole::Rollover,
        )?;

        let reward_epoch = &mut ctx.accounts.reward_epoch;
        reward_epoch.reward_config = reward_config_key;
        reward_epoch.epoch_id = epoch_id;
        reward_epoch.snapshot_taken_at = snapshot_taken_at;
        reward_epoch.created_at = clock.unix_timestamp;
        reward_epoch.reward_mint = reward_mint;
        reward_epoch.reward_pool_amount = reward_pool_amount;
        reward_epoch.distributed_net_amount = distributed_net_amount;
        reward_epoch.reserved_delivery_cost_amount = reserved_delivery_cost_amount;
        reward_epoch.rolled_forward_amount = rolled_forward_amount;
        reward_epoch.recorded_gross_allocation_amount = 0;
        reward_epoch.recorded_net_claim_amount = 0;
        reward_epoch.claimed_net_amount = 0;
        reward_epoch.claim_expires_at = claim_expires_at;
        reward_epoch.expired_unclaimed_net_amount = 0;
        reward_epoch.expired_recorded_at = 0;
        reward_epoch.exclusion_list_hash = exclusion_list_hash;
        reward_epoch.claim_merkle_root = claim_merkle_root;
        reward_epoch.status = RewardEpochStatus::Drafted;
        reward_epoch.execution_blocked = true;
        reward_epoch.bump = ctx.bumps.reward_epoch;

        ctx.accounts.reward_config.total_epoch_drafts = ctx
            .accounts
            .reward_config
            .total_epoch_drafts
            .checked_add(1)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(RewardEpochDrafted {
            reward_config: reward_config_key,
            epoch_id,
            snapshot_taken_at,
            reward_mint,
            reward_pool_amount,
            distributed_net_amount,
            reserved_delivery_cost_amount,
            rolled_forward_amount,
            claim_expires_at,
            exclusion_list_hash,
            claim_merkle_root,
            execution_blocked: true,
        });

        Ok(())
    }

    pub fn update_fee_config(
        ctx: Context<UpdateFeeConfig>,
        base_fee_bps: u16,
        tier_fee_reduction_bps: [u16; 5],
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        require!(base_fee_bps <= 1_000, CryptoSeedsError::FeeTooHigh);
        validate_fee_reductions(base_fee_bps, &tier_fee_reduction_bps)?;

        let config = &mut ctx.accounts.config;
        config.base_fee_bps = base_fee_bps;
        config.tier_fee_reduction_bps = tier_fee_reduction_bps;

        emit!(FeeConfigUpdated {
            authority: ctx.accounts.authority.key(),
            base_fee_bps,
            tier_fee_reduction_bps,
        });

        Ok(())
    }

    pub fn transfer_protocol_authority(
        ctx: Context<TransferProtocolAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_new_authority(new_authority, ctx.accounts.config.authority)?;

        ctx.accounts.config.pending_authority = new_authority;

        emit!(ProtocolAuthorityTransferStarted {
            current_authority: ctx.accounts.config.authority,
            pending_authority: new_authority,
        });

        Ok(())
    }

    pub fn accept_protocol_authority(ctx: Context<AcceptProtocolAuthority>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.pending_authority,
            ctx.accounts.pending_authority.key(),
            CryptoSeedsError::Unauthorized
        );

        let previous_authority = ctx.accounts.config.authority;
        let new_authority = ctx.accounts.pending_authority.key();
        ctx.accounts.config.authority = new_authority;
        ctx.accounts.config.pending_authority = Pubkey::default();

        emit!(ProtocolAuthorityTransferred {
            previous_authority,
            new_authority,
        });

        Ok(())
    }

    pub fn transfer_project_authority(
        ctx: Context<TransferProjectAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_new_authority(new_authority, ctx.accounts.config.project_authority)?;

        ctx.accounts.config.pending_project_authority = new_authority;

        emit!(ProjectAuthorityTransferStarted {
            current_authority: ctx.accounts.config.project_authority,
            pending_authority: new_authority,
        });

        Ok(())
    }

    pub fn accept_project_authority(ctx: Context<AcceptProjectAuthority>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.pending_project_authority,
            ctx.accounts.pending_authority.key(),
            CryptoSeedsError::Unauthorized
        );

        let previous_authority = ctx.accounts.config.project_authority;
        let new_authority = ctx.accounts.pending_authority.key();
        ctx.accounts.config.project_authority = new_authority;
        ctx.accounts.config.pending_project_authority = Pubkey::default();

        emit!(ProjectAuthorityTransferred {
            previous_authority,
            new_authority,
        });

        Ok(())
    }

    pub fn transfer_reward_authority(
        ctx: Context<TransferRewardAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        validate_new_authority(new_authority, ctx.accounts.reward_config.authority)?;

        ctx.accounts.reward_config.pending_authority = new_authority;

        emit!(RewardAuthorityTransferStarted {
            reward_config: ctx.accounts.reward_config.key(),
            current_authority: ctx.accounts.reward_config.authority,
            pending_authority: new_authority,
        });

        Ok(())
    }

    pub fn accept_reward_authority(ctx: Context<AcceptRewardAuthority>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.reward_config.pending_authority,
            ctx.accounts.pending_authority.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.config.authority,
            ctx.accounts.pending_authority.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.reward_config.protocol_config,
            ctx.accounts.config.key(),
            CryptoSeedsError::InvalidRewardVault
        );

        let previous_authority = ctx.accounts.reward_config.authority;
        let new_authority = ctx.accounts.pending_authority.key();
        ctx.accounts.reward_config.authority = new_authority;
        ctx.accounts.reward_config.pending_authority = Pubkey::default();

        emit!(RewardAuthorityTransferred {
            reward_config: ctx.accounts.reward_config.key(),
            previous_authority,
            new_authority,
        });

        Ok(())
    }

    pub fn review_reward_epoch(ctx: Context<ReviewRewardEpoch>, _epoch_id: u64) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        validate_reward_epoch_ready_for_review(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_config.ryp_mint,
        )?;

        let reward_epoch = &mut ctx.accounts.reward_epoch;
        reward_epoch.status = RewardEpochStatus::Reviewed;
        reward_epoch.execution_blocked = false;

        emit!(RewardEpochReviewed {
            reward_config: reward_epoch.reward_config,
            epoch_id: reward_epoch.epoch_id,
            claim_merkle_root: reward_epoch.claim_merkle_root,
            claim_expires_at: reward_epoch.claim_expires_at,
            execution_blocked: reward_epoch.execution_blocked,
        });

        Ok(())
    }

    pub fn cancel_reward_epoch(ctx: Context<CancelRewardEpoch>, _epoch_id: u64) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        validate_reward_epoch_matches_config(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_config.ryp_mint,
        )?;
        validate_reward_epoch_cancellable(&ctx.accounts.reward_epoch)?;

        let reward_epoch = &mut ctx.accounts.reward_epoch;
        reward_epoch.status = RewardEpochStatus::Cancelled;
        reward_epoch.execution_blocked = true;

        emit!(RewardEpochCancelled {
            reward_config: reward_epoch.reward_config,
            epoch_id: reward_epoch.epoch_id,
            execution_blocked: reward_epoch.execution_blocked,
        });

        Ok(())
    }

    pub fn expire_reward_epoch_claims(
        ctx: Context<ExpireRewardEpochClaims>,
        _epoch_id: u64,
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        validate_reward_epoch_matches_config(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_config.ryp_mint,
        )?;

        let expired_at = Clock::get()?.unix_timestamp;
        let expired_unclaimed_net_amount =
            expire_reward_epoch_claims_at(&mut ctx.accounts.reward_epoch, expired_at)?;

        emit!(RewardEpochClaimsExpired {
            reward_config: ctx.accounts.reward_epoch.reward_config,
            epoch_id: ctx.accounts.reward_epoch.epoch_id,
            expired_at,
            expired_unclaimed_net_amount,
            claimed_net_amount: ctx.accounts.reward_epoch.claimed_net_amount,
        });

        Ok(())
    }

    pub fn create_reward_claim_record(
        ctx: Context<CreateRewardClaimRecord>,
        _epoch_id: u64,
        reward_role: RewardVaultRole,
        wallet: Pubkey,
        gross_allocation_amount: u64,
        delivery_cost_amount: u64,
        net_claim_amount: u64,
        rolled_forward_amount: u64,
    ) -> Result<()> {
        validate_reward_authority(
            &ctx.accounts.config,
            &ctx.accounts.reward_config,
            ctx.accounts.config.key(),
            &ctx.accounts.authority.key(),
        )?;
        validate_reward_epoch_matches_config(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_config.ryp_mint,
        )?;
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable_at(
            &ctx.accounts.reward_epoch,
            Clock::get()?.unix_timestamp,
        )?;
        validate_reward_claim_accounting(
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
        )?;
        require!(
            wallet != Pubkey::default(),
            CryptoSeedsError::InvalidRewardClaim
        );

        record_reward_claim_amounts(
            &mut ctx.accounts.reward_epoch,
            gross_allocation_amount,
            net_claim_amount,
        )?;

        let claim_record_key = ctx.accounts.claim_record.key();
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.reward_epoch = ctx.accounts.reward_epoch.key();
        claim_record.reward_role = reward_role;
        claim_record.wallet = wallet;
        claim_record.gross_allocation_amount = gross_allocation_amount;
        claim_record.delivery_cost_amount = delivery_cost_amount;
        claim_record.net_claim_amount = net_claim_amount;
        claim_record.rolled_forward_amount = rolled_forward_amount;
        claim_record.claimed = false;
        claim_record.bump = ctx.bumps.claim_record;

        emit!(RewardClaimRecordCreated {
            claim_record: claim_record_key,
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet,
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
        });

        Ok(())
    }

    pub fn create_reward_claim_record_from_proof(
        ctx: Context<CreateRewardClaimRecordFromProof>,
        _epoch_id: u64,
        reward_role: RewardVaultRole,
        gross_allocation_amount: u64,
        delivery_cost_amount: u64,
        net_claim_amount: u64,
        rolled_forward_amount: u64,
        leaf_index: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable_at(
            &ctx.accounts.reward_epoch,
            Clock::get()?.unix_timestamp,
        )?;
        require_keys_eq!(
            ctx.accounts.reward_epoch.reward_config,
            ctx.accounts.reward_config.key(),
            CryptoSeedsError::InvalidRewardClaim
        );
        validate_reward_epoch_matches_config(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_config.ryp_mint,
        )?;
        validate_reward_claim_accounting(
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
        )?;
        validate_reward_merkle_proof(
            &ctx.accounts.reward_epoch,
            ctx.accounts.reward_epoch.key(),
            reward_role,
            ctx.accounts.owner.key(),
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
            leaf_index,
            &proof,
        )?;

        record_reward_claim_amounts(
            &mut ctx.accounts.reward_epoch,
            gross_allocation_amount,
            net_claim_amount,
        )?;

        let claim_record_key = ctx.accounts.claim_record.key();
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.reward_epoch = ctx.accounts.reward_epoch.key();
        claim_record.reward_role = reward_role;
        claim_record.wallet = ctx.accounts.owner.key();
        claim_record.gross_allocation_amount = gross_allocation_amount;
        claim_record.delivery_cost_amount = delivery_cost_amount;
        claim_record.net_claim_amount = net_claim_amount;
        claim_record.rolled_forward_amount = rolled_forward_amount;
        claim_record.claimed = false;
        claim_record.bump = ctx.bumps.claim_record;

        emit!(RewardClaimProofVerified {
            claim_record: claim_record_key,
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet: claim_record.wallet,
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
            leaf_index,
        });

        emit!(RewardClaimRecordCreated {
            claim_record: claim_record_key,
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet: claim_record.wallet,
            gross_allocation_amount,
            delivery_cost_amount,
            net_claim_amount,
            rolled_forward_amount,
        });

        Ok(())
    }

    pub fn claim_reward_record(
        ctx: Context<ClaimRewardRecord>,
        reward_role: RewardVaultRole,
    ) -> Result<()> {
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable_at(
            &ctx.accounts.reward_epoch,
            Clock::get()?.unix_timestamp,
        )?;
        require_keys_eq!(
            ctx.accounts.claim_record.wallet,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            !ctx.accounts.claim_record.claimed,
            CryptoSeedsError::RewardAlreadyClaimed
        );
        require!(
            ctx.accounts.claim_record.reward_role == reward_role,
            CryptoSeedsError::InvalidRewardClaim
        );
        require!(
            ctx.accounts.claim_record.reward_epoch == ctx.accounts.reward_epoch.key(),
            CryptoSeedsError::InvalidRewardClaim
        );
        require!(
            ctx.accounts.claim_record.net_claim_amount == 0,
            CryptoSeedsError::RewardTokenClaimRequired
        );
        require!(
            ctx.accounts.claim_record.rolled_forward_amount > 0,
            CryptoSeedsError::InvalidRewardClaim
        );

        let claim_record_key = ctx.accounts.claim_record.key();
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.claimed = true;

        emit!(RewardClaimed {
            claim_record: claim_record_key,
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet: claim_record.wallet,
            delivery_cost_amount: claim_record.delivery_cost_amount,
            net_claim_amount: claim_record.net_claim_amount,
            rolled_forward_amount: claim_record.rolled_forward_amount,
        });

        Ok(())
    }

    pub fn claim_reward_tokens(
        ctx: Context<ClaimRewardTokens>,
        _epoch_id: u64,
        reward_role: RewardVaultRole,
    ) -> Result<()> {
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable_at(
            &ctx.accounts.reward_epoch,
            Clock::get()?.unix_timestamp,
        )?;
        validate_reward_vault_for_token_claim(
            &ctx.accounts.reward_vault_state,
            ctx.accounts.reward_config.key(),
            ctx.accounts.reward_mint.key(),
            reward_role,
        )?;
        require_keys_eq!(
            ctx.accounts.reward_epoch.reward_config,
            ctx.accounts.reward_config.key(),
            CryptoSeedsError::InvalidRewardClaim
        );
        require_keys_eq!(
            ctx.accounts.reward_epoch.reward_mint,
            ctx.accounts.reward_mint.key(),
            CryptoSeedsError::InvalidRewardClaim
        );
        require_keys_eq!(
            ctx.accounts.claim_record.reward_epoch,
            ctx.accounts.reward_epoch.key(),
            CryptoSeedsError::InvalidRewardClaim
        );
        require_keys_eq!(
            ctx.accounts.claim_record.wallet,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.claim_record.reward_role == reward_role,
            CryptoSeedsError::InvalidRewardClaim
        );
        require!(
            !ctx.accounts.claim_record.claimed,
            CryptoSeedsError::RewardAlreadyClaimed
        );
        require!(
            ctx.accounts.claim_record.net_claim_amount > 0,
            CryptoSeedsError::InvalidRewardClaim
        );

        let claim_record_key = ctx.accounts.claim_record.key();
        let claim_amount = ctx.accounts.claim_record.net_claim_amount;
        let updated_claimed_amount = ctx
            .accounts
            .reward_epoch
            .claimed_net_amount
            .checked_add(claim_amount)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        require!(
            updated_claimed_amount <= ctx.accounts.reward_epoch.distributed_net_amount,
            CryptoSeedsError::RewardClaimExceedsEpoch
        );

        let reward_config_bump = ctx.accounts.reward_config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[REWARD_CONFIG_SEED, &[reward_config_bump]]];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.reward_source_vault.to_account_info(),
            mint: ctx.accounts.reward_mint.to_account_info(),
            to: ctx.accounts.owner_reward_account.to_account_info(),
            authority: ctx.accounts.reward_config.to_account_info(),
        };
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            cpi_accounts,
            signer_seeds,
        );
        transfer_checked(cpi_context, claim_amount, ctx.accounts.reward_mint.decimals)?;

        ctx.accounts.reward_epoch.claimed_net_amount = updated_claimed_amount;
        ctx.accounts.claim_record.claimed = true;

        emit!(RewardClaimed {
            claim_record: claim_record_key,
            reward_epoch: ctx.accounts.claim_record.reward_epoch,
            reward_role,
            wallet: ctx.accounts.claim_record.wallet,
            delivery_cost_amount: ctx.accounts.claim_record.delivery_cost_amount,
            net_claim_amount: claim_amount,
            rolled_forward_amount: ctx.accounts.claim_record.rolled_forward_amount,
        });

        Ok(())
    }

    pub fn create_governance_proposal(
        ctx: Context<CreateGovernanceProposal>,
        proposal_id: u64,
        category: GovernanceProposalCategory,
        metadata_hash: [u8; 32],
        voting_window_seconds: i64,
        minimum_votes: u64,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_metadata_hash(&metadata_hash)?;

        let clock = Clock::get()?;
        let voting_starts_at = clock.unix_timestamp;
        let voting_ends_at =
            calculate_governance_voting_ends_at(voting_starts_at, voting_window_seconds)?;
        validate_governance_minimum_votes(minimum_votes)?;

        let proposal = &mut ctx.accounts.proposal;
        proposal.proposal_id = proposal_id;
        proposal.authority = ctx.accounts.authority.key();
        proposal.category = category;
        proposal.status = GovernanceProposalStatus::Open;
        proposal.metadata_hash = metadata_hash;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.created_at = voting_starts_at;
        proposal.voting_starts_at = voting_starts_at;
        proposal.voting_ends_at = voting_ends_at;
        proposal.minimum_votes = minimum_votes;
        proposal.closed_at = 0;
        proposal.bump = ctx.bumps.proposal;

        emit!(GovernanceProposalCreated {
            proposal: proposal.key(),
            proposal_id,
            category,
            voting_starts_at,
            voting_ends_at,
            minimum_votes,
        });

        Ok(())
    }

    pub fn cast_governance_vote(
        ctx: Context<CastGovernanceVote>,
        _proposal_id: u64,
        approve: bool,
    ) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        require!(
            ctx.accounts.proposal.status == GovernanceProposalStatus::Open,
            CryptoSeedsError::GovernanceProposalClosed
        );
        let now = Clock::get()?.unix_timestamp;
        validate_governance_vote_window(&ctx.accounts.proposal, now)?;
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.voting_rights_active,
            CryptoSeedsError::VotingRightsLocked
        );

        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.proposal = ctx.accounts.proposal.key();
        vote_record.wallet = ctx.accounts.owner.key();
        vote_record.approve = approve;
        vote_record.voted_at = now;
        vote_record.bump = ctx.bumps.vote_record;

        let proposal = &mut ctx.accounts.proposal;
        if approve {
            proposal.yes_votes = proposal
                .yes_votes
                .checked_add(1)
                .ok_or(CryptoSeedsError::MathOverflow)?;
        } else {
            proposal.no_votes = proposal
                .no_votes
                .checked_add(1)
                .ok_or(CryptoSeedsError::MathOverflow)?;
        }

        let previous_voting_rights_level = ctx.accounts.position.voting_rights_level;
        ctx.accounts.position.vote_count = ctx
            .accounts
            .position
            .vote_count
            .checked_add(1)
            .ok_or(CryptoSeedsError::MathOverflow)?;
        ctx.accounts.position.voting_rights_level =
            voting_rights_level_for_vote_count(ctx.accounts.position.vote_count);

        emit!(GovernanceVoteCast {
            proposal: proposal.key(),
            wallet: ctx.accounts.owner.key(),
            approve,
        });

        if ctx.accounts.position.voting_rights_level != previous_voting_rights_level {
            emit!(VotingRightsLevelUpdated {
                owner: ctx.accounts.owner.key(),
                vote_count: ctx.accounts.position.vote_count,
                previous_level: previous_voting_rights_level,
                new_level: ctx.accounts.position.voting_rights_level,
            });
        }

        Ok(())
    }

    pub fn close_governance_proposal(
        ctx: Context<CloseGovernanceProposal>,
        _proposal_id: u64,
        approved: bool,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        require!(
            ctx.accounts.proposal.status == GovernanceProposalStatus::Open,
            CryptoSeedsError::GovernanceProposalClosed
        );
        let now = Clock::get()?.unix_timestamp;
        let proposal_passed = validate_governance_proposal_close(&ctx.accounts.proposal, now)?;
        require!(
            proposal_passed == approved,
            CryptoSeedsError::GovernanceCloseResultMismatch
        );

        let proposal = &mut ctx.accounts.proposal;
        proposal.status = if approved {
            GovernanceProposalStatus::Approved
        } else {
            GovernanceProposalStatus::Rejected
        };
        proposal.closed_at = now;

        emit!(GovernanceProposalClosed {
            proposal: proposal.key(),
            approved,
            yes_votes: proposal.yes_votes,
            no_votes: proposal.no_votes,
            minimum_votes: proposal.minimum_votes,
        });

        Ok(())
    }

    pub fn register_project(
        ctx: Context<RegisterProject>,
        project_id: u64,
        required_tier: StakeTier,
        risk_level: ProjectRiskLevel,
        status: ProjectStatus,
        funding_model: ProjectFundingModel,
        metadata_hash: [u8; 32],
        receiving_account: Pubkey,
        governance_proposal: Pubkey,
        min_participation_amount: u64,
        max_wallet_participation_amount: u64,
        max_total_participation_amount: u64,
        participation_starts_at: i64,
        participation_ends_at: i64,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_project_funding_model(funding_model)?;
        validate_metadata_hash(&metadata_hash)?;
        validate_project_participation_bounds(
            min_participation_amount,
            max_wallet_participation_amount,
            max_total_participation_amount,
        )?;
        validate_project_participation_window(participation_starts_at, participation_ends_at)?;
        validate_project_initial_status(status)?;
        require!(
            required_tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );
        require!(
            receiving_account != Pubkey::default(),
            CryptoSeedsError::InvalidProjectAccount
        );
        validate_project_governance_binding(
            &ctx.accounts.governance_proposal_account,
            ctx.accounts.governance_proposal_account.key(),
            governance_proposal,
            status,
        )?;

        let project = &mut ctx.accounts.project;
        project.project_id = project_id;
        project.authority = ctx.accounts.authority.key();
        project.required_tier = required_tier;
        project.risk_level = risk_level;
        project.status = status;
        project.funding_model = funding_model;
        project.metadata_hash = metadata_hash;
        project.receiving_account = receiving_account;
        project.governance_proposal = ctx.accounts.governance_proposal_account.key();
        project.total_participants = 0;
        project.min_participation_amount = min_participation_amount;
        project.max_wallet_participation_amount = max_wallet_participation_amount;
        project.max_total_participation_amount = max_total_participation_amount;
        project.total_participation_amount = 0;
        project.participation_starts_at = participation_starts_at;
        project.participation_ends_at = participation_ends_at;
        project.cancellation_hash = [0; 32];
        project.cancelled_at = 0;
        project.refund_pool_amount = 0;
        project.total_refunded_amount = 0;
        project.participation_paused = false;
        project.current_disclosure_revision_id = 0;
        project.current_disclosure_hash = [0; 32];
        project.bump = ctx.bumps.project;

        emit!(ProjectRegistered {
            project: project.key(),
            project_id,
            required_tier,
            risk_level,
            status,
            funding_model,
            min_participation_amount,
            max_wallet_participation_amount,
            max_total_participation_amount,
            participation_starts_at,
            participation_ends_at,
        });

        Ok(())
    }

    pub fn create_project_disclosure_revision(
        ctx: Context<CreateProjectDisclosureRevision>,
        _project_id: u64,
        revision_id: u64,
        metadata_hash: [u8; 32],
        risk_disclosure_hash: [u8; 32],
        terms_hash: [u8; 32],
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_project_open_for_mutation(&ctx.accounts.project)?;
        validate_metadata_hash(&metadata_hash)?;
        validate_metadata_hash(&risk_disclosure_hash)?;
        validate_metadata_hash(&terms_hash)?;
        validate_project_disclosure_revision_id(&ctx.accounts.project, revision_id)?;

        let clock = Clock::get()?;
        let disclosure_revision = &mut ctx.accounts.disclosure_revision;
        disclosure_revision.project = ctx.accounts.project.key();
        disclosure_revision.authority = ctx.accounts.authority.key();
        disclosure_revision.revision_id = revision_id;
        disclosure_revision.metadata_hash = metadata_hash;
        disclosure_revision.risk_disclosure_hash = risk_disclosure_hash;
        disclosure_revision.terms_hash = terms_hash;
        disclosure_revision.created_at = clock.unix_timestamp;
        disclosure_revision.bump = ctx.bumps.disclosure_revision;

        ctx.accounts.project.current_disclosure_revision_id = revision_id;
        ctx.accounts.project.current_disclosure_hash = risk_disclosure_hash;

        emit!(ProjectDisclosureRevisionCreated {
            project: ctx.accounts.project.key(),
            revision_id,
            metadata_hash,
            risk_disclosure_hash,
            terms_hash,
        });

        Ok(())
    }

    pub fn grant_project_operator(
        ctx: Context<GrantProjectOperator>,
        _project_id: u64,
        operator: Pubkey,
        permissions: u16,
        expires_at: i64,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_project_open_for_mutation(&ctx.accounts.project)?;
        let clock = Clock::get()?;
        validate_project_operator_permissions(permissions)?;
        validate_project_operator_expiry(clock.unix_timestamp, expires_at)?;
        require!(
            operator != Pubkey::default() && operator != ctx.accounts.authority.key(),
            CryptoSeedsError::InvalidProjectOperator
        );

        let operator_record = &mut ctx.accounts.operator_record;
        operator_record.project = ctx.accounts.project.key();
        operator_record.operator = operator;
        operator_record.authority = ctx.accounts.authority.key();
        operator_record.permissions = permissions;
        operator_record.active = true;
        operator_record.granted_at = clock.unix_timestamp;
        operator_record.expires_at = expires_at;
        operator_record.revoked_at = 0;
        operator_record.bump = ctx.bumps.operator_record;

        emit!(ProjectOperatorGranted {
            project: operator_record.project,
            operator,
            permissions,
            expires_at,
        });

        Ok(())
    }

    pub fn revoke_project_operator(
        ctx: Context<RevokeProjectOperator>,
        _project_id: u64,
        _operator: Pubkey,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        require!(
            ctx.accounts.operator_record.active,
            CryptoSeedsError::ProjectOperatorInactive
        );

        ctx.accounts.operator_record.active = false;
        ctx.accounts.operator_record.revoked_at = Clock::get()?.unix_timestamp;

        emit!(ProjectOperatorRevoked {
            project: ctx.accounts.operator_record.project,
            operator: ctx.accounts.operator_record.operator,
        });

        Ok(())
    }

    pub fn update_project_status(
        ctx: Context<UpdateProjectStatus>,
        _project_id: u64,
        status: ProjectStatus,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        require_keys_eq!(
            ctx.accounts.project.governance_proposal,
            ctx.accounts.governance_proposal_account.key(),
            CryptoSeedsError::InvalidProjectGovernanceProposal
        );
        validate_project_status_against_governance(
            &ctx.accounts.governance_proposal_account,
            status,
        )?;
        validate_project_status_transition(ctx.accounts.project.status, status)?;

        ctx.accounts.project.status = status;

        emit!(ProjectStatusUpdated {
            project: ctx.accounts.project.key(),
            status,
        });

        Ok(())
    }

    pub fn operator_update_project_status(
        ctx: Context<OperatorUpdateProjectStatus>,
        _project_id: u64,
        status: ProjectStatus,
    ) -> Result<()> {
        validate_project_operator(
            &ctx.accounts.operator_record,
            ctx.accounts.project.key(),
            ctx.accounts.operator.key(),
            PROJECT_OPERATOR_PERMISSION_STATUS,
            Clock::get()?.unix_timestamp,
        )?;
        validate_operator_project_status(status)?;
        require_keys_eq!(
            ctx.accounts.project.governance_proposal,
            ctx.accounts.governance_proposal_account.key(),
            CryptoSeedsError::InvalidProjectGovernanceProposal
        );
        validate_project_status_against_governance(
            &ctx.accounts.governance_proposal_account,
            status,
        )?;
        validate_project_status_transition(ctx.accounts.project.status, status)?;

        ctx.accounts.project.status = status;

        emit!(ProjectStatusUpdated {
            project: ctx.accounts.project.key(),
            status,
        });

        Ok(())
    }

    pub fn set_project_pause(
        ctx: Context<SetProjectPause>,
        _project_id: u64,
        paused: bool,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_project_open_for_mutation(&ctx.accounts.project)?;
        ctx.accounts.project.participation_paused = paused;

        emit!(ProjectPauseUpdated {
            project: ctx.accounts.project.key(),
            paused,
        });

        Ok(())
    }

    pub fn operator_set_project_pause(
        ctx: Context<OperatorSetProjectPause>,
        _project_id: u64,
        paused: bool,
    ) -> Result<()> {
        validate_project_operator(
            &ctx.accounts.operator_record,
            ctx.accounts.project.key(),
            ctx.accounts.operator.key(),
            PROJECT_OPERATOR_PERMISSION_PAUSE,
            Clock::get()?.unix_timestamp,
        )?;
        validate_project_open_for_mutation(&ctx.accounts.project)?;
        ctx.accounts.project.participation_paused = paused;

        emit!(ProjectPauseUpdated {
            project: ctx.accounts.project.key(),
            paused,
        });

        Ok(())
    }

    pub fn cancel_project(
        ctx: Context<CancelProject>,
        _project_id: u64,
        cancellation_hash: [u8; 32],
        refund_pool_amount: u64,
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_metadata_hash(&cancellation_hash)?;
        cancel_project_accounting(
            &mut ctx.accounts.project,
            Clock::get()?.unix_timestamp,
            cancellation_hash,
            refund_pool_amount,
        )?;

        emit!(ProjectCancelled {
            project: ctx.accounts.project.key(),
            cancelled_at: ctx.accounts.project.cancelled_at,
            refund_pool_amount,
        });

        Ok(())
    }

    pub fn record_project_refund(
        ctx: Context<RecordProjectRefund>,
        _project_id: u64,
        refund_amount: u64,
        refund_metadata_hash: [u8; 32],
    ) -> Result<()> {
        validate_project_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_metadata_hash(&refund_metadata_hash)?;
        record_project_refund_accounting(&mut ctx.accounts.project, refund_amount)?;

        emit!(ProjectRefundRecorded {
            project: ctx.accounts.project.key(),
            refund_amount,
            total_refunded_amount: ctx.accounts.project.total_refunded_amount,
            refund_metadata_hash,
        });

        Ok(())
    }

    pub fn participate_project(
        ctx: Context<ParticipateProject>,
        _project_id: u64,
        participation_amount: u64,
        disclosure_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        validate_metadata_hash(&disclosure_hash)?;
        require!(participation_amount > 0, CryptoSeedsError::InvalidAmount);
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts
                .position
                .tier
                .can_access(ctx.accounts.project.required_tier),
            CryptoSeedsError::InsufficientTier
        );
        require!(
            ctx.accounts.project.current_disclosure_revision_id > 0,
            CryptoSeedsError::ProjectDisclosureRequired
        );
        require_keys_eq!(
            ctx.accounts.project_disclosure_revision.project,
            ctx.accounts.project.key(),
            CryptoSeedsError::InvalidProjectDisclosureRevision
        );
        require!(
            ctx.accounts.project_disclosure_revision.revision_id
                == ctx.accounts.project.current_disclosure_revision_id,
            CryptoSeedsError::InvalidProjectDisclosureRevision
        );
        require!(
            ctx.accounts
                .project_disclosure_revision
                .risk_disclosure_hash
                == disclosure_hash
                && ctx.accounts.project.current_disclosure_hash == disclosure_hash,
            CryptoSeedsError::ProjectDisclosureMismatch
        );
        require!(
            ctx.accounts.project.status.is_participation_open(),
            CryptoSeedsError::ProjectNotOpen
        );
        validate_project_participation_not_paused(&ctx.accounts.project)?;

        let clock = Clock::get()?;
        validate_project_participation_window_open(&ctx.accounts.project, clock.unix_timestamp)?;
        let project_key = ctx.accounts.project.key();
        record_project_participation_amount(&mut ctx.accounts.project, participation_amount)?;

        let participation = &mut ctx.accounts.participation;
        participation.project = project_key;
        participation.wallet = ctx.accounts.owner.key();
        participation.participation_amount = participation_amount;
        participation.disclosure_hash = disclosure_hash;
        participation.joined_at = clock.unix_timestamp;
        participation.status = ProjectParticipationStatus::Active;
        participation.bump = ctx.bumps.participation;

        emit!(ProjectParticipationRecorded {
            project: participation.project,
            wallet: participation.wallet,
            participation_amount,
            total_participation_amount: ctx.accounts.project.total_participation_amount,
            total_participants: ctx.accounts.project.total_participants,
        });

        Ok(())
    }

    pub fn create_seedbot_permission(
        ctx: Context<CreateSeedBotPermission>,
        permission_hash: [u8; 32],
        expires_at: i64,
        max_trade_amount: u64,
        max_daily_volume_amount: u64,
        max_daily_trades: u16,
        max_slippage_bps: u16,
    ) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        validate_metadata_hash(&permission_hash)?;
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );
        let created_at = Clock::get()?.unix_timestamp;
        validate_seedbot_permission_limits_at(
            created_at,
            expires_at,
            max_trade_amount,
            max_daily_volume_amount,
            max_daily_trades,
            max_slippage_bps,
        )?;

        let permission = &mut ctx.accounts.permission;
        permission.owner = ctx.accounts.owner.key();
        permission.position = ctx.accounts.position.key();
        permission.permission_hash = permission_hash;
        permission.created_at = created_at;
        permission.expires_at = expires_at;
        permission.max_trade_amount = max_trade_amount;
        permission.max_daily_volume_amount = max_daily_volume_amount;
        permission.max_daily_trades = max_daily_trades;
        permission.max_slippage_bps = max_slippage_bps;
        permission.tier_at_creation = ctx.accounts.position.tier;
        permission.staked_amount_at_creation = ctx.accounts.position.staked_amount;
        permission.staking_start_ts_at_creation = ctx.accounts.position.staking_start_ts;
        permission.revoked = false;
        permission.bump = ctx.bumps.permission;
        permission.usage_day_start_ts = 0;
        permission.daily_volume_used_amount = 0;
        permission.daily_trades_used = 0;
        permission.total_volume_used_amount = 0;
        permission.total_trades_used = 0;
        permission.last_execution_ts = 0;

        emit!(SeedBotPermissionCreated {
            owner: permission.owner,
            position: permission.position,
            created_at,
            expires_at,
            max_trade_amount,
            max_daily_volume_amount,
            max_daily_trades,
            max_slippage_bps,
            tier_at_creation: permission.tier_at_creation,
            staked_amount_at_creation: permission.staked_amount_at_creation,
        });

        Ok(())
    }

    pub fn revoke_seedbot_permission(ctx: Context<RevokeSeedBotPermission>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.permission.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            !ctx.accounts.permission.revoked,
            CryptoSeedsError::SeedBotPermissionRevoked
        );

        ctx.accounts.permission.revoked = true;

        emit!(SeedBotPermissionRevoked {
            owner: ctx.accounts.owner.key(),
        });

        Ok(())
    }

    pub fn update_seedbot_permission(
        ctx: Context<UpdateSeedBotPermission>,
        permission_hash: [u8; 32],
        expires_at: i64,
        max_trade_amount: u64,
        max_daily_volume_amount: u64,
        max_daily_trades: u16,
        max_slippage_bps: u16,
    ) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        validate_metadata_hash(&permission_hash)?;
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.permission.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.permission.position,
            ctx.accounts.position.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );

        let updated_at = Clock::get()?.unix_timestamp;
        validate_seedbot_permission_limits_at(
            updated_at,
            expires_at,
            max_trade_amount,
            max_daily_volume_amount,
            max_daily_trades,
            max_slippage_bps,
        )?;

        let permission = &mut ctx.accounts.permission;
        permission.permission_hash = permission_hash;
        permission.created_at = updated_at;
        permission.expires_at = expires_at;
        permission.max_trade_amount = max_trade_amount;
        permission.max_daily_volume_amount = max_daily_volume_amount;
        permission.max_daily_trades = max_daily_trades;
        permission.max_slippage_bps = max_slippage_bps;
        permission.tier_at_creation = ctx.accounts.position.tier;
        permission.staked_amount_at_creation = ctx.accounts.position.staked_amount;
        permission.staking_start_ts_at_creation = ctx.accounts.position.staking_start_ts;
        permission.revoked = false;
        permission.usage_day_start_ts = 0;
        permission.daily_volume_used_amount = 0;
        permission.daily_trades_used = 0;
        permission.total_volume_used_amount = 0;
        permission.total_trades_used = 0;
        permission.last_execution_ts = 0;

        emit!(SeedBotPermissionUpdated {
            owner: permission.owner,
            position: permission.position,
            updated_at,
            expires_at,
            max_trade_amount,
            max_daily_volume_amount,
            max_daily_trades,
            max_slippage_bps,
            tier_at_creation: permission.tier_at_creation,
            staked_amount_at_creation: permission.staked_amount_at_creation,
        });

        Ok(())
    }

    pub fn record_seedbot_usage(
        ctx: Context<RecordSeedBotUsage>,
        execution_hash: [u8; 32],
        trade_amount: u64,
        slippage_bps: u16,
    ) -> Result<()> {
        require!(
            !ctx.accounts.config.paused,
            CryptoSeedsError::ProtocolPaused
        );
        validate_metadata_hash(&execution_hash)?;
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.permission.owner,
            ctx.accounts.owner.key(),
            CryptoSeedsError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.permission.position,
            ctx.accounts.position.key(),
            CryptoSeedsError::Unauthorized
        );
        require!(
            ctx.accounts.position.tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );

        let recorded_at = Clock::get()?.unix_timestamp;
        record_seedbot_usage_at(
            &mut ctx.accounts.permission,
            recorded_at,
            trade_amount,
            slippage_bps,
        )?;

        emit!(SeedBotUsageRecorded {
            owner: ctx.accounts.permission.owner,
            position: ctx.accounts.permission.position,
            execution_hash,
            recorded_at,
            trade_amount,
            slippage_bps,
            daily_volume_used_amount: ctx.accounts.permission.daily_volume_used_amount,
            daily_trades_used: ctx.accounts.permission.daily_trades_used,
            total_volume_used_amount: ctx.accounts.permission.total_volume_used_amount,
            total_trades_used: ctx.accounts.permission.total_trades_used,
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

#[derive(Accounts)]
pub struct InitializeRewardConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = ryp_mint)]
    pub config: Account<'info, ProtocolConfig>,
    pub ryp_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + RewardConfig::INIT_SPACE,
        seeds = [REWARD_CONFIG_SEED],
        bump
    )]
    pub reward_config: Box<Account<'info, RewardConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(role: RewardVaultRole)]
pub struct RegisterRewardVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Box<Account<'info, RewardConfig>>,
    #[account(
        init,
        payer = authority,
        space = 8 + RewardVaultState::INIT_SPACE,
        seeds = [REWARD_VAULT_STATE_SEED, reward_config.key().as_ref(), role.seed()],
        bump
    )]
    pub reward_vault_state: Account<'info, RewardVaultState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(role: RewardVaultRole)]
pub struct VerifyRewardVault<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [REWARD_VAULT_STATE_SEED, reward_config.key().as_ref(), role.seed()],
        bump = reward_vault_state.bump
    )]
    pub reward_vault_state: Account<'info, RewardVaultState>,
}

#[derive(Accounts)]
pub struct RoutePlatformFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = ryp_mint)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Box<Account<'info, RewardConfig>>,
    #[account(
        mut,
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::HolderReward.seed()
        ],
        bump = holder_reward_vault_state.bump
    )]
    pub holder_reward_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        mut,
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::StakerReward.seed()
        ],
        bump = staker_reward_vault_state.bump
    )]
    pub staker_reward_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        mut,
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::IndependentTreasury.seed()
        ],
        bump = independent_treasury_vault_state.bump
    )]
    pub independent_treasury_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        mut,
        constraint = payer_fee_account.mint == ryp_mint.key() @ CryptoSeedsError::InvalidRewardVault,
        constraint = payer_fee_account.owner == payer.key() @ CryptoSeedsError::Unauthorized
    )]
    pub payer_fee_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = holder_reward_vault.key() == holder_reward_vault_state.vault_address @ CryptoSeedsError::InvalidRewardVault,
        constraint = holder_reward_vault.mint == ryp_mint.key() @ CryptoSeedsError::InvalidRewardVault
    )]
    pub holder_reward_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = staker_reward_vault.key() == staker_reward_vault_state.vault_address @ CryptoSeedsError::InvalidRewardVault,
        constraint = staker_reward_vault.mint == ryp_mint.key() @ CryptoSeedsError::InvalidRewardVault
    )]
    pub staker_reward_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = independent_treasury_vault.key() == independent_treasury_vault_state.vault_address @ CryptoSeedsError::InvalidRewardVault,
        constraint = independent_treasury_vault.mint == ryp_mint.key() @ CryptoSeedsError::InvalidRewardVault
    )]
    pub independent_treasury_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub ryp_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct DraftRewardEpoch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::HolderReward.seed()
        ],
        bump = holder_reward_vault_state.bump
    )]
    pub holder_reward_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::StakerReward.seed()
        ],
        bump = staker_reward_vault_state.bump
    )]
    pub staker_reward_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::IndependentTreasury.seed()
        ],
        bump = independent_treasury_vault_state.bump
    )]
    pub independent_treasury_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::DeliveryCostReserve.seed()
        ],
        bump = delivery_cost_reserve_state.bump
    )]
    pub delivery_cost_reserve_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            RewardVaultRole::Rollover.seed()
        ],
        bump = rollover_vault_state.bump
    )]
    pub rollover_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        init,
        payer = authority,
        space = 8 + RewardEpoch::INIT_SPACE,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub reward_epoch: Box<Account<'info, RewardEpoch>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFeeConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct TransferProtocolAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct AcceptProtocolAuthority<'info> {
    pub pending_authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct TransferProjectAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct AcceptProjectAuthority<'info> {
    pub pending_authority: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
pub struct TransferRewardAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
}

#[derive(Accounts)]
pub struct AcceptRewardAuthority<'info> {
    pub pending_authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct ReviewRewardEpoch<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Box<Account<'info, RewardEpoch>>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct CancelRewardEpoch<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Account<'info, RewardEpoch>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64)]
pub struct ExpireRewardEpochClaims<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Account<'info, RewardEpoch>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64, reward_role: RewardVaultRole, wallet: Pubkey)]
pub struct CreateRewardClaimRecord<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Account<'info, RewardEpoch>,
    #[account(
        init,
        payer = authority,
        space = 8 + RewardClaimRecord::INIT_SPACE,
        seeds = [
            REWARD_CLAIM_SEED,
            reward_epoch.key().as_ref(),
            reward_role.seed(),
            wallet.as_ref()
        ],
        bump
    )]
    pub claim_record: Box<Account<'info, RewardClaimRecord>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64, reward_role: RewardVaultRole)]
pub struct CreateRewardClaimRecordFromProof<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Account<'info, RewardConfig>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Account<'info, RewardEpoch>,
    #[account(
        init,
        payer = owner,
        space = 8 + RewardClaimRecord::INIT_SPACE,
        seeds = [
            REWARD_CLAIM_SEED,
            reward_epoch.key().as_ref(),
            reward_role.seed(),
            owner.key().as_ref()
        ],
        bump
    )]
    pub claim_record: Box<Account<'info, RewardClaimRecord>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reward_role: RewardVaultRole)]
pub struct ClaimRewardRecord<'info> {
    pub owner: Signer<'info>,
    #[account()]
    pub reward_epoch: Account<'info, RewardEpoch>,
    #[account(
        mut,
        seeds = [
            REWARD_CLAIM_SEED,
            reward_epoch.key().as_ref(),
            reward_role.seed(),
            owner.key().as_ref()
        ],
        bump = claim_record.bump
    )]
    pub claim_record: Account<'info, RewardClaimRecord>,
}

#[derive(Accounts)]
#[instruction(epoch_id: u64, reward_role: RewardVaultRole)]
pub struct ClaimRewardTokens<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [REWARD_CONFIG_SEED], bump = reward_config.bump)]
    pub reward_config: Box<Account<'info, RewardConfig>>,
    #[account(
        mut,
        seeds = [
            REWARD_EPOCH_SEED,
            reward_config.key().as_ref(),
            epoch_id.to_le_bytes().as_ref()
        ],
        bump = reward_epoch.bump
    )]
    pub reward_epoch: Box<Account<'info, RewardEpoch>>,
    #[account(
        mut,
        seeds = [
            REWARD_CLAIM_SEED,
            reward_epoch.key().as_ref(),
            reward_role.seed(),
            owner.key().as_ref()
        ],
        bump = claim_record.bump
    )]
    pub claim_record: Box<Account<'info, RewardClaimRecord>>,
    #[account(
        seeds = [
            REWARD_VAULT_STATE_SEED,
            reward_config.key().as_ref(),
            reward_role.seed()
        ],
        bump = reward_vault_state.bump
    )]
    pub reward_vault_state: Box<Account<'info, RewardVaultState>>,
    #[account(
        mut,
        constraint = reward_source_vault.key() == reward_vault_state.vault_address @ CryptoSeedsError::InvalidRewardVault,
        constraint = reward_source_vault.mint == reward_mint.key() @ CryptoSeedsError::InvalidRewardVault,
        constraint = reward_source_vault.owner == reward_config.key() @ CryptoSeedsError::InvalidRewardVault
    )]
    pub reward_source_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = owner_reward_account.mint == reward_mint.key() @ CryptoSeedsError::InvalidRewardVault,
        constraint = owner_reward_account.owner == owner.key() @ CryptoSeedsError::InvalidRewardVault
    )]
    pub owner_reward_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub reward_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CreateGovernanceProposal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = authority,
        space = 8 + GovernanceProposal::INIT_SPACE,
        seeds = [GOVERNANCE_PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CastGovernanceVote<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        seeds = [GOVERNANCE_PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
    #[account(
        init,
        payer = owner,
        space = 8 + GovernanceVoteRecord::INIT_SPACE,
        seeds = [GOVERNANCE_VOTE_SEED, proposal.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, GovernanceVoteRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct CloseGovernanceProposal<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [GOVERNANCE_PROPOSAL_SEED, proposal_id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct RegisterProject<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    pub governance_proposal_account: Account<'info, GovernanceProposal>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProjectRecord::INIT_SPACE,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump
    )]
    pub project: Account<'info, ProjectRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: u64, revision_id: u64)]
pub struct CreateProjectDisclosureRevision<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProjectDisclosureRevision::INIT_SPACE,
        seeds = [
            PROJECT_DISCLOSURE_REVISION_SEED,
            project.key().as_ref(),
            revision_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub disclosure_revision: Account<'info, ProjectDisclosureRevision>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: u64, operator: Pubkey)]
pub struct GrantProjectOperator<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        init,
        payer = authority,
        space = 8 + ProjectOperatorRecord::INIT_SPACE,
        seeds = [PROJECT_OPERATOR_SEED, project.key().as_ref(), operator.as_ref()],
        bump
    )]
    pub operator_record: Account<'info, ProjectOperatorRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: u64, operator: Pubkey)]
pub struct RevokeProjectOperator<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        mut,
        seeds = [PROJECT_OPERATOR_SEED, project.key().as_ref(), operator.as_ref()],
        bump = operator_record.bump
    )]
    pub operator_record: Account<'info, ProjectOperatorRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct UpdateProjectStatus<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    pub governance_proposal_account: Account<'info, GovernanceProposal>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct OperatorUpdateProjectStatus<'info> {
    pub operator: Signer<'info>,
    pub governance_proposal_account: Account<'info, GovernanceProposal>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        seeds = [PROJECT_OPERATOR_SEED, project.key().as_ref(), operator.key().as_ref()],
        bump = operator_record.bump
    )]
    pub operator_record: Account<'info, ProjectOperatorRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct SetProjectPause<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct OperatorSetProjectPause<'info> {
    pub operator: Signer<'info>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        seeds = [PROJECT_OPERATOR_SEED, project.key().as_ref(), operator.key().as_ref()],
        bump = operator_record.bump
    )]
    pub operator_record: Account<'info, ProjectOperatorRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct CancelProject<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct RecordProjectRefund<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct ParticipateProject<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        seeds = [PROJECT_RECORD_SEED, project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, ProjectRecord>,
    #[account(
        seeds = [
            PROJECT_DISCLOSURE_REVISION_SEED,
            project.key().as_ref(),
            project.current_disclosure_revision_id.to_le_bytes().as_ref()
        ],
        bump = project_disclosure_revision.bump
    )]
    pub project_disclosure_revision: Account<'info, ProjectDisclosureRevision>,
    #[account(
        init,
        payer = owner,
        space = 8 + ProjectParticipationRecord::INIT_SPACE,
        seeds = [PROJECT_PARTICIPATION_SEED, project.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub participation: Account<'info, ProjectParticipationRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSeedBotPermission<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(
        init,
        payer = owner,
        space = 8 + SeedBotPermission::INIT_SPACE,
        seeds = [SEEDBOT_PERMISSION_SEED, owner.key().as_ref()],
        bump
    )]
    pub permission: Account<'info, SeedBotPermission>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeSeedBotPermission<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [SEEDBOT_PERMISSION_SEED, owner.key().as_ref()],
        bump = permission.bump
    )]
    pub permission: Account<'info, SeedBotPermission>,
}

#[derive(Accounts)]
pub struct UpdateSeedBotPermission<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        seeds = [SEEDBOT_PERMISSION_SEED, owner.key().as_ref()],
        bump = permission.bump
    )]
    pub permission: Account<'info, SeedBotPermission>,
}

#[derive(Accounts)]
pub struct RecordSeedBotUsage<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, ProtocolConfig>,
    #[account(
        seeds = [STAKE_POSITION_SEED, owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, StakePosition>,
    #[account(
        mut,
        seeds = [SEEDBOT_PERMISSION_SEED, owner.key().as_ref()],
        bump = permission.bump
    )]
    pub permission: Account<'info, SeedBotPermission>,
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
    pub pending_authority: Pubkey,
    pub project_authority: Pubkey,
    pub pending_project_authority: Pubkey,
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
    pub golden_key_issued_at: i64,
    pub golden_key_revoked_at: i64,
    pub voting_rights_activated_at: i64,
    pub voting_rights_level: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RewardConfig {
    pub authority: Pubkey,
    pub protocol_config: Pubkey,
    pub ryp_mint: Pubkey,
    pub epoch_cadence_seconds: i64,
    pub holder_split_bps: u16,
    pub staker_split_bps: u16,
    pub treasury_split_bps: u16,
    pub registered_vault_roles_mask: u8,
    pub verified_vault_roles_mask: u8,
    pub total_epoch_drafts: u64,
    pub total_routed_fee_amount: u64,
    pub paused: bool,
    pub draft_only: bool,
    pub bump: u8,
    pub pending_authority: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct RewardVaultState {
    pub reward_config: Pubkey,
    pub role: RewardVaultRole,
    pub reward_mint: Pubkey,
    pub vault_address: Pubkey,
    pub custody_model: RewardVaultCustodyModel,
    pub verification_status: RewardVaultVerificationStatus,
    pub metadata_hash: [u8; 32],
    pub total_funded_amount: u64,
    pub receives_user_funds: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RewardEpoch {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
    pub snapshot_taken_at: i64,
    pub created_at: i64,
    pub reward_mint: Pubkey,
    pub reward_pool_amount: u64,
    pub distributed_net_amount: u64,
    pub reserved_delivery_cost_amount: u64,
    pub rolled_forward_amount: u64,
    pub recorded_gross_allocation_amount: u64,
    pub recorded_net_claim_amount: u64,
    pub claimed_net_amount: u64,
    pub claim_expires_at: i64,
    pub expired_unclaimed_net_amount: u64,
    pub expired_recorded_at: i64,
    pub exclusion_list_hash: [u8; 32],
    pub claim_merkle_root: [u8; 32],
    pub status: RewardEpochStatus,
    pub execution_blocked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RewardClaimRecord {
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub gross_allocation_amount: u64,
    pub delivery_cost_amount: u64,
    pub net_claim_amount: u64,
    pub rolled_forward_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RewardExclusionList {
    pub reward_config: Pubkey,
    pub metadata_hash: [u8; 32],
    pub excluded_wallet_count: u32,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GovernanceProposal {
    pub proposal_id: u64,
    pub authority: Pubkey,
    pub category: GovernanceProposalCategory,
    pub status: GovernanceProposalStatus,
    pub metadata_hash: [u8; 32],
    pub yes_votes: u64,
    pub no_votes: u64,
    pub created_at: i64,
    pub voting_starts_at: i64,
    pub voting_ends_at: i64,
    pub minimum_votes: u64,
    pub closed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GovernanceVoteRecord {
    pub proposal: Pubkey,
    pub wallet: Pubkey,
    pub approve: bool,
    pub voted_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProjectRecord {
    pub project_id: u64,
    pub authority: Pubkey,
    pub required_tier: StakeTier,
    pub risk_level: ProjectRiskLevel,
    pub status: ProjectStatus,
    pub funding_model: ProjectFundingModel,
    pub metadata_hash: [u8; 32],
    pub receiving_account: Pubkey,
    pub governance_proposal: Pubkey,
    pub total_participants: u64,
    pub min_participation_amount: u64,
    pub max_wallet_participation_amount: u64,
    pub max_total_participation_amount: u64,
    pub total_participation_amount: u64,
    pub participation_starts_at: i64,
    pub participation_ends_at: i64,
    pub cancellation_hash: [u8; 32],
    pub cancelled_at: i64,
    pub refund_pool_amount: u64,
    pub total_refunded_amount: u64,
    pub participation_paused: bool,
    pub current_disclosure_revision_id: u64,
    pub current_disclosure_hash: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProjectDisclosureRevision {
    pub project: Pubkey,
    pub authority: Pubkey,
    pub revision_id: u64,
    pub metadata_hash: [u8; 32],
    pub risk_disclosure_hash: [u8; 32],
    pub terms_hash: [u8; 32],
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProjectParticipationRecord {
    pub project: Pubkey,
    pub wallet: Pubkey,
    pub participation_amount: u64,
    pub disclosure_hash: [u8; 32],
    pub joined_at: i64,
    pub status: ProjectParticipationStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProjectOperatorRecord {
    pub project: Pubkey,
    pub operator: Pubkey,
    pub authority: Pubkey,
    pub permissions: u16,
    pub active: bool,
    pub granted_at: i64,
    pub expires_at: i64,
    pub revoked_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SeedBotPermission {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub permission_hash: [u8; 32],
    pub created_at: i64,
    pub expires_at: i64,
    pub max_trade_amount: u64,
    pub max_daily_volume_amount: u64,
    pub max_daily_trades: u16,
    pub max_slippage_bps: u16,
    pub tier_at_creation: StakeTier,
    pub staked_amount_at_creation: u64,
    pub staking_start_ts_at_creation: i64,
    pub revoked: bool,
    pub bump: u8,
    pub usage_day_start_ts: i64,
    pub daily_volume_used_amount: u64,
    pub daily_trades_used: u16,
    pub total_volume_used_amount: u64,
    pub total_trades_used: u64,
    pub last_execution_ts: i64,
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

    pub fn rank(self) -> u8 {
        match self {
            Self::None => 0,
            Self::Seed => 1,
            Self::Sprout => 2,
            Self::Sapling => 3,
            Self::Tree => 4,
            Self::Fruit => 5,
        }
    }

    pub fn can_access(self, required_tier: StakeTier) -> bool {
        self.rank() >= required_tier.rank() && required_tier != StakeTier::None
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GovernanceProposalCategory {
    ProjectApproval,
    TreasuryAllocation,
    ProtocolUpgrade,
    DonationCause,
    SeedBotFeature,
    RiskPolicy,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GovernanceProposalStatus {
    Open,
    Approved,
    Rejected,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProjectRiskLevel {
    Low,
    Medium,
    High,
    Experimental,
    Donation,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProjectStatus {
    Proposed,
    UnderReview,
    GovernanceVote,
    Approved,
    Open,
    Active,
    MilestoneReached,
    HarvestAvailable,
    Completed,
    Paused,
    Rejected,
    Cancelled,
}

impl ProjectStatus {
    pub fn is_participation_open(self) -> bool {
        matches!(
            self,
            Self::Open | Self::Active | Self::MilestoneReached | Self::HarvestAvailable
        )
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProjectFundingModel {
    RecordOnly,
    DirectSettlement,
    ProgramEscrow,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProjectParticipationStatus {
    Active,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RewardVaultRole {
    HolderReward,
    StakerReward,
    IndependentTreasury,
    DeliveryCostReserve,
    Rollover,
}

impl RewardVaultRole {
    pub fn mask(self) -> u8 {
        match self {
            Self::HolderReward => 1 << 0,
            Self::StakerReward => 1 << 1,
            Self::IndependentTreasury => 1 << 2,
            Self::DeliveryCostReserve => 1 << 3,
            Self::Rollover => 1 << 4,
        }
    }

    pub fn seed(self) -> &'static [u8] {
        match self {
            Self::HolderReward => b"holder-reward",
            Self::StakerReward => b"staker-reward",
            Self::IndependentTreasury => b"independent-treasury",
            Self::DeliveryCostReserve => b"delivery-cost-reserve",
            Self::Rollover => b"rollover",
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RewardVaultCustodyModel {
    ProgramControlled,
    TreasuryControlled,
    DisclosurePending,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RewardVaultVerificationStatus {
    Draft,
    PendingVerification,
    Verified,
    Disabled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RewardEpochStatus {
    Drafted,
    Reviewed,
    Cancelled,
    Expired,
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
pub struct GoldenKeyReceiptUpdated {
    pub owner: Pubkey,
    pub active: bool,
    pub issued_at: i64,
    pub revoked_at: i64,
}

#[event]
pub struct VotingRightsActivated {
    pub owner: Pubkey,
    pub activated_at: i64,
    pub voting_rights_level: u8,
}

#[event]
pub struct VotingRightsLevelUpdated {
    pub owner: Pubkey,
    pub vote_count: u32,
    pub previous_level: u8,
    pub new_level: u8,
}

#[event]
pub struct RewardConfigInitialized {
    pub authority: Pubkey,
    pub ryp_mint: Pubkey,
    pub epoch_cadence_seconds: i64,
    pub holder_split_bps: u16,
    pub staker_split_bps: u16,
    pub treasury_split_bps: u16,
}

#[event]
pub struct RewardVaultRegistered {
    pub reward_config: Pubkey,
    pub role: RewardVaultRole,
    pub vault_address: Pubkey,
    pub custody_model: RewardVaultCustodyModel,
}

#[event]
pub struct RewardVaultVerified {
    pub reward_config: Pubkey,
    pub role: RewardVaultRole,
    pub vault_address: Pubkey,
}

#[event]
pub struct PlatformFeeRouted {
    pub payer: Pubkey,
    pub reward_config: Pubkey,
    pub fee_amount: u64,
    pub holder_amount: u64,
    pub staker_amount: u64,
    pub treasury_amount: u64,
}

#[event]
pub struct RewardEpochDrafted {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
    pub snapshot_taken_at: i64,
    pub reward_mint: Pubkey,
    pub reward_pool_amount: u64,
    pub distributed_net_amount: u64,
    pub reserved_delivery_cost_amount: u64,
    pub rolled_forward_amount: u64,
    pub claim_expires_at: i64,
    pub exclusion_list_hash: [u8; 32],
    pub claim_merkle_root: [u8; 32],
    pub execution_blocked: bool,
}

#[event]
pub struct FeeConfigUpdated {
    pub authority: Pubkey,
    pub base_fee_bps: u16,
    pub tier_fee_reduction_bps: [u16; 5],
}

#[event]
pub struct ProtocolAuthorityTransferStarted {
    pub current_authority: Pubkey,
    pub pending_authority: Pubkey,
}

#[event]
pub struct ProtocolAuthorityTransferred {
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct ProjectAuthorityTransferStarted {
    pub current_authority: Pubkey,
    pub pending_authority: Pubkey,
}

#[event]
pub struct ProjectAuthorityTransferred {
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct RewardAuthorityTransferStarted {
    pub reward_config: Pubkey,
    pub current_authority: Pubkey,
    pub pending_authority: Pubkey,
}

#[event]
pub struct RewardAuthorityTransferred {
    pub reward_config: Pubkey,
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct RewardEpochReviewed {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
    pub claim_merkle_root: [u8; 32],
    pub claim_expires_at: i64,
    pub execution_blocked: bool,
}

#[event]
pub struct RewardEpochCancelled {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
    pub execution_blocked: bool,
}

#[event]
pub struct RewardEpochClaimsExpired {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
    pub expired_at: i64,
    pub expired_unclaimed_net_amount: u64,
    pub claimed_net_amount: u64,
}

#[event]
pub struct RewardClaimRecordCreated {
    pub claim_record: Pubkey,
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub gross_allocation_amount: u64,
    pub delivery_cost_amount: u64,
    pub net_claim_amount: u64,
    pub rolled_forward_amount: u64,
}

#[event]
pub struct RewardClaimProofVerified {
    pub claim_record: Pubkey,
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub gross_allocation_amount: u64,
    pub delivery_cost_amount: u64,
    pub net_claim_amount: u64,
    pub rolled_forward_amount: u64,
    pub leaf_index: u64,
}

#[event]
pub struct RewardClaimed {
    pub claim_record: Pubkey,
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub delivery_cost_amount: u64,
    pub net_claim_amount: u64,
    pub rolled_forward_amount: u64,
}

#[event]
pub struct GovernanceProposalCreated {
    pub proposal: Pubkey,
    pub proposal_id: u64,
    pub category: GovernanceProposalCategory,
    pub voting_starts_at: i64,
    pub voting_ends_at: i64,
    pub minimum_votes: u64,
}

#[event]
pub struct GovernanceVoteCast {
    pub proposal: Pubkey,
    pub wallet: Pubkey,
    pub approve: bool,
}

#[event]
pub struct GovernanceProposalClosed {
    pub proposal: Pubkey,
    pub approved: bool,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub minimum_votes: u64,
}

#[event]
pub struct ProjectRegistered {
    pub project: Pubkey,
    pub project_id: u64,
    pub required_tier: StakeTier,
    pub risk_level: ProjectRiskLevel,
    pub status: ProjectStatus,
    pub funding_model: ProjectFundingModel,
    pub min_participation_amount: u64,
    pub max_wallet_participation_amount: u64,
    pub max_total_participation_amount: u64,
    pub participation_starts_at: i64,
    pub participation_ends_at: i64,
}

#[event]
pub struct ProjectDisclosureRevisionCreated {
    pub project: Pubkey,
    pub revision_id: u64,
    pub metadata_hash: [u8; 32],
    pub risk_disclosure_hash: [u8; 32],
    pub terms_hash: [u8; 32],
}

#[event]
pub struct ProjectOperatorGranted {
    pub project: Pubkey,
    pub operator: Pubkey,
    pub permissions: u16,
    pub expires_at: i64,
}

#[event]
pub struct ProjectOperatorRevoked {
    pub project: Pubkey,
    pub operator: Pubkey,
}

#[event]
pub struct ProjectStatusUpdated {
    pub project: Pubkey,
    pub status: ProjectStatus,
}

#[event]
pub struct ProjectPauseUpdated {
    pub project: Pubkey,
    pub paused: bool,
}

#[event]
pub struct ProjectCancelled {
    pub project: Pubkey,
    pub cancelled_at: i64,
    pub refund_pool_amount: u64,
}

#[event]
pub struct ProjectRefundRecorded {
    pub project: Pubkey,
    pub refund_amount: u64,
    pub total_refunded_amount: u64,
    pub refund_metadata_hash: [u8; 32],
}

#[event]
pub struct ProjectParticipationRecorded {
    pub project: Pubkey,
    pub wallet: Pubkey,
    pub participation_amount: u64,
    pub total_participation_amount: u64,
    pub total_participants: u64,
}

#[event]
pub struct SeedBotPermissionCreated {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub created_at: i64,
    pub expires_at: i64,
    pub max_trade_amount: u64,
    pub max_daily_volume_amount: u64,
    pub max_daily_trades: u16,
    pub max_slippage_bps: u16,
    pub tier_at_creation: StakeTier,
    pub staked_amount_at_creation: u64,
}

#[event]
pub struct SeedBotPermissionRevoked {
    pub owner: Pubkey,
}

#[event]
pub struct SeedBotPermissionUpdated {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub updated_at: i64,
    pub expires_at: i64,
    pub max_trade_amount: u64,
    pub max_daily_volume_amount: u64,
    pub max_daily_trades: u16,
    pub max_slippage_bps: u16,
    pub tier_at_creation: StakeTier,
    pub staked_amount_at_creation: u64,
}

#[event]
pub struct SeedBotUsageRecorded {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub execution_hash: [u8; 32],
    pub recorded_at: i64,
    pub trade_amount: u64,
    pub slippage_bps: u16,
    pub daily_volume_used_amount: u64,
    pub daily_trades_used: u16,
    pub total_volume_used_amount: u64,
    pub total_trades_used: u64,
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
    #[msg("Reward split must total 10000 basis points.")]
    InvalidRewardSplit,
    #[msg("Reward epoch cadence is outside approved bounds.")]
    InvalidRewardCadence,
    #[msg("Reward config is paused.")]
    RewardConfigPaused,
    #[msg("Reward execution is not approved; this path is draft-only.")]
    RewardExecutionNotApproved,
    #[msg("Reward vault is invalid for the requested role or config.")]
    InvalidRewardVault,
    #[msg("Reward vault has not been verified.")]
    RewardVaultNotVerified,
    #[msg("Reward vault is disabled.")]
    RewardVaultDisabled,
    #[msg("Reward metadata hash does not match the reviewed packet.")]
    RewardMetadataMismatch,
    #[msg("Reward metadata hash is invalid.")]
    InvalidRewardMetadata,
    #[msg("Reward vault custody disclosure is still pending.")]
    RewardCustodyDisclosurePending,
    #[msg("Reward epoch accounting is not balanced.")]
    RewardEpochUnbalanced,
    #[msg("Reward pool amount is invalid.")]
    InvalidRewardPool,
    #[msg("Reward snapshot timing is outside the configured epoch cadence.")]
    InvalidRewardSnapshotTiming,
    #[msg("The provided protocol authority is invalid.")]
    InvalidAuthority,
    #[msg("Reward epoch status does not allow this action.")]
    InvalidRewardEpochStatus,
    #[msg("Reward epoch does not match the requested reward config.")]
    InvalidRewardEpochConfig,
    #[msg("Reward claim accounting is invalid.")]
    InvalidRewardClaim,
    #[msg("Reward claim records exceed the reviewed epoch allocation.")]
    RewardClaimExceedsEpoch,
    #[msg("This reward claim must use the token-transfer claim path.")]
    RewardTokenClaimRequired,
    #[msg("Reward vault custody model is not valid for token payouts.")]
    InvalidRewardVaultCustody,
    #[msg("Reward claim has already been recorded as claimed.")]
    RewardAlreadyClaimed,
    #[msg("Reward epoch does not have a claim Merkle root.")]
    RewardMerkleRootMissing,
    #[msg("Reward Merkle proof is invalid.")]
    InvalidRewardMerkleProof,
    #[msg("Reward claim window is invalid.")]
    InvalidRewardClaimWindow,
    #[msg("Reward claim window has expired.")]
    RewardClaimWindowExpired,
    #[msg("Governance proposal is not open for voting.")]
    GovernanceProposalClosed,
    #[msg("Governance voting window is invalid.")]
    InvalidGovernanceVotingWindow,
    #[msg("Governance minimum vote threshold is invalid.")]
    InvalidGovernanceMinimumVotes,
    #[msg("Governance voting has not started.")]
    GovernanceVotingNotStarted,
    #[msg("Governance voting window has ended.")]
    GovernanceVotingEnded,
    #[msg("Governance proposal voting is still open.")]
    GovernanceVotingStillOpen,
    #[msg("Governance close result does not match the recorded vote tally.")]
    GovernanceCloseResultMismatch,
    #[msg("The metadata hash is invalid.")]
    InvalidMetadata,
    #[msg("Project account is invalid.")]
    InvalidProjectAccount,
    #[msg("Project governance proposal is invalid for this action.")]
    InvalidProjectGovernanceProposal,
    #[msg("Project governance proposal is not approved for this project status.")]
    ProjectGovernanceNotApproved,
    #[msg("Project disclosure revision is required.")]
    ProjectDisclosureRequired,
    #[msg("Project disclosure revision is invalid.")]
    InvalidProjectDisclosureRevision,
    #[msg("Project disclosure hash does not match the current reviewed revision.")]
    ProjectDisclosureMismatch,
    #[msg("Project participation bounds are invalid.")]
    InvalidProjectParticipationBounds,
    #[msg("Project participation window is invalid.")]
    InvalidProjectParticipationWindow,
    #[msg("Project participation window is closed.")]
    ProjectParticipationWindowClosed,
    #[msg("Project participation amount is below the project minimum.")]
    ProjectParticipationBelowMinimum,
    #[msg("Project participation amount exceeds the wallet limit.")]
    ProjectParticipationAboveWalletLimit,
    #[msg("Project participation exceeds the project allocation cap.")]
    ProjectParticipationCapExceeded,
    #[msg("Project funding model is not enabled for this protocol version.")]
    UnsupportedProjectFundingModel,
    #[msg("Project status transition is invalid.")]
    InvalidProjectStatusTransition,
    #[msg("Project operator is invalid.")]
    InvalidProjectOperator,
    #[msg("Project operator permissions are invalid.")]
    InvalidProjectOperatorPermissions,
    #[msg("Project operator expiry is invalid.")]
    InvalidProjectOperatorExpiry,
    #[msg("Project operator record is inactive.")]
    ProjectOperatorInactive,
    #[msg("Project operator record is expired.")]
    ProjectOperatorExpired,
    #[msg("Project operator does not have permission for this action.")]
    ProjectOperatorPermissionDenied,
    #[msg("Project refund accounting exceeds the recorded refund pool.")]
    ProjectRefundExceedsPool,
    #[msg("Project must be cancelled before refund accounting is recorded.")]
    ProjectNotCancelled,
    #[msg("Wallet tier is insufficient for this action.")]
    InsufficientTier,
    #[msg("Project is not open for participation.")]
    ProjectNotOpen,
    #[msg("Project participation is paused.")]
    ProjectParticipationPaused,
    #[msg("SeedBot permission limits are invalid.")]
    InvalidSeedBotPermission,
    #[msg("SeedBot permission is already revoked.")]
    SeedBotPermissionRevoked,
    #[msg("SeedBot permission is expired.")]
    SeedBotPermissionExpired,
    #[msg("SeedBot usage exceeds the wallet-approved permission limits.")]
    SeedBotUsageLimitExceeded,
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
    for (index, reduction) in reductions.iter().enumerate() {
        require!(
            *reduction <= base_fee_bps,
            CryptoSeedsError::InvalidFeeReduction
        );
        if index > 0 {
            require!(
                *reduction >= reductions[index - 1],
                CryptoSeedsError::InvalidFeeReduction
            );
        }
    }

    Ok(())
}

fn validate_protocol_authority(config: &ProtocolConfig, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(config.authority, *authority, CryptoSeedsError::Unauthorized);
    Ok(())
}

fn validate_project_authority(config: &ProtocolConfig, authority: &Pubkey) -> Result<()> {
    require_keys_eq!(
        config.project_authority,
        *authority,
        CryptoSeedsError::Unauthorized
    );
    Ok(())
}

fn validate_project_operator_permissions(permissions: u16) -> Result<()> {
    require!(
        permissions > 0 && permissions & !PROJECT_OPERATOR_PERMISSION_MASK == 0,
        CryptoSeedsError::InvalidProjectOperatorPermissions
    );
    Ok(())
}

fn validate_project_operator_expiry(now: i64, expires_at: i64) -> Result<()> {
    require!(
        expires_at > now,
        CryptoSeedsError::InvalidProjectOperatorExpiry
    );
    require!(
        expires_at - now <= MAX_PROJECT_OPERATOR_PERMISSION_SECONDS,
        CryptoSeedsError::InvalidProjectOperatorExpiry
    );
    Ok(())
}

fn validate_project_operator(
    operator_record: &ProjectOperatorRecord,
    project: Pubkey,
    operator: Pubkey,
    required_permission: u16,
    now: i64,
) -> Result<()> {
    require_keys_eq!(
        operator_record.project,
        project,
        CryptoSeedsError::InvalidProjectOperator
    );
    require_keys_eq!(
        operator_record.operator,
        operator,
        CryptoSeedsError::InvalidProjectOperator
    );
    require!(
        operator_record.active,
        CryptoSeedsError::ProjectOperatorInactive
    );
    require!(
        operator_record.expires_at > now,
        CryptoSeedsError::ProjectOperatorExpired
    );
    require!(
        operator_record.permissions & required_permission == required_permission,
        CryptoSeedsError::ProjectOperatorPermissionDenied
    );
    Ok(())
}

fn validate_operator_project_status(status: ProjectStatus) -> Result<()> {
    require!(
        matches!(
            status,
            ProjectStatus::Approved
                | ProjectStatus::Open
                | ProjectStatus::Active
                | ProjectStatus::MilestoneReached
                | ProjectStatus::HarvestAvailable
                | ProjectStatus::Completed
                | ProjectStatus::Paused
        ),
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    Ok(())
}

fn validate_new_authority(new_authority: Pubkey, current_authority: Pubkey) -> Result<()> {
    require!(
        new_authority != Pubkey::default(),
        CryptoSeedsError::InvalidAuthority
    );
    require!(
        new_authority != current_authority,
        CryptoSeedsError::InvalidAuthority
    );
    Ok(())
}

fn validate_reward_authority(
    config: &ProtocolConfig,
    reward_config: &RewardConfig,
    config_key: Pubkey,
    authority: &Pubkey,
) -> Result<()> {
    validate_protocol_authority(config, authority)?;
    require_keys_eq!(
        reward_config.authority,
        *authority,
        CryptoSeedsError::Unauthorized
    );
    require_keys_eq!(
        reward_config.protocol_config,
        config_key,
        CryptoSeedsError::InvalidRewardVault
    );
    require_keys_eq!(
        reward_config.ryp_mint,
        config.ryp_mint,
        CryptoSeedsError::InvalidRewardVault
    );

    Ok(())
}

fn validate_reward_config_for_fee_route(
    config: &ProtocolConfig,
    reward_config: &RewardConfig,
    config_key: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        reward_config.protocol_config,
        config_key,
        CryptoSeedsError::InvalidRewardVault
    );
    require_keys_eq!(
        reward_config.ryp_mint,
        config.ryp_mint,
        CryptoSeedsError::InvalidRewardVault
    );
    validate_reward_split(
        reward_config.holder_split_bps,
        reward_config.staker_split_bps,
        reward_config.treasury_split_bps,
    )?;

    Ok(())
}

fn validate_reward_cadence(epoch_cadence_seconds: i64) -> Result<()> {
    require!(
        epoch_cadence_seconds > 0 && epoch_cadence_seconds <= MAX_REWARD_EPOCH_CADENCE_SECONDS,
        CryptoSeedsError::InvalidRewardCadence
    );

    Ok(())
}

fn validate_reward_split(
    holder_split_bps: u16,
    staker_split_bps: u16,
    treasury_split_bps: u16,
) -> Result<()> {
    let total = holder_split_bps
        .checked_add(staker_split_bps)
        .and_then(|value| value.checked_add(treasury_split_bps))
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        total == BPS_DENOMINATOR,
        CryptoSeedsError::InvalidRewardSplit
    );

    Ok(())
}

fn validate_reward_epoch_accounting(
    reward_pool_amount: u64,
    distributed_net_amount: u64,
    reserved_delivery_cost_amount: u64,
    rolled_forward_amount: u64,
) -> Result<()> {
    require!(reward_pool_amount > 0, CryptoSeedsError::InvalidRewardPool);
    let accounted = distributed_net_amount
        .checked_add(reserved_delivery_cost_amount)
        .and_then(|value| value.checked_add(rolled_forward_amount))
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        accounted == reward_pool_amount,
        CryptoSeedsError::RewardEpochUnbalanced
    );

    Ok(())
}

fn validate_reward_snapshot_timing(
    snapshot_taken_at: i64,
    created_at: i64,
    epoch_cadence_seconds: i64,
) -> Result<()> {
    require!(
        snapshot_taken_at <= created_at,
        CryptoSeedsError::InvalidRewardSnapshotTiming
    );
    let snapshot_age_seconds = created_at
        .checked_sub(snapshot_taken_at)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        snapshot_age_seconds <= epoch_cadence_seconds,
        CryptoSeedsError::InvalidRewardSnapshotTiming
    );

    Ok(())
}

fn calculate_reward_claim_expiry(now: i64, claim_window_seconds: i64) -> Result<i64> {
    require!(
        claim_window_seconds > 0 && claim_window_seconds <= MAX_REWARD_CLAIM_WINDOW_SECONDS,
        CryptoSeedsError::InvalidRewardClaimWindow
    );
    now.checked_add(claim_window_seconds)
        .ok_or(CryptoSeedsError::MathOverflow.into())
}

fn validate_reward_vault_for_epoch(
    vault_state: &RewardVaultState,
    reward_config: Pubkey,
    reward_mint: Pubkey,
    role: RewardVaultRole,
) -> Result<()> {
    require_keys_eq!(
        vault_state.reward_config,
        reward_config,
        CryptoSeedsError::InvalidRewardVault
    );
    require_keys_eq!(
        vault_state.reward_mint,
        reward_mint,
        CryptoSeedsError::InvalidRewardVault
    );
    require!(
        vault_state.role == role,
        CryptoSeedsError::InvalidRewardVault
    );
    require!(
        !vault_state.receives_user_funds,
        CryptoSeedsError::InvalidRewardVault
    );
    require!(
        vault_state.vault_address != Pubkey::default(),
        CryptoSeedsError::InvalidRewardVault
    );
    require!(
        vault_state.metadata_hash != [0; 32],
        CryptoSeedsError::InvalidRewardMetadata
    );
    require!(
        vault_state.custody_model != RewardVaultCustodyModel::DisclosurePending,
        CryptoSeedsError::RewardCustodyDisclosurePending
    );
    require!(
        vault_state.verification_status != RewardVaultVerificationStatus::Disabled,
        CryptoSeedsError::RewardVaultDisabled
    );
    require!(
        vault_state.verification_status == RewardVaultVerificationStatus::Verified,
        CryptoSeedsError::RewardVaultNotVerified
    );

    Ok(())
}

fn validate_reward_vault_for_fee_route(
    vault_state: &RewardVaultState,
    reward_config: Pubkey,
    reward_mint: Pubkey,
    role: RewardVaultRole,
) -> Result<()> {
    require!(
        matches!(
            role,
            RewardVaultRole::HolderReward
                | RewardVaultRole::StakerReward
                | RewardVaultRole::IndependentTreasury
        ),
        CryptoSeedsError::InvalidRewardVault
    );
    validate_reward_vault_for_epoch(vault_state, reward_config, reward_mint, role)?;
    if matches!(
        role,
        RewardVaultRole::HolderReward | RewardVaultRole::StakerReward
    ) {
        require!(
            vault_state.custody_model == RewardVaultCustodyModel::ProgramControlled,
            CryptoSeedsError::InvalidRewardVaultCustody
        );
    }

    Ok(())
}

fn validate_reward_epoch_status(
    actual: RewardEpochStatus,
    expected: RewardEpochStatus,
) -> Result<()> {
    require!(
        actual == expected,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    Ok(())
}

fn validate_reward_epoch_matches_config(
    reward_epoch: &RewardEpoch,
    reward_config: Pubkey,
    reward_mint: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        reward_epoch.reward_config,
        reward_config,
        CryptoSeedsError::InvalidRewardEpochConfig
    );
    require_keys_eq!(
        reward_epoch.reward_mint,
        reward_mint,
        CryptoSeedsError::InvalidRewardEpochConfig
    );

    Ok(())
}

fn validate_reward_epoch_ready_for_review(
    reward_epoch: &RewardEpoch,
    reward_config: Pubkey,
    reward_mint: Pubkey,
) -> Result<()> {
    validate_reward_epoch_matches_config(reward_epoch, reward_config, reward_mint)?;
    validate_reward_epoch_status(reward_epoch.status, RewardEpochStatus::Drafted)?;
    require!(
        reward_epoch.execution_blocked,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    require!(
        reward_epoch.claim_merkle_root != [0; 32],
        CryptoSeedsError::RewardMerkleRootMissing
    );
    require!(
        reward_epoch.recorded_gross_allocation_amount == 0
            && reward_epoch.recorded_net_claim_amount == 0
            && reward_epoch.claimed_net_amount == 0,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    validate_reward_epoch_accounting(
        reward_epoch.reward_pool_amount,
        reward_epoch.distributed_net_amount,
        reward_epoch.reserved_delivery_cost_amount,
        reward_epoch.rolled_forward_amount,
    )?;

    Ok(())
}

fn validate_reward_epoch_cancellable(reward_epoch: &RewardEpoch) -> Result<()> {
    require!(
        matches!(
            reward_epoch.status,
            RewardEpochStatus::Drafted | RewardEpochStatus::Reviewed
        ),
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    require!(
        reward_epoch.recorded_gross_allocation_amount == 0
            && reward_epoch.recorded_net_claim_amount == 0
            && reward_epoch.claimed_net_amount == 0,
        CryptoSeedsError::InvalidRewardEpochStatus
    );

    Ok(())
}

fn validate_reward_epoch_claimable_at(reward_epoch: &RewardEpoch, now: i64) -> Result<()> {
    require!(
        reward_epoch.status == RewardEpochStatus::Reviewed,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    require!(
        !reward_epoch.execution_blocked,
        CryptoSeedsError::RewardExecutionNotApproved
    );
    require!(
        reward_epoch.claim_expires_at > now,
        CryptoSeedsError::RewardClaimWindowExpired
    );

    Ok(())
}

fn expire_reward_epoch_claims_at(reward_epoch: &mut RewardEpoch, expired_at: i64) -> Result<u64> {
    require!(
        reward_epoch.status == RewardEpochStatus::Reviewed,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    require!(
        expired_at >= reward_epoch.claim_expires_at,
        CryptoSeedsError::RewardClaimWindowExpired
    );
    require!(
        reward_epoch.distributed_net_amount >= reward_epoch.claimed_net_amount,
        CryptoSeedsError::InvalidRewardClaim
    );

    let expired_unclaimed_net_amount = reward_epoch
        .distributed_net_amount
        .checked_sub(reward_epoch.claimed_net_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    reward_epoch.expired_unclaimed_net_amount = expired_unclaimed_net_amount;
    reward_epoch.expired_recorded_at = expired_at;
    reward_epoch.status = RewardEpochStatus::Expired;
    reward_epoch.execution_blocked = true;

    Ok(expired_unclaimed_net_amount)
}

fn validate_reward_claim_accounting(
    gross_allocation_amount: u64,
    delivery_cost_amount: u64,
    net_claim_amount: u64,
    rolled_forward_amount: u64,
) -> Result<()> {
    require!(
        gross_allocation_amount > 0,
        CryptoSeedsError::InvalidRewardClaim
    );
    let accounted = delivery_cost_amount
        .checked_add(net_claim_amount)
        .and_then(|value| value.checked_add(rolled_forward_amount))
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        accounted == gross_allocation_amount,
        CryptoSeedsError::InvalidRewardClaim
    );

    Ok(())
}

fn validate_reward_claim_role(reward_role: RewardVaultRole) -> Result<()> {
    require!(
        matches!(
            reward_role,
            RewardVaultRole::HolderReward | RewardVaultRole::StakerReward
        ),
        CryptoSeedsError::InvalidRewardClaim
    );

    Ok(())
}

fn record_reward_claim_amounts(
    reward_epoch: &mut RewardEpoch,
    gross_allocation_amount: u64,
    net_claim_amount: u64,
) -> Result<()> {
    let recorded_gross_allocation_amount = reward_epoch
        .recorded_gross_allocation_amount
        .checked_add(gross_allocation_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        recorded_gross_allocation_amount <= reward_epoch.reward_pool_amount,
        CryptoSeedsError::RewardClaimExceedsEpoch
    );

    let recorded_net_claim_amount = reward_epoch
        .recorded_net_claim_amount
        .checked_add(net_claim_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        recorded_net_claim_amount <= reward_epoch.distributed_net_amount,
        CryptoSeedsError::RewardClaimExceedsEpoch
    );

    reward_epoch.recorded_gross_allocation_amount = recorded_gross_allocation_amount;
    reward_epoch.recorded_net_claim_amount = recorded_net_claim_amount;

    Ok(())
}

fn validate_reward_merkle_proof(
    reward_epoch: &RewardEpoch,
    reward_epoch_key: Pubkey,
    reward_role: RewardVaultRole,
    wallet: Pubkey,
    gross_allocation_amount: u64,
    delivery_cost_amount: u64,
    net_claim_amount: u64,
    rolled_forward_amount: u64,
    leaf_index: u64,
    proof: &[[u8; 32]],
) -> Result<()> {
    require!(
        reward_epoch.claim_merkle_root != [0; 32],
        CryptoSeedsError::RewardMerkleRootMissing
    );
    require!(
        proof.len() <= MAX_REWARD_MERKLE_PROOF_NODES,
        CryptoSeedsError::InvalidRewardMerkleProof
    );

    let leaf = reward_claim_leaf_hash(
        reward_epoch_key,
        reward_role,
        wallet,
        gross_allocation_amount,
        delivery_cost_amount,
        net_claim_amount,
        rolled_forward_amount,
        leaf_index,
    );
    let calculated_root = calculate_indexed_merkle_root(leaf, leaf_index, proof)?;
    require!(
        calculated_root == reward_epoch.claim_merkle_root,
        CryptoSeedsError::InvalidRewardMerkleProof
    );

    Ok(())
}

fn reward_claim_leaf_hash(
    reward_epoch_key: Pubkey,
    reward_role: RewardVaultRole,
    wallet: Pubkey,
    gross_allocation_amount: u64,
    delivery_cost_amount: u64,
    net_claim_amount: u64,
    rolled_forward_amount: u64,
    leaf_index: u64,
) -> [u8; 32] {
    let role_variant = [reward_role as u8];
    let gross_bytes = gross_allocation_amount.to_le_bytes();
    let delivery_bytes = delivery_cost_amount.to_le_bytes();
    let net_bytes = net_claim_amount.to_le_bytes();
    let rolled_bytes = rolled_forward_amount.to_le_bytes();
    let index_bytes = leaf_index.to_le_bytes();

    keccak_hashv(&[
        b"cryptoseeds-reward-claim-v1",
        reward_epoch_key.as_ref(),
        &role_variant,
        wallet.as_ref(),
        &gross_bytes,
        &delivery_bytes,
        &net_bytes,
        &rolled_bytes,
        &index_bytes,
    ])
}

fn calculate_indexed_merkle_root(
    mut node: [u8; 32],
    mut leaf_index: u64,
    proof: &[[u8; 32]],
) -> Result<[u8; 32]> {
    for sibling in proof {
        node = if leaf_index % 2 == 0 {
            keccak_hashv(&[b"cryptoseeds-merkle-node-v1", &node, sibling])
        } else {
            keccak_hashv(&[b"cryptoseeds-merkle-node-v1", sibling, &node])
        };
        leaf_index /= 2;
    }

    Ok(node)
}

fn keccak_hashv(slices: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    for slice in slices {
        hasher.update(slice);
    }
    hasher.finalize().into()
}

fn calculate_fee_route_amounts(
    fee_amount: u64,
    holder_split_bps: u16,
    staker_split_bps: u16,
) -> Result<(u64, u64, u64)> {
    require!(fee_amount > 0, CryptoSeedsError::InvalidAmount);

    let holder_amount = calculate_bps_amount(fee_amount, holder_split_bps)?;
    let staker_amount = calculate_bps_amount(fee_amount, staker_split_bps)?;
    let treasury_amount = fee_amount
        .checked_sub(holder_amount)
        .and_then(|remaining| remaining.checked_sub(staker_amount))
        .ok_or(CryptoSeedsError::MathOverflow)?;

    Ok((holder_amount, staker_amount, treasury_amount))
}

fn calculate_bps_amount(amount: u64, bps: u16) -> Result<u64> {
    let calculated = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(CryptoSeedsError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    u64::try_from(calculated).map_err(|_| CryptoSeedsError::MathOverflow.into())
}

fn transfer_platform_fee_bucket<'info>(
    from: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    token_program: Pubkey,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let cpi_accounts = TransferChecked {
        from,
        mint,
        to,
        authority,
    };
    let cpi_context = CpiContext::new(token_program, cpi_accounts);
    transfer_checked(cpi_context, amount, decimals)
}

fn validate_reward_vault_for_token_claim(
    vault_state: &RewardVaultState,
    reward_config: Pubkey,
    reward_mint: Pubkey,
    role: RewardVaultRole,
) -> Result<()> {
    validate_reward_vault_for_epoch(vault_state, reward_config, reward_mint, role)?;
    require!(
        vault_state.custody_model == RewardVaultCustodyModel::ProgramControlled,
        CryptoSeedsError::InvalidRewardVaultCustody
    );

    Ok(())
}

fn validate_metadata_hash(metadata_hash: &[u8; 32]) -> Result<()> {
    require!(*metadata_hash != [0; 32], CryptoSeedsError::InvalidMetadata);
    Ok(())
}

fn validate_project_disclosure_revision_id(
    project: &ProjectRecord,
    revision_id: u64,
) -> Result<()> {
    require!(
        revision_id > project.current_disclosure_revision_id,
        CryptoSeedsError::InvalidProjectDisclosureRevision
    );
    Ok(())
}

fn validate_project_funding_model(funding_model: ProjectFundingModel) -> Result<()> {
    require!(
        funding_model == ProjectFundingModel::RecordOnly,
        CryptoSeedsError::UnsupportedProjectFundingModel
    );
    Ok(())
}

fn calculate_governance_voting_ends_at(
    voting_starts_at: i64,
    voting_window_seconds: i64,
) -> Result<i64> {
    require!(
        (MIN_GOVERNANCE_VOTING_WINDOW_SECONDS..=MAX_GOVERNANCE_VOTING_WINDOW_SECONDS)
            .contains(&voting_window_seconds),
        CryptoSeedsError::InvalidGovernanceVotingWindow
    );

    voting_starts_at
        .checked_add(voting_window_seconds)
        .ok_or(CryptoSeedsError::MathOverflow.into())
}

fn validate_governance_minimum_votes(minimum_votes: u64) -> Result<()> {
    require!(
        minimum_votes > 0 && minimum_votes <= MAX_GOVERNANCE_MINIMUM_VOTES,
        CryptoSeedsError::InvalidGovernanceMinimumVotes
    );
    Ok(())
}

fn validate_governance_vote_window(proposal: &GovernanceProposal, now: i64) -> Result<()> {
    require!(
        now >= proposal.voting_starts_at,
        CryptoSeedsError::GovernanceVotingNotStarted
    );
    require!(
        now < proposal.voting_ends_at,
        CryptoSeedsError::GovernanceVotingEnded
    );
    Ok(())
}

fn governance_proposal_total_votes(proposal: &GovernanceProposal) -> Result<u64> {
    proposal
        .yes_votes
        .checked_add(proposal.no_votes)
        .ok_or(CryptoSeedsError::MathOverflow.into())
}

fn governance_proposal_passed(proposal: &GovernanceProposal) -> Result<bool> {
    let total_votes = governance_proposal_total_votes(proposal)?;
    Ok(total_votes >= proposal.minimum_votes && proposal.yes_votes > proposal.no_votes)
}

fn validate_governance_proposal_close(proposal: &GovernanceProposal, now: i64) -> Result<bool> {
    require!(
        now >= proposal.voting_ends_at,
        CryptoSeedsError::GovernanceVotingStillOpen
    );
    governance_proposal_passed(proposal)
}

fn validate_project_governance_binding(
    proposal: &GovernanceProposal,
    proposal_key: Pubkey,
    expected_proposal_key: Pubkey,
    project_status: ProjectStatus,
) -> Result<()> {
    require_keys_eq!(
        proposal_key,
        expected_proposal_key,
        CryptoSeedsError::InvalidProjectGovernanceProposal
    );
    validate_project_status_against_governance(proposal, project_status)
}

fn validate_project_status_against_governance(
    proposal: &GovernanceProposal,
    project_status: ProjectStatus,
) -> Result<()> {
    require!(
        proposal.category == GovernanceProposalCategory::ProjectApproval,
        CryptoSeedsError::InvalidProjectGovernanceProposal
    );

    match project_status {
        ProjectStatus::Proposed | ProjectStatus::UnderReview | ProjectStatus::GovernanceVote => {
            require!(
                matches!(
                    proposal.status,
                    GovernanceProposalStatus::Open | GovernanceProposalStatus::Approved
                ),
                CryptoSeedsError::InvalidProjectGovernanceProposal
            );
        }
        ProjectStatus::Rejected => {
            require!(
                matches!(
                    proposal.status,
                    GovernanceProposalStatus::Rejected | GovernanceProposalStatus::Cancelled
                ),
                CryptoSeedsError::InvalidProjectGovernanceProposal
            );
        }
        ProjectStatus::Approved
        | ProjectStatus::Open
        | ProjectStatus::Active
        | ProjectStatus::MilestoneReached
        | ProjectStatus::HarvestAvailable
        | ProjectStatus::Completed
        | ProjectStatus::Paused
        | ProjectStatus::Cancelled => {
            require!(
                proposal.status == GovernanceProposalStatus::Approved,
                CryptoSeedsError::ProjectGovernanceNotApproved
            );
        }
    }

    Ok(())
}

fn validate_project_participation_bounds(
    min_participation_amount: u64,
    max_wallet_participation_amount: u64,
    max_total_participation_amount: u64,
) -> Result<()> {
    require!(
        min_participation_amount > 0
            && max_wallet_participation_amount >= min_participation_amount
            && max_total_participation_amount >= max_wallet_participation_amount,
        CryptoSeedsError::InvalidProjectParticipationBounds
    );
    Ok(())
}

fn validate_project_participation_window(
    participation_starts_at: i64,
    participation_ends_at: i64,
) -> Result<()> {
    require!(
        participation_ends_at > participation_starts_at,
        CryptoSeedsError::InvalidProjectParticipationWindow
    );
    Ok(())
}

fn validate_project_participation_window_open(project: &ProjectRecord, now: i64) -> Result<()> {
    require!(
        now >= project.participation_starts_at && now <= project.participation_ends_at,
        CryptoSeedsError::ProjectParticipationWindowClosed
    );
    Ok(())
}

fn validate_project_participation_not_paused(project: &ProjectRecord) -> Result<()> {
    require!(
        !project.participation_paused,
        CryptoSeedsError::ProjectParticipationPaused
    );
    Ok(())
}

fn validate_project_initial_status(status: ProjectStatus) -> Result<()> {
    require!(
        !matches!(status, ProjectStatus::Completed | ProjectStatus::Cancelled),
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    Ok(())
}

fn validate_project_status_transition(current: ProjectStatus, next: ProjectStatus) -> Result<()> {
    require!(
        next != ProjectStatus::Cancelled,
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    require!(
        !is_terminal_project_status(current) || current == next,
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    Ok(())
}

fn validate_unstake_remainder(staked_amount: u64, tier: StakeTier) -> Result<()> {
    require!(
        staked_amount == 0 || tier != StakeTier::None,
        CryptoSeedsError::StakeBelowSeedTier
    );
    Ok(())
}

fn validate_project_open_for_mutation(project: &ProjectRecord) -> Result<()> {
    require!(
        !is_terminal_project_status(project.status),
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    Ok(())
}

fn is_terminal_project_status(status: ProjectStatus) -> bool {
    matches!(
        status,
        ProjectStatus::Rejected | ProjectStatus::Completed | ProjectStatus::Cancelled
    )
}

fn validate_project_participation_amount(
    project: &ProjectRecord,
    participation_amount: u64,
) -> Result<u64> {
    require!(
        participation_amount >= project.min_participation_amount,
        CryptoSeedsError::ProjectParticipationBelowMinimum
    );
    require!(
        participation_amount <= project.max_wallet_participation_amount,
        CryptoSeedsError::ProjectParticipationAboveWalletLimit
    );

    let updated_total = project
        .total_participation_amount
        .checked_add(participation_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        updated_total <= project.max_total_participation_amount,
        CryptoSeedsError::ProjectParticipationCapExceeded
    );

    Ok(updated_total)
}

fn record_project_participation_amount(
    project: &mut ProjectRecord,
    participation_amount: u64,
) -> Result<()> {
    let updated_total = validate_project_participation_amount(project, participation_amount)?;
    project.total_participation_amount = updated_total;
    project.total_participants = project
        .total_participants
        .checked_add(1)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    Ok(())
}

fn cancel_project_accounting(
    project: &mut ProjectRecord,
    now: i64,
    cancellation_hash: [u8; 32],
    refund_pool_amount: u64,
) -> Result<()> {
    require!(
        project.status != ProjectStatus::Completed && project.status != ProjectStatus::Cancelled,
        CryptoSeedsError::InvalidProjectStatusTransition
    );
    require!(
        refund_pool_amount <= project.total_participation_amount,
        CryptoSeedsError::ProjectRefundExceedsPool
    );

    project.status = ProjectStatus::Cancelled;
    project.cancellation_hash = cancellation_hash;
    project.cancelled_at = now;
    project.refund_pool_amount = refund_pool_amount;
    project.total_refunded_amount = 0;

    Ok(())
}

fn record_project_refund_accounting(project: &mut ProjectRecord, refund_amount: u64) -> Result<()> {
    require!(refund_amount > 0, CryptoSeedsError::InvalidAmount);
    require!(
        project.status == ProjectStatus::Cancelled,
        CryptoSeedsError::ProjectNotCancelled
    );

    let updated_total = project
        .total_refunded_amount
        .checked_add(refund_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        updated_total <= project.refund_pool_amount,
        CryptoSeedsError::ProjectRefundExceedsPool
    );
    project.total_refunded_amount = updated_total;

    Ok(())
}

fn validate_seedbot_permission_limits_at(
    now: i64,
    expires_at: i64,
    max_trade_amount: u64,
    max_daily_volume_amount: u64,
    max_daily_trades: u16,
    max_slippage_bps: u16,
) -> Result<()> {
    require!(expires_at > now, CryptoSeedsError::InvalidSeedBotPermission);
    require!(
        expires_at
            .checked_sub(now)
            .ok_or(CryptoSeedsError::MathOverflow)?
            <= MAX_SEEDBOT_PERMISSION_SECONDS,
        CryptoSeedsError::InvalidSeedBotPermission
    );
    require!(
        max_trade_amount > 0,
        CryptoSeedsError::InvalidSeedBotPermission
    );
    require!(
        max_daily_volume_amount >= max_trade_amount,
        CryptoSeedsError::InvalidSeedBotPermission
    );
    require!(
        max_daily_trades > 0 && max_daily_trades <= MAX_SEEDBOT_DAILY_TRADES,
        CryptoSeedsError::InvalidSeedBotPermission
    );
    require!(
        max_slippage_bps <= MAX_SEEDBOT_SLIPPAGE_BPS,
        CryptoSeedsError::InvalidSeedBotPermission
    );

    Ok(())
}

fn voting_rights_level_for_vote_count(vote_count: u32) -> u8 {
    if vote_count >= VOTING_RIGHTS_LEVEL_TWO_VOTE_COUNT {
        2
    } else {
        1
    }
}

fn record_seedbot_usage_at(
    permission: &mut SeedBotPermission,
    now: i64,
    trade_amount: u64,
    slippage_bps: u16,
) -> Result<()> {
    require!(
        !permission.revoked,
        CryptoSeedsError::SeedBotPermissionRevoked
    );
    require!(
        permission.expires_at > now,
        CryptoSeedsError::SeedBotPermissionExpired
    );
    require!(trade_amount > 0, CryptoSeedsError::InvalidAmount);
    require!(
        trade_amount <= permission.max_trade_amount,
        CryptoSeedsError::SeedBotUsageLimitExceeded
    );
    require!(
        slippage_bps <= permission.max_slippage_bps,
        CryptoSeedsError::SeedBotUsageLimitExceeded
    );

    let window_expired = permission.usage_day_start_ts <= 0
        || now
            >= permission
                .usage_day_start_ts
                .checked_add(SEEDBOT_USAGE_WINDOW_SECONDS)
                .ok_or(CryptoSeedsError::MathOverflow)?;

    if window_expired {
        permission.usage_day_start_ts = now;
        permission.daily_volume_used_amount = 0;
        permission.daily_trades_used = 0;
    }

    let next_daily_volume = permission
        .daily_volume_used_amount
        .checked_add(trade_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        next_daily_volume <= permission.max_daily_volume_amount,
        CryptoSeedsError::SeedBotUsageLimitExceeded
    );

    let next_daily_trades = permission
        .daily_trades_used
        .checked_add(1)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    require!(
        next_daily_trades <= permission.max_daily_trades,
        CryptoSeedsError::SeedBotUsageLimitExceeded
    );

    permission.daily_volume_used_amount = next_daily_volume;
    permission.daily_trades_used = next_daily_trades;
    permission.total_volume_used_amount = permission
        .total_volume_used_amount
        .checked_add(trade_amount)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    permission.total_trades_used = permission
        .total_trades_used
        .checked_add(1)
        .ok_or(CryptoSeedsError::MathOverflow)?;
    permission.last_execution_ts = now;

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
    fn validates_unstake_remainder_threshold() {
        assert!(validate_unstake_remainder(0, StakeTier::None).is_ok());
        assert!(validate_unstake_remainder(THRESHOLDS[0], StakeTier::Seed).is_ok());
        assert!(validate_unstake_remainder(THRESHOLDS[0] - 1, StakeTier::None).is_err());
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
        assert!(validate_fee_reductions(350, &[0, 70, 35, 105, 140]).is_err());
    }

    #[test]
    fn validates_reward_split_totals() {
        assert!(validate_reward_split(3_334, 3_333, 3_333).is_ok());
        assert!(validate_reward_split(3_334, 3_333, 3_334).is_err());
    }

    #[test]
    fn validates_reward_cadence_bounds() {
        assert!(validate_reward_cadence(7 * 24 * 60 * 60).is_ok());
        assert!(validate_reward_cadence(0).is_err());
        assert!(validate_reward_cadence(MAX_REWARD_EPOCH_CADENCE_SECONDS + 1).is_err());
    }

    #[test]
    fn calculates_fee_route_amounts_without_losing_remainder() {
        let (holder, staker, treasury) =
            calculate_fee_route_amounts(30_000, 3_334, 3_333).expect("valid split");

        assert_eq!(holder, 10_002);
        assert_eq!(staker, 9_999);
        assert_eq!(treasury, 9_999);
        assert_eq!(holder + staker + treasury, 30_000);
        assert!(calculate_fee_route_amounts(0, 3_334, 3_333).is_err());
    }

    #[test]
    fn rejects_unbalanced_reward_epoch_accounting() {
        assert!(validate_reward_epoch_accounting(1_000, 700, 100, 200).is_ok());
        assert!(validate_reward_epoch_accounting(1_000, 700, 100, 199).is_err());
        assert!(validate_reward_epoch_accounting(0, 0, 0, 0).is_err());
    }

    #[test]
    fn validates_reward_snapshot_timing_against_cadence() {
        let now = 1_800_000_000;
        let weekly_cadence = 7 * 24 * 60 * 60;

        assert!(validate_reward_snapshot_timing(now - weekly_cadence, now, weekly_cadence).is_ok());
        assert!(validate_reward_snapshot_timing(now + 1, now, weekly_cadence).is_err());
        assert!(
            validate_reward_snapshot_timing(now - weekly_cadence - 1, now, weekly_cadence).is_err()
        );
    }

    #[test]
    fn validates_reward_claim_window_bounds() {
        let now = 1_800_000_000;

        assert_eq!(
            calculate_reward_claim_expiry(now, MAX_REWARD_CLAIM_WINDOW_SECONDS).unwrap(),
            now + MAX_REWARD_CLAIM_WINDOW_SECONDS
        );
        assert!(calculate_reward_claim_expiry(now, 0).is_err());
        assert!(calculate_reward_claim_expiry(now, MAX_REWARD_CLAIM_WINDOW_SECONDS + 1).is_err());
        assert!(calculate_reward_claim_expiry(i64::MAX, 1).is_err());
    }

    #[test]
    fn requires_verified_reward_vaults_for_epoch_drafts() {
        let reward_config = Pubkey::new_unique();
        let reward_mint = Pubkey::new_unique();
        let mut vault_state = reward_vault_state(
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
            RewardVaultVerificationStatus::Verified,
        );

        assert!(validate_reward_vault_for_epoch(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_ok());

        vault_state.verification_status = RewardVaultVerificationStatus::PendingVerification;
        assert!(validate_reward_vault_for_epoch(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());

        vault_state.verification_status = RewardVaultVerificationStatus::Verified;
        vault_state.receives_user_funds = true;
        assert!(validate_reward_vault_for_epoch(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());

        vault_state.receives_user_funds = false;
        vault_state.custody_model = RewardVaultCustodyModel::DisclosurePending;
        assert!(validate_reward_vault_for_epoch(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());

        vault_state.custody_model = RewardVaultCustodyModel::ProgramControlled;
        vault_state.metadata_hash = [0; 32];
        assert!(validate_reward_vault_for_epoch(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());
    }

    #[test]
    fn validates_reward_claim_accounting() {
        assert!(validate_reward_claim_accounting(1_000, 100, 700, 200).is_ok());
        assert!(validate_reward_claim_accounting(1_000, 100, 700, 199).is_err());
        assert!(validate_reward_claim_accounting(0, 0, 0, 0).is_err());
    }

    #[test]
    fn restricts_reward_claim_roles_to_holder_and_staker_buckets() {
        assert!(validate_reward_claim_role(RewardVaultRole::HolderReward).is_ok());
        assert!(validate_reward_claim_role(RewardVaultRole::StakerReward).is_ok());
        assert!(validate_reward_claim_role(RewardVaultRole::IndependentTreasury).is_err());
        assert!(validate_reward_claim_role(RewardVaultRole::DeliveryCostReserve).is_err());
        assert!(validate_reward_claim_role(RewardVaultRole::Rollover).is_err());
    }

    #[test]
    fn caps_recorded_claim_amounts_to_reviewed_epoch_totals() {
        let mut reward_epoch = reward_epoch(1_000, 700);

        assert!(record_reward_claim_amounts(&mut reward_epoch, 700, 700).is_ok());
        assert_eq!(reward_epoch.recorded_gross_allocation_amount, 700);
        assert_eq!(reward_epoch.recorded_net_claim_amount, 700);

        assert!(record_reward_claim_amounts(&mut reward_epoch, 301, 0).is_err());
        assert!(record_reward_claim_amounts(&mut reward_epoch, 1, 1).is_err());
    }

    #[test]
    fn validates_reward_epoch_config_binding() {
        let reward_config = Pubkey::new_unique();
        let reward_mint = Pubkey::new_unique();
        let mut reward_epoch = reward_epoch(1_000, 700);
        reward_epoch.reward_config = reward_config;
        reward_epoch.reward_mint = reward_mint;

        assert!(
            validate_reward_epoch_matches_config(&reward_epoch, reward_config, reward_mint).is_ok()
        );
        assert!(validate_reward_epoch_matches_config(
            &reward_epoch,
            Pubkey::new_unique(),
            reward_mint
        )
        .is_err());
        assert!(validate_reward_epoch_matches_config(
            &reward_epoch,
            reward_config,
            Pubkey::new_unique()
        )
        .is_err());
    }

    #[test]
    fn validates_reward_epoch_review_readiness() {
        let reward_config = Pubkey::new_unique();
        let reward_mint = Pubkey::new_unique();
        let ready_epoch = || {
            let mut epoch = reward_epoch(1_000, 700);
            epoch.reward_config = reward_config;
            epoch.reward_mint = reward_mint;
            epoch.status = RewardEpochStatus::Drafted;
            epoch.execution_blocked = true;
            epoch.claim_merkle_root = [4; 32];
            epoch
        };

        assert!(
            validate_reward_epoch_ready_for_review(&ready_epoch(), reward_config, reward_mint)
                .is_ok()
        );

        let mut missing_root = ready_epoch();
        missing_root.claim_merkle_root = [0; 32];
        assert!(
            validate_reward_epoch_ready_for_review(&missing_root, reward_config, reward_mint)
                .is_err()
        );

        let mut already_open = ready_epoch();
        already_open.execution_blocked = false;
        assert!(
            validate_reward_epoch_ready_for_review(&already_open, reward_config, reward_mint)
                .is_err()
        );

        let mut recorded = ready_epoch();
        recorded.recorded_gross_allocation_amount = 1;
        assert!(
            validate_reward_epoch_ready_for_review(&recorded, reward_config, reward_mint).is_err()
        );
    }

    #[test]
    fn restricts_reward_epoch_cancellation_after_claim_accounting_starts() {
        let mut drafted = reward_epoch(1_000, 700);
        drafted.status = RewardEpochStatus::Drafted;
        drafted.execution_blocked = true;
        assert!(validate_reward_epoch_cancellable(&drafted).is_ok());

        assert!(validate_reward_epoch_cancellable(&reward_epoch(1_000, 700)).is_ok());

        let mut cancelled = reward_epoch(1_000, 700);
        cancelled.status = RewardEpochStatus::Cancelled;
        assert!(validate_reward_epoch_cancellable(&cancelled).is_err());

        let mut recorded = reward_epoch(1_000, 700);
        recorded.recorded_gross_allocation_amount = 1;
        assert!(validate_reward_epoch_cancellable(&recorded).is_err());

        let mut claimed = reward_epoch(1_000, 700);
        claimed.claimed_net_amount = 1;
        assert!(validate_reward_epoch_cancellable(&claimed).is_err());
    }

    #[test]
    fn reward_epoch_claimability_respects_expiry() {
        let mut epoch = reward_epoch(1_000, 700);
        epoch.claim_expires_at = 1_800_100_000;

        assert!(validate_reward_epoch_claimable_at(&epoch, 1_800_099_999).is_ok());
        assert!(validate_reward_epoch_claimable_at(&epoch, 1_800_100_000).is_err());

        epoch.status = RewardEpochStatus::Expired;
        assert!(validate_reward_epoch_claimable_at(&epoch, 1_800_099_999).is_err());
    }

    #[test]
    fn expires_reward_epoch_claims_for_redistribution_accounting() {
        let mut epoch = reward_epoch(1_000, 700);
        epoch.claim_expires_at = 1_800_100_000;
        epoch.claimed_net_amount = 250;

        assert!(expire_reward_epoch_claims_at(&mut epoch, 1_800_099_999).is_err());
        let expired_unclaimed = expire_reward_epoch_claims_at(&mut epoch, 1_800_100_000)
            .expect("expired epoch accounting");

        assert_eq!(expired_unclaimed, 450);
        assert_eq!(epoch.expired_unclaimed_net_amount, 450);
        assert_eq!(epoch.expired_recorded_at, 1_800_100_000);
        assert!(matches!(epoch.status, RewardEpochStatus::Expired));
        assert!(epoch.execution_blocked);
        assert!(expire_reward_epoch_claims_at(&mut epoch, 1_800_100_001).is_err());
    }

    #[test]
    fn validates_reward_claim_merkle_proofs() {
        let reward_epoch_key = Pubkey::new_unique();
        let wallet = Pubkey::new_unique();
        let mut reward_epoch = reward_epoch(1_000, 700);
        reward_epoch.claim_merkle_root = reward_claim_leaf_hash(
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            700,
            0,
            700,
            0,
            0,
        );

        assert!(validate_reward_merkle_proof(
            &reward_epoch,
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            700,
            0,
            700,
            0,
            0,
            &[],
        )
        .is_ok());

        assert!(validate_reward_merkle_proof(
            &reward_epoch,
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            701,
            0,
            701,
            0,
            0,
            &[],
        )
        .is_err());
        assert!(validate_reward_merkle_proof(
            &reward_epoch,
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            700,
            0,
            700,
            0,
            1,
            &[],
        )
        .is_err());
    }

    #[test]
    fn rejects_missing_or_oversized_reward_merkle_proofs() {
        let reward_epoch_key = Pubkey::new_unique();
        let wallet = Pubkey::new_unique();
        let unrooted_epoch = reward_epoch(1_000, 700);
        assert!(validate_reward_merkle_proof(
            &unrooted_epoch,
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            700,
            0,
            700,
            0,
            0,
            &[],
        )
        .is_err());

        let mut rooted_epoch = reward_epoch(1_000, 700);
        rooted_epoch.claim_merkle_root = [1; 32];
        let proof = [[2; 32]; MAX_REWARD_MERKLE_PROOF_NODES + 1];
        assert!(validate_reward_merkle_proof(
            &rooted_epoch,
            reward_epoch_key,
            RewardVaultRole::HolderReward,
            wallet,
            700,
            0,
            700,
            0,
            0,
            &proof,
        )
        .is_err());
    }

    #[test]
    fn token_claim_vaults_must_be_program_controlled() {
        let reward_config = Pubkey::new_unique();
        let reward_mint = Pubkey::new_unique();
        let mut vault_state = reward_vault_state(
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
            RewardVaultVerificationStatus::Verified,
        );

        assert!(validate_reward_vault_for_token_claim(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_ok());

        vault_state.custody_model = RewardVaultCustodyModel::TreasuryControlled;
        assert!(validate_reward_vault_for_token_claim(
            &vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());
    }

    #[test]
    fn fee_route_requires_program_controlled_holder_and_staker_vaults() {
        let reward_config = Pubkey::new_unique();
        let reward_mint = Pubkey::new_unique();
        let mut holder_vault_state = reward_vault_state(
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
            RewardVaultVerificationStatus::Verified,
        );
        let mut treasury_vault_state = reward_vault_state(
            reward_config,
            reward_mint,
            RewardVaultRole::IndependentTreasury,
            RewardVaultVerificationStatus::Verified,
        );

        assert!(validate_reward_vault_for_fee_route(
            &holder_vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_ok());

        holder_vault_state.custody_model = RewardVaultCustodyModel::TreasuryControlled;
        assert!(validate_reward_vault_for_fee_route(
            &holder_vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::HolderReward,
        )
        .is_err());

        treasury_vault_state.custody_model = RewardVaultCustodyModel::TreasuryControlled;
        assert!(validate_reward_vault_for_fee_route(
            &treasury_vault_state,
            reward_config,
            reward_mint,
            RewardVaultRole::IndependentTreasury,
        )
        .is_ok());
    }

    #[test]
    fn validates_metadata_hashes() {
        assert!(validate_metadata_hash(&[9; 32]).is_ok());
        assert!(validate_metadata_hash(&[0; 32]).is_err());
    }

    #[test]
    fn validates_project_disclosure_revision_progression() {
        let mut project = project_record();
        project.current_disclosure_revision_id = 0;
        assert!(validate_project_disclosure_revision_id(&project, 1).is_ok());

        project.current_disclosure_revision_id = 3;
        assert!(validate_project_disclosure_revision_id(&project, 4).is_ok());
        assert!(validate_project_disclosure_revision_id(&project, 3).is_err());
        assert!(validate_project_disclosure_revision_id(&project, 2).is_err());
    }

    #[test]
    fn limits_project_funding_model_to_record_only_for_mvp() {
        assert!(validate_project_funding_model(ProjectFundingModel::RecordOnly).is_ok());
        assert!(validate_project_funding_model(ProjectFundingModel::DirectSettlement).is_err());
        assert!(validate_project_funding_model(ProjectFundingModel::ProgramEscrow).is_err());
    }

    #[test]
    fn validates_new_authority_nominations() {
        let current_authority = Pubkey::new_unique();
        assert!(validate_new_authority(Pubkey::new_unique(), current_authority).is_ok());
        assert!(validate_new_authority(Pubkey::default(), current_authority).is_err());
        assert!(validate_new_authority(current_authority, current_authority).is_err());
    }

    #[test]
    fn validates_project_authority_separately_from_protocol_authority() {
        let protocol_authority = Pubkey::new_unique();
        let project_authority = Pubkey::new_unique();
        let mut config = protocol_config(protocol_authority);
        config.project_authority = project_authority;

        assert!(validate_protocol_authority(&config, &protocol_authority).is_ok());
        assert!(validate_protocol_authority(&config, &project_authority).is_err());
        assert!(validate_project_authority(&config, &project_authority).is_ok());
        assert!(validate_project_authority(&config, &protocol_authority).is_err());
    }

    #[test]
    fn validates_project_operator_permissions_and_records() {
        let now = 1_000;
        assert!(validate_project_operator_permissions(PROJECT_OPERATOR_PERMISSION_STATUS).is_ok());
        assert!(validate_project_operator_permissions(PROJECT_OPERATOR_PERMISSION_PAUSE).is_ok());
        assert!(validate_project_operator_permissions(PROJECT_OPERATOR_PERMISSION_MASK).is_ok());
        assert!(validate_project_operator_permissions(0).is_err());
        assert!(
            validate_project_operator_permissions(PROJECT_OPERATOR_PERMISSION_MASK | 4).is_err()
        );
        assert!(validate_project_operator_expiry(now, now + 60).is_ok());
        assert!(validate_project_operator_expiry(now, now).is_err());
        assert!(validate_project_operator_expiry(
            now,
            now + MAX_PROJECT_OPERATOR_PERMISSION_SECONDS + 1
        )
        .is_err());

        let project = Pubkey::new_unique();
        let operator = Pubkey::new_unique();
        let mut record = project_operator_record(
            project,
            operator,
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now + 60,
        );

        assert!(validate_project_operator(
            &record,
            project,
            operator,
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now,
        )
        .is_ok());
        assert!(validate_project_operator(
            &record,
            project,
            operator,
            PROJECT_OPERATOR_PERMISSION_PAUSE,
            now,
        )
        .is_err());
        assert!(validate_project_operator(
            &record,
            Pubkey::new_unique(),
            operator,
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now,
        )
        .is_err());
        assert!(validate_project_operator(
            &record,
            project,
            Pubkey::new_unique(),
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now,
        )
        .is_err());
        assert!(validate_project_operator(
            &record,
            project,
            operator,
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now + 60,
        )
        .is_err());

        record.active = false;
        assert!(validate_project_operator(
            &record,
            project,
            operator,
            PROJECT_OPERATOR_PERMISSION_STATUS,
            now,
        )
        .is_err());
    }

    #[test]
    fn limits_operator_status_transitions() {
        assert!(validate_operator_project_status(ProjectStatus::Open).is_ok());
        assert!(validate_operator_project_status(ProjectStatus::MilestoneReached).is_ok());
        assert!(validate_operator_project_status(ProjectStatus::Completed).is_ok());
        assert!(validate_operator_project_status(ProjectStatus::Cancelled).is_err());
        assert!(validate_operator_project_status(ProjectStatus::Rejected).is_err());
        assert!(validate_operator_project_status(ProjectStatus::GovernanceVote).is_err());
    }

    #[test]
    fn validates_seedbot_permission_bounds() {
        let now = 1_000;
        assert!(
            validate_seedbot_permission_limits_at(now, now + 60, 1_000, 5_000, 5, 100,).is_ok()
        );
        assert!(validate_seedbot_permission_limits_at(now, now, 1_000, 5_000, 5, 100,).is_err());
        assert!(validate_seedbot_permission_limits_at(
            now,
            now + MAX_SEEDBOT_PERMISSION_SECONDS + 1,
            1_000,
            5_000,
            5,
            100,
        )
        .is_err());
        assert!(validate_seedbot_permission_limits_at(now, now + 60, 1_000, 999, 5, 100,).is_err());
        assert!(validate_seedbot_permission_limits_at(
            now,
            now + 60,
            1_000,
            5_000,
            MAX_SEEDBOT_DAILY_TRADES + 1,
            100,
        )
        .is_err());
        assert!(validate_seedbot_permission_limits_at(
            now,
            now + 60,
            1_000,
            5_000,
            5,
            MAX_SEEDBOT_SLIPPAGE_BPS + 1,
        )
        .is_err());
    }

    #[test]
    fn maps_voting_rights_level_from_vote_count() {
        assert_eq!(voting_rights_level_for_vote_count(0), 1);
        assert_eq!(voting_rights_level_for_vote_count(99), 1);
        assert_eq!(voting_rights_level_for_vote_count(100), 2);
        assert_eq!(voting_rights_level_for_vote_count(101), 2);
    }

    #[test]
    fn validates_governance_voting_window_bounds() {
        let now = 1_800_000_000;

        assert_eq!(
            calculate_governance_voting_ends_at(now, MIN_GOVERNANCE_VOTING_WINDOW_SECONDS).unwrap(),
            now + MIN_GOVERNANCE_VOTING_WINDOW_SECONDS
        );
        assert_eq!(
            calculate_governance_voting_ends_at(now, MAX_GOVERNANCE_VOTING_WINDOW_SECONDS).unwrap(),
            now + MAX_GOVERNANCE_VOTING_WINDOW_SECONDS
        );
        assert!(
            calculate_governance_voting_ends_at(now, MIN_GOVERNANCE_VOTING_WINDOW_SECONDS - 1)
                .is_err()
        );
        assert!(
            calculate_governance_voting_ends_at(now, MAX_GOVERNANCE_VOTING_WINDOW_SECONDS + 1)
                .is_err()
        );
        assert!(calculate_governance_voting_ends_at(i64::MAX, 1).is_err());
        assert!(validate_governance_minimum_votes(1).is_ok());
        assert!(validate_governance_minimum_votes(MAX_GOVERNANCE_MINIMUM_VOTES).is_ok());
        assert!(validate_governance_minimum_votes(0).is_err());
        assert!(validate_governance_minimum_votes(MAX_GOVERNANCE_MINIMUM_VOTES + 1).is_err());
    }

    #[test]
    fn validates_governance_vote_window() {
        let mut proposal = governance_proposal();
        proposal.voting_starts_at = 1_000;
        proposal.voting_ends_at = 2_000;

        assert!(validate_governance_vote_window(&proposal, 999).is_err());
        assert!(validate_governance_vote_window(&proposal, 1_000).is_ok());
        assert!(validate_governance_vote_window(&proposal, 1_999).is_ok());
        assert!(validate_governance_vote_window(&proposal, 2_000).is_err());
    }

    #[test]
    fn validates_governance_close_against_tally_and_threshold() {
        let mut proposal = governance_proposal();
        proposal.voting_ends_at = 2_000;
        proposal.minimum_votes = 3;
        proposal.yes_votes = 2;
        proposal.no_votes = 0;

        assert!(validate_governance_proposal_close(&proposal, 1_999).is_err());
        assert!(!validate_governance_proposal_close(&proposal, 2_000).unwrap());

        proposal.yes_votes = 2;
        proposal.no_votes = 1;
        assert!(validate_governance_proposal_close(&proposal, 2_000).unwrap());

        proposal.yes_votes = 1;
        proposal.no_votes = 2;
        assert!(!validate_governance_proposal_close(&proposal, 2_000).unwrap());

        proposal.yes_votes = u64::MAX;
        proposal.no_votes = 1;
        assert!(validate_governance_proposal_close(&proposal, 2_000).is_err());
    }

    #[test]
    fn validates_project_governance_binding_by_status() {
        let proposal_key = Pubkey::new_unique();
        let mut proposal = governance_proposal();

        proposal.status = GovernanceProposalStatus::Open;
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::GovernanceVote,
        )
        .is_ok());
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            Pubkey::new_unique(),
            ProjectStatus::GovernanceVote,
        )
        .is_err());
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Open,
        )
        .is_err());

        proposal.status = GovernanceProposalStatus::Approved;
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Open,
        )
        .is_ok());
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::HarvestAvailable,
        )
        .is_ok());
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Cancelled,
        )
        .is_ok());

        proposal.status = GovernanceProposalStatus::Rejected;
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Rejected,
        )
        .is_ok());
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Open,
        )
        .is_err());

        proposal.category = GovernanceProposalCategory::DonationCause;
        proposal.status = GovernanceProposalStatus::Approved;
        assert!(validate_project_governance_binding(
            &proposal,
            proposal_key,
            proposal_key,
            ProjectStatus::Open,
        )
        .is_err());
    }

    #[test]
    fn records_seedbot_usage_with_daily_caps() {
        let now = 1_000;
        let mut permission = seedbot_permission(now + SEEDBOT_USAGE_WINDOW_SECONDS + 10_000);

        assert!(record_seedbot_usage_at(&mut permission, now, 700, 50).is_ok());
        assert_eq!(permission.usage_day_start_ts, now);
        assert_eq!(permission.daily_volume_used_amount, 700);
        assert_eq!(permission.daily_trades_used, 1);
        assert_eq!(permission.total_volume_used_amount, 700);
        assert_eq!(permission.total_trades_used, 1);
        assert_eq!(permission.last_execution_ts, now);

        assert!(record_seedbot_usage_at(&mut permission, now + 60, 800, 75).is_ok());
        assert_eq!(permission.daily_volume_used_amount, 1_500);
        assert_eq!(permission.daily_trades_used, 2);
        assert_eq!(permission.total_volume_used_amount, 1_500);
        assert_eq!(permission.total_trades_used, 2);

        assert!(record_seedbot_usage_at(&mut permission, now + 120, 1, 75).is_err());

        let reset_at = now + SEEDBOT_USAGE_WINDOW_SECONDS + 1;
        assert!(record_seedbot_usage_at(&mut permission, reset_at, 100, 50).is_ok());
        assert_eq!(permission.usage_day_start_ts, reset_at);
        assert_eq!(permission.daily_volume_used_amount, 100);
        assert_eq!(permission.daily_trades_used, 1);
        assert_eq!(permission.total_volume_used_amount, 1_600);
        assert_eq!(permission.total_trades_used, 3);
    }

    #[test]
    fn rejects_invalid_seedbot_usage() {
        let now = 1_000;
        let mut permission = seedbot_permission(now + 10_000);

        assert!(record_seedbot_usage_at(&mut permission, now, 0, 50).is_err());
        assert!(record_seedbot_usage_at(&mut permission, now, 1_001, 50).is_err());
        assert!(record_seedbot_usage_at(&mut permission, now, 100, 101).is_err());

        permission.revoked = true;
        assert!(record_seedbot_usage_at(&mut permission, now, 100, 50).is_err());

        let mut expired = seedbot_permission(now);
        assert!(record_seedbot_usage_at(&mut expired, now, 100, 50).is_err());
    }

    #[test]
    fn maps_tier_access_for_project_participation() {
        assert!(StakeTier::Fruit.can_access(StakeTier::Seed));
        assert!(StakeTier::Sprout.can_access(StakeTier::Sprout));
        assert!(!StakeTier::Seed.can_access(StakeTier::Sprout));
        assert!(!StakeTier::Fruit.can_access(StakeTier::None));
    }

    #[test]
    fn maps_project_status_participation_windows() {
        assert!(ProjectStatus::Open.is_participation_open());
        assert!(ProjectStatus::Active.is_participation_open());
        assert!(ProjectStatus::MilestoneReached.is_participation_open());
        assert!(ProjectStatus::HarvestAvailable.is_participation_open());
        assert!(!ProjectStatus::Proposed.is_participation_open());
        assert!(!ProjectStatus::Paused.is_participation_open());
        assert!(!ProjectStatus::Completed.is_participation_open());
        assert!(!ProjectStatus::Cancelled.is_participation_open());
    }

    #[test]
    fn validates_project_status_lifecycle_guards() {
        assert!(validate_project_initial_status(ProjectStatus::Proposed).is_ok());
        assert!(validate_project_initial_status(ProjectStatus::Open).is_ok());
        assert!(validate_project_initial_status(ProjectStatus::Rejected).is_ok());
        assert!(validate_project_initial_status(ProjectStatus::Completed).is_err());
        assert!(validate_project_initial_status(ProjectStatus::Cancelled).is_err());

        assert!(
            validate_project_status_transition(ProjectStatus::Open, ProjectStatus::Active).is_ok()
        );
        assert!(validate_project_status_transition(
            ProjectStatus::Active,
            ProjectStatus::Completed
        )
        .is_ok());
        assert!(validate_project_status_transition(
            ProjectStatus::Open,
            ProjectStatus::Cancelled
        )
        .is_err());
        assert!(validate_project_status_transition(
            ProjectStatus::Completed,
            ProjectStatus::Open
        )
        .is_err());
        assert!(validate_project_status_transition(
            ProjectStatus::Cancelled,
            ProjectStatus::Open
        )
        .is_err());
        assert!(validate_project_status_transition(
            ProjectStatus::Rejected,
            ProjectStatus::Open
        )
        .is_err());
        assert!(validate_project_status_transition(
            ProjectStatus::Rejected,
            ProjectStatus::Rejected
        )
        .is_ok());
        assert!(validate_project_status_transition(
            ProjectStatus::Completed,
            ProjectStatus::Completed
        )
        .is_ok());
        assert!(validate_project_status_transition(
            ProjectStatus::Cancelled,
            ProjectStatus::Cancelled
        )
        .is_err());
    }

    #[test]
    fn blocks_terminal_project_mutations() {
        let mut project = project_record();
        assert!(validate_project_open_for_mutation(&project).is_ok());

        project.status = ProjectStatus::Rejected;
        assert!(validate_project_open_for_mutation(&project).is_err());

        project.status = ProjectStatus::Completed;
        assert!(validate_project_open_for_mutation(&project).is_err());

        project.status = ProjectStatus::Cancelled;
        assert!(validate_project_open_for_mutation(&project).is_err());
    }

    #[test]
    fn validates_project_participation_bounds_and_caps() {
        assert!(validate_project_participation_bounds(1, 1, 1).is_ok());
        assert!(validate_project_participation_bounds(100, 500, 1_000).is_ok());
        assert!(validate_project_participation_bounds(0, 500, 1_000).is_err());
        assert!(validate_project_participation_bounds(501, 500, 1_000).is_err());
        assert!(validate_project_participation_bounds(100, 1_001, 1_000).is_err());

        let mut project = project_record();
        project.min_participation_amount = 100;
        project.max_wallet_participation_amount = 600;
        project.max_total_participation_amount = 1_000;
        project.total_participation_amount = 400;

        assert!(record_project_participation_amount(&mut project, 99).is_err());
        assert!(record_project_participation_amount(&mut project, 601).is_err());
        assert!(record_project_participation_amount(&mut project, 700).is_err());

        assert!(record_project_participation_amount(&mut project, 600).is_ok());
        assert_eq!(project.total_participation_amount, 1_000);
        assert_eq!(project.total_participants, 1);

        let mut overflowing = project_record();
        overflowing.total_participation_amount = u64::MAX;
        assert!(record_project_participation_amount(&mut overflowing, 1).is_err());

        let mut participant_overflow = project_record();
        participant_overflow.total_participants = u64::MAX;
        assert!(record_project_participation_amount(&mut participant_overflow, 100).is_err());
    }

    #[test]
    fn validates_project_participation_windows() {
        assert!(validate_project_participation_window(100, 200).is_ok());
        assert!(validate_project_participation_window(200, 200).is_err());
        assert!(validate_project_participation_window(300, 200).is_err());

        let mut project = project_record();
        project.participation_starts_at = 100;
        project.participation_ends_at = 200;

        assert!(validate_project_participation_window_open(&project, 99).is_err());
        assert!(validate_project_participation_window_open(&project, 100).is_ok());
        assert!(validate_project_participation_window_open(&project, 150).is_ok());
        assert!(validate_project_participation_window_open(&project, 200).is_ok());
        assert!(validate_project_participation_window_open(&project, 201).is_err());
    }

    #[test]
    fn blocks_project_participation_when_paused() {
        let mut project = project_record();
        assert!(validate_project_participation_not_paused(&project).is_ok());

        project.participation_paused = true;
        assert!(validate_project_participation_not_paused(&project).is_err());
    }

    #[test]
    fn records_project_cancellation_and_refund_accounting() {
        let mut project = project_record();
        project.total_participation_amount = 1_000;

        assert!(cancel_project_accounting(&mut project, 2_000, [8; 32], 1_001).is_err());
        assert!(cancel_project_accounting(&mut project, 2_000, [8; 32], 800).is_ok());
        assert!(project.status == ProjectStatus::Cancelled);
        assert_eq!(project.cancellation_hash, [8; 32]);
        assert_eq!(project.cancelled_at, 2_000);
        assert_eq!(project.refund_pool_amount, 800);
        assert_eq!(project.total_refunded_amount, 0);

        assert!(record_project_refund_accounting(&mut project, 0).is_err());
        assert!(record_project_refund_accounting(&mut project, 500).is_ok());
        assert_eq!(project.total_refunded_amount, 500);
        assert!(record_project_refund_accounting(&mut project, 301).is_err());
        assert!(record_project_refund_accounting(&mut project, 300).is_ok());
        assert_eq!(project.total_refunded_amount, 800);

        assert!(cancel_project_accounting(&mut project, 3_000, [9; 32], 0).is_err());

        let mut active_project = project_record();
        assert!(record_project_refund_accounting(&mut active_project, 1).is_err());

        let mut completed_project = project_record();
        completed_project.status = ProjectStatus::Completed;
        assert!(cancel_project_accounting(&mut completed_project, 3_000, [9; 32], 0).is_err());
    }

    fn reward_vault_state(
        reward_config: Pubkey,
        reward_mint: Pubkey,
        role: RewardVaultRole,
        verification_status: RewardVaultVerificationStatus,
    ) -> RewardVaultState {
        RewardVaultState {
            reward_config,
            role,
            reward_mint,
            vault_address: Pubkey::new_unique(),
            custody_model: RewardVaultCustodyModel::ProgramControlled,
            verification_status,
            metadata_hash: [7; 32],
            total_funded_amount: 0,
            receives_user_funds: false,
            bump: 255,
        }
    }

    fn reward_epoch(reward_pool_amount: u64, distributed_net_amount: u64) -> RewardEpoch {
        RewardEpoch {
            reward_config: Pubkey::new_unique(),
            epoch_id: 3,
            snapshot_taken_at: 1_800_000_000,
            created_at: 1_800_000_010,
            reward_mint: Pubkey::new_unique(),
            reward_pool_amount,
            distributed_net_amount,
            reserved_delivery_cost_amount: 100,
            rolled_forward_amount: reward_pool_amount
                .saturating_sub(distributed_net_amount)
                .saturating_sub(100),
            recorded_gross_allocation_amount: 0,
            recorded_net_claim_amount: 0,
            claimed_net_amount: 0,
            claim_expires_at: 1_831_622_410,
            expired_unclaimed_net_amount: 0,
            expired_recorded_at: 0,
            exclusion_list_hash: [9; 32],
            claim_merkle_root: [0; 32],
            status: RewardEpochStatus::Reviewed,
            execution_blocked: false,
            bump: 255,
        }
    }

    fn seedbot_permission(expires_at: i64) -> SeedBotPermission {
        SeedBotPermission {
            owner: Pubkey::new_unique(),
            position: Pubkey::new_unique(),
            permission_hash: [7; 32],
            created_at: 900,
            expires_at,
            max_trade_amount: 1_000,
            max_daily_volume_amount: 1_500,
            max_daily_trades: 2,
            max_slippage_bps: 100,
            tier_at_creation: StakeTier::Seed,
            staked_amount_at_creation: THRESHOLDS[0],
            staking_start_ts_at_creation: 800,
            revoked: false,
            bump: 1,
            usage_day_start_ts: 0,
            daily_volume_used_amount: 0,
            daily_trades_used: 0,
            total_volume_used_amount: 0,
            total_trades_used: 0,
            last_execution_ts: 0,
        }
    }

    fn protocol_config(authority: Pubkey) -> ProtocolConfig {
        ProtocolConfig {
            authority,
            ryp_mint: Pubkey::new_unique(),
            ryp_vault: Pubkey::new_unique(),
            base_fee_bps: 350,
            tier_thresholds: THRESHOLDS,
            tier_fee_reduction_bps: [0, 35, 70, 105, 140],
            total_staked: 0,
            paused: false,
            bump: 255,
            pending_authority: Pubkey::default(),
            project_authority: authority,
            pending_project_authority: Pubkey::default(),
        }
    }

    fn project_operator_record(
        project: Pubkey,
        operator: Pubkey,
        permissions: u16,
        expires_at: i64,
    ) -> ProjectOperatorRecord {
        ProjectOperatorRecord {
            project,
            operator,
            authority: Pubkey::new_unique(),
            permissions,
            active: true,
            granted_at: 1_000,
            expires_at,
            revoked_at: 0,
            bump: 255,
        }
    }

    fn governance_proposal() -> GovernanceProposal {
        GovernanceProposal {
            proposal_id: 3,
            authority: Pubkey::new_unique(),
            category: GovernanceProposalCategory::ProjectApproval,
            status: GovernanceProposalStatus::Open,
            metadata_hash: [7; 32],
            yes_votes: 0,
            no_votes: 0,
            created_at: 1_000,
            voting_starts_at: 1_000,
            voting_ends_at: 2_000,
            minimum_votes: 1,
            closed_at: 0,
            bump: 255,
        }
    }

    fn project_record() -> ProjectRecord {
        ProjectRecord {
            project_id: 9,
            authority: Pubkey::new_unique(),
            required_tier: StakeTier::Seed,
            risk_level: ProjectRiskLevel::Medium,
            status: ProjectStatus::Open,
            funding_model: ProjectFundingModel::RecordOnly,
            metadata_hash: [7; 32],
            receiving_account: Pubkey::new_unique(),
            governance_proposal: Pubkey::new_unique(),
            total_participants: 0,
            min_participation_amount: 100,
            max_wallet_participation_amount: 600,
            max_total_participation_amount: 1_000,
            total_participation_amount: 0,
            participation_starts_at: 0,
            participation_ends_at: 4_102_444_800,
            cancellation_hash: [0; 32],
            cancelled_at: 0,
            refund_pool_amount: 0,
            total_refunded_amount: 0,
            participation_paused: false,
            current_disclosure_revision_id: 1,
            current_disclosure_hash: [8; 32],
            bump: 255,
        }
    }
}
