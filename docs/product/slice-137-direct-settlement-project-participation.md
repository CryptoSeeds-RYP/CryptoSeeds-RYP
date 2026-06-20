# Slice 137: Direct-Settlement Project Participation

## Implemented

- Enabled `ProjectFundingModel::DirectSettlement` while keeping `ProgramEscrow` disabled.
- Added `participate_project_direct_settlement` for wallet-approved RYP transfers from the user account directly to the project's declared receiving token account.
- Kept `participate_project` scoped to `RecordOnly` projects.
- Added shared Rust validation for project participation disclosure, tier, status, window, pause, and funding-model checks.
- Added frontend transaction planning for `PARTICIPATE_PROJECT_DIRECT_SETTLEMENT`.
- Added IDL drift coverage and transaction-plan coverage for the new instruction.

## Security Boundary

- CryptoSeeds does not custody direct-settlement project participation funds.
- The user signs the RYP transfer from their own wallet-owned token account.
- The destination must match the project record's declared receiving token account.
- `ProgramEscrow` remains disabled until project escrow vault initialization, release, and refund-claim paths are designed and tested.

## Verification

- Rust protocol tests: `51/51` passing.
- Anchor WSL build: passing without BPF stack warnings.
- Protocol IDL drift check: `41` instruction plans and `14` account layouts passing.
- Focused transaction planner tests: passing.
