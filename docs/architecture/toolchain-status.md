# Toolchain Status

Current machine status:

- Node.js: installed
- npm: installed through `npm.cmd`
- Rust: installed in user profile
- Cargo: installed in user profile
- Rustfmt: installed through rustup
- Chocolatey: installed but not usable for global installs without admin shell
- WSL package: installed
- WSL version: `2.7.3.0`
- WSL default version: `2`
- Ubuntu 24.04 install: staged with `wsl --install Ubuntu-24.04 --no-launch --web-download`, pending reboot
- Firmware virtualization: disabled
- Windows optional feature inspection: requires elevated shell
- Windows host-side Rust check path: available through `stable-x86_64-pc-windows-gnullvm` and portable LLVM-MinGW
- Solana/Agave CLI: not installed
- Anchor CLI / AVM: not installed

Verified Rust:

- `rustc 1.96.0`
- `cargo 1.96.0`

## Current Blocker

Anchor/Solana program compilation needs a full Solana development toolchain. On Windows, the cleanest production-grade path is usually one of:

1. Install WSL and use the official Solana Linux setup path.
2. Install native Windows C++ build tools, then install Anchor/AVM and Agave/Solana tooling natively.

WSL is partly staged, but WSL2 cannot start until firmware virtualization is enabled and Windows is rebooted. The current shell is not elevated, so Windows optional features cannot be inspected or enabled from this session.

The normal Windows MSVC Rust path was blocked by Windows SDK/linker requirements. The no-admin host-side route now works through the `gnullvm` Rust toolchain and portable LLVM-MinGW.

`npm run protocol:check:win` and `npm run protocol:test:win` pass for the protocol program.

## Recommendation

Continue writing the protocol code and architecture in-repo now. Before compiling/deploying:

- Enable CPU virtualization in BIOS/UEFI.
- Reboot Windows so the staged Ubuntu/WSL changes take effect.
- Launch Ubuntu 24.04 and create the Linux user.
- Install Solana/Agave CLI.
- Install Anchor CLI through AVM.
- Generate a real program keypair.
- Replace the placeholder program id in `Anchor.toml` and `declare_id!`.
- Run `anchor build`.
