# Slice 58 Evaluation - Windows Rust Protocol Check

## Intent

Unblock local Rust verification for the CryptoSeeds Anchor staking program while WSL remains blocked by firmware virtualization.

## Changes

- Installed and verified Rustup/Cargo from the existing user Rust installation.
- Added the `stable-x86_64-pc-windows-gnullvm` Rust toolchain.
- Installed portable LLVM-MinGW under the user profile for a no-admin linker path.
- Persisted user PATH entries for Cargo and LLVM-MinGW.
- Fixed Anchor 1.0.2 CPI context calls to pass the token program `Pubkey`.
- Added `scripts/check-anchor-windows.ps1`.
- Added `npm run protocol:check:win`.
- Documented the Windows Rust protocol-check route.

## Verification

- `rustup run stable-x86_64-pc-windows-gnullvm cargo fmt --manifest-path programs\cryptoseeds_protocol\Cargo.toml -- --check`
- `rustup run stable-x86_64-pc-windows-gnullvm cargo check --manifest-path programs\cryptoseeds_protocol\Cargo.toml`

## Remaining Toolchain Limits

- WSL2 still requires enabling virtualization in BIOS/UEFI.
- `anchor build` and `anchor test` are still deferred until a Linux Solana/Anchor environment is available.
- Windows SDK install through Winget was blocked because the current shell is not elevated.
