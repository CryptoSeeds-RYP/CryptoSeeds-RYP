use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

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
pub const SEEDBOT_PERMISSION_SEED: &[u8] = b"seedbot-permission";
pub const VOTING_RIGHTS_DELAY_SECONDS: i64 = 14 * 24 * 60 * 60;
pub const MAX_REWARD_EPOCH_CADENCE_SECONDS: i64 = 366 * 24 * 60 * 60;
pub const MAX_SEEDBOT_PERMISSION_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const BPS_DENOMINATOR: u16 = 10_000;

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
        reward_pool_amount: u64,
        distributed_net_amount: u64,
        reserved_delivery_cost_amount: u64,
        rolled_forward_amount: u64,
        exclusion_list_hash: [u8; 32],
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
        reward_epoch.exclusion_list_hash = exclusion_list_hash;
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
            reward_pool_amount,
            distributed_net_amount,
            reserved_delivery_cost_amount,
            rolled_forward_amount,
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
        require!(
            new_authority != Pubkey::default(),
            CryptoSeedsError::InvalidAuthority
        );

        let previous_authority = ctx.accounts.config.authority;
        ctx.accounts.config.authority = new_authority;

        emit!(ProtocolAuthorityTransferred {
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
        validate_reward_epoch_status(ctx.accounts.reward_epoch.status, RewardEpochStatus::Drafted)?;

        let reward_epoch = &mut ctx.accounts.reward_epoch;
        reward_epoch.status = RewardEpochStatus::Reviewed;
        reward_epoch.execution_blocked = false;

        emit!(RewardEpochReviewed {
            reward_config: reward_epoch.reward_config,
            epoch_id: reward_epoch.epoch_id,
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
        require!(
            ctx.accounts.reward_epoch.status != RewardEpochStatus::Cancelled,
            CryptoSeedsError::InvalidRewardEpochStatus
        );

        let reward_epoch = &mut ctx.accounts.reward_epoch;
        reward_epoch.status = RewardEpochStatus::Cancelled;
        reward_epoch.execution_blocked = true;

        emit!(RewardEpochCancelled {
            reward_config: reward_epoch.reward_config,
            epoch_id: reward_epoch.epoch_id,
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
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable(&ctx.accounts.reward_epoch)?;
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
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet,
            gross_allocation_amount,
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
        validate_reward_epoch_claimable(&ctx.accounts.reward_epoch)?;
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

        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.claimed = true;

        emit!(RewardClaimed {
            reward_epoch: claim_record.reward_epoch,
            reward_role,
            wallet: claim_record.wallet,
            net_claim_amount: claim_record.net_claim_amount,
        });

        Ok(())
    }

    pub fn claim_reward_tokens(
        ctx: Context<ClaimRewardTokens>,
        _epoch_id: u64,
        reward_role: RewardVaultRole,
    ) -> Result<()> {
        validate_reward_claim_role(reward_role)?;
        validate_reward_epoch_claimable(&ctx.accounts.reward_epoch)?;
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
            reward_epoch: ctx.accounts.claim_record.reward_epoch,
            reward_role,
            wallet: ctx.accounts.claim_record.wallet,
            net_claim_amount: claim_amount,
        });

        Ok(())
    }

    pub fn create_governance_proposal(
        ctx: Context<CreateGovernanceProposal>,
        proposal_id: u64,
        category: GovernanceProposalCategory,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_metadata_hash(&metadata_hash)?;

        let clock = Clock::get()?;
        let proposal = &mut ctx.accounts.proposal;
        proposal.proposal_id = proposal_id;
        proposal.authority = ctx.accounts.authority.key();
        proposal.category = category;
        proposal.status = GovernanceProposalStatus::Open;
        proposal.metadata_hash = metadata_hash;
        proposal.yes_votes = 0;
        proposal.no_votes = 0;
        proposal.created_at = clock.unix_timestamp;
        proposal.closed_at = 0;
        proposal.bump = ctx.bumps.proposal;

        emit!(GovernanceProposalCreated {
            proposal: proposal.key(),
            proposal_id,
            category,
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
        vote_record.voted_at = Clock::get()?.unix_timestamp;
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

        ctx.accounts.position.vote_count = ctx
            .accounts
            .position
            .vote_count
            .checked_add(1)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(GovernanceVoteCast {
            proposal: proposal.key(),
            wallet: ctx.accounts.owner.key(),
            approve,
        });

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

        let proposal = &mut ctx.accounts.proposal;
        proposal.status = if approved {
            GovernanceProposalStatus::Approved
        } else {
            GovernanceProposalStatus::Rejected
        };
        proposal.closed_at = Clock::get()?.unix_timestamp;

        emit!(GovernanceProposalClosed {
            proposal: proposal.key(),
            approved,
        });

        Ok(())
    }

    pub fn register_project(
        ctx: Context<RegisterProject>,
        project_id: u64,
        required_tier: StakeTier,
        risk_level: ProjectRiskLevel,
        status: ProjectStatus,
        metadata_hash: [u8; 32],
        receiving_account: Pubkey,
        governance_proposal: Pubkey,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        validate_metadata_hash(&metadata_hash)?;
        require!(
            required_tier != StakeTier::None,
            CryptoSeedsError::StakeBelowSeedTier
        );
        require!(
            receiving_account != Pubkey::default(),
            CryptoSeedsError::InvalidProjectAccount
        );

        let project = &mut ctx.accounts.project;
        project.project_id = project_id;
        project.authority = ctx.accounts.authority.key();
        project.required_tier = required_tier;
        project.risk_level = risk_level;
        project.status = status;
        project.metadata_hash = metadata_hash;
        project.receiving_account = receiving_account;
        project.governance_proposal = governance_proposal;
        project.total_participants = 0;
        project.bump = ctx.bumps.project;

        emit!(ProjectRegistered {
            project: project.key(),
            project_id,
            required_tier,
            risk_level,
            status,
        });

        Ok(())
    }

    pub fn update_project_status(
        ctx: Context<UpdateProjectStatus>,
        _project_id: u64,
        status: ProjectStatus,
    ) -> Result<()> {
        validate_protocol_authority(&ctx.accounts.config, &ctx.accounts.authority.key())?;
        ctx.accounts.project.status = status;

        emit!(ProjectStatusUpdated {
            project: ctx.accounts.project.key(),
            status,
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
            ctx.accounts.project.status.is_participation_open(),
            CryptoSeedsError::ProjectNotOpen
        );

        let clock = Clock::get()?;
        let participation = &mut ctx.accounts.participation;
        participation.project = ctx.accounts.project.key();
        participation.wallet = ctx.accounts.owner.key();
        participation.participation_amount = participation_amount;
        participation.disclosure_hash = disclosure_hash;
        participation.joined_at = clock.unix_timestamp;
        participation.status = ProjectParticipationStatus::Active;
        participation.bump = ctx.bumps.participation;

        ctx.accounts.project.total_participants = ctx
            .accounts
            .project
            .total_participants
            .checked_add(1)
            .ok_or(CryptoSeedsError::MathOverflow)?;

        emit!(ProjectParticipationRecorded {
            project: participation.project,
            wallet: participation.wallet,
            participation_amount,
        });

        Ok(())
    }

    pub fn create_seedbot_permission(
        ctx: Context<CreateSeedBotPermission>,
        permission_hash: [u8; 32],
        expires_at: i64,
        max_trade_amount: u64,
        max_daily_trades: u16,
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
        validate_seedbot_permission_limits(expires_at, max_trade_amount, max_daily_trades)?;

        let permission = &mut ctx.accounts.permission;
        permission.owner = ctx.accounts.owner.key();
        permission.position = ctx.accounts.position.key();
        permission.permission_hash = permission_hash;
        permission.created_at = Clock::get()?.unix_timestamp;
        permission.expires_at = expires_at;
        permission.max_trade_amount = max_trade_amount;
        permission.max_daily_trades = max_daily_trades;
        permission.revoked = false;
        permission.bump = ctx.bumps.permission;

        emit!(SeedBotPermissionCreated {
            owner: permission.owner,
            expires_at,
            max_trade_amount,
            max_daily_trades,
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
#[instruction(project_id: u64)]
pub struct UpdateProjectStatus<'info> {
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
    pub exclusion_list_hash: [u8; 32],
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
    pub metadata_hash: [u8; 32],
    pub receiving_account: Pubkey,
    pub governance_proposal: Pubkey,
    pub total_participants: u64,
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
pub struct SeedBotPermission {
    pub owner: Pubkey,
    pub position: Pubkey,
    pub permission_hash: [u8; 32],
    pub created_at: i64,
    pub expires_at: i64,
    pub max_trade_amount: u64,
    pub max_daily_trades: u16,
    pub revoked: bool,
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
    pub reward_pool_amount: u64,
    pub distributed_net_amount: u64,
    pub reserved_delivery_cost_amount: u64,
    pub rolled_forward_amount: u64,
    pub execution_blocked: bool,
}

#[event]
pub struct FeeConfigUpdated {
    pub authority: Pubkey,
    pub base_fee_bps: u16,
    pub tier_fee_reduction_bps: [u16; 5],
}

#[event]
pub struct ProtocolAuthorityTransferred {
    pub previous_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct RewardEpochReviewed {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
}

#[event]
pub struct RewardEpochCancelled {
    pub reward_config: Pubkey,
    pub epoch_id: u64,
}

#[event]
pub struct RewardClaimRecordCreated {
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub gross_allocation_amount: u64,
    pub net_claim_amount: u64,
    pub rolled_forward_amount: u64,
}

#[event]
pub struct RewardClaimed {
    pub reward_epoch: Pubkey,
    pub reward_role: RewardVaultRole,
    pub wallet: Pubkey,
    pub net_claim_amount: u64,
}

#[event]
pub struct GovernanceProposalCreated {
    pub proposal: Pubkey,
    pub proposal_id: u64,
    pub category: GovernanceProposalCategory,
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
}

#[event]
pub struct ProjectRegistered {
    pub project: Pubkey,
    pub project_id: u64,
    pub required_tier: StakeTier,
    pub risk_level: ProjectRiskLevel,
    pub status: ProjectStatus,
}

#[event]
pub struct ProjectStatusUpdated {
    pub project: Pubkey,
    pub status: ProjectStatus,
}

#[event]
pub struct ProjectParticipationRecorded {
    pub project: Pubkey,
    pub wallet: Pubkey,
    pub participation_amount: u64,
}

#[event]
pub struct SeedBotPermissionCreated {
    pub owner: Pubkey,
    pub expires_at: i64,
    pub max_trade_amount: u64,
    pub max_daily_trades: u16,
}

#[event]
pub struct SeedBotPermissionRevoked {
    pub owner: Pubkey,
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
    #[msg("Governance proposal is not open for voting.")]
    GovernanceProposalClosed,
    #[msg("The metadata hash is invalid.")]
    InvalidMetadata,
    #[msg("Project account is invalid.")]
    InvalidProjectAccount,
    #[msg("Wallet tier is insufficient for this action.")]
    InsufficientTier,
    #[msg("Project is not open for participation.")]
    ProjectNotOpen,
    #[msg("SeedBot permission limits are invalid.")]
    InvalidSeedBotPermission,
    #[msg("SeedBot permission is already revoked.")]
    SeedBotPermissionRevoked,
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

fn validate_reward_epoch_claimable(reward_epoch: &RewardEpoch) -> Result<()> {
    require!(
        reward_epoch.status == RewardEpochStatus::Reviewed,
        CryptoSeedsError::InvalidRewardEpochStatus
    );
    require!(
        !reward_epoch.execution_blocked,
        CryptoSeedsError::RewardExecutionNotApproved
    );

    Ok(())
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

fn validate_seedbot_permission_limits(
    expires_at: i64,
    max_trade_amount: u64,
    max_daily_trades: u16,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
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
        max_daily_trades > 0,
        CryptoSeedsError::InvalidSeedBotPermission
    );

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
            exclusion_list_hash: [9; 32],
            status: RewardEpochStatus::Reviewed,
            execution_blocked: false,
            bump: 255,
        }
    }
}
