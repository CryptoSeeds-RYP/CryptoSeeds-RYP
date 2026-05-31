# WSL and Solana Setup Status

Date: 2026-05-31

## Current Status

Current machine status:

- WSL package is installed.
- WSL version is `2.7.3.0`.
- WSL kernel version is `6.6.114.1-1`.
- WSL default version is `2`.
- `wsl --install Ubuntu-24.04 --no-launch --web-download` returned successfully.
- Windows reports the WSL install changes will not be effective until reboot.
- No Linux distribution is visible in `wsl -l -v` yet.
- `systeminfo` reports `Virtualization Enabled In Firmware: No`.
- Current shell is not elevated, so optional Windows feature inspection/enabling is blocked from this session.
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

After reboot, verify firmware virtualization and WSL:

```powershell
npm run wsl:check
wsl --status
wsl -l -v
```

If Ubuntu 24.04 is not listed after reboot:

```powershell
wsl --install Ubuntu-24.04 --web-download
```

Launch Ubuntu and create the Linux user:

```powershell
wsl -d Ubuntu-24.04
```

After Ubuntu opens and the Linux user is created, run the Linux Solana/Anchor bootstrap inside WSL:

```bash
cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse
bash scripts/setup-solana-anchor-linux.sh
```

Then verify the Anchor program:

```bash
cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse
anchor build
anchor test
```

Until WSL is available, use the Windows host-side Rust check from the repo root:

```powershell
npm run protocol:check:win
npm run protocol:test:win
```

## Why This Matters

WSL/Linux is the cleaner route for Solana and Anchor development because it matches the expected toolchain and avoids Windows linker friction.
