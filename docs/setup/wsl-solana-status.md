# WSL and Solana Setup Status

Date: 2026-05-29

Rechecked: 2026-05-31

## Current Status

The elevated Windows WSL setup helper was launched from:

`scripts/setup-wsl-solana.ps1`

Current machine status:

- WSL default version is set to 2.
- No Linux distribution is installed yet.
- WSL2 cannot start because virtualization is not enabled in firmware.
- `systeminfo` reports `Virtualization Enabled In Firmware: No`.
- Windows PowerShell now has a host-side Rust check route through Cargo, the `stable-x86_64-pc-windows-gnullvm` toolchain, and portable LLVM-MinGW.
- Anchor CLI and Solana CLI are still not available for local validator deployment.

## Required User Action

Enable CPU virtualization in firmware/BIOS.

Common names:

- Intel VT-x
- Intel Virtualization Technology
- AMD-V
- SVM Mode

After enabling virtualization, reboot Windows.

## Next Commands

After reboot, verify WSL:

```powershell
wsl --status
wsl -l -v
```

If Ubuntu is not listed:

```powershell
wsl --install -d Ubuntu
```

After Ubuntu opens and the Linux user is created, run the Linux Solana/Anchor bootstrap from inside WSL:

```bash
cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse
bash scripts/setup-solana-anchor-linux.sh
```

Then verify the Anchor program:

```bash
cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse/programs/cryptoseeds_protocol
cargo fmt -- --check
cargo check
```

Until WSL is available, use the Windows host-side Rust check from the repo root:

```powershell
npm run protocol:check:win
```

## Why This Matters

The Windows Rust path is blocked by a missing MSVC linker. WSL/Linux is the cleaner route for Solana and Anchor development because it matches the expected toolchain and avoids Windows linker friction.
