# Windows Rust Protocol Check

This machine can now run a host-side Rust check for the CryptoSeeds Anchor program without WSL or elevated Windows SDK installs.

## Installed User Tooling

- Rustup / Cargo are available under `%USERPROFILE%\.cargo\bin`.
- Rust toolchain: `stable-x86_64-pc-windows-gnullvm`.
- Portable LLVM-MinGW is unpacked under `%USERPROFILE%\.toolchains\llvm-mingw`.
- User PATH now includes:
  - `%USERPROFILE%\.cargo\bin`
  - `%USERPROFILE%\.toolchains\llvm-mingw\bin`

## Why This Route Exists

WSL remains blocked because CPU virtualization is disabled in firmware.

The normal Windows MSVC Rust path was also blocked because the current shell is not elevated and the Windows SDK system installer could not install `kernel32.lib`.

The `gnullvm` Rust toolchain plus portable LLVM-MinGW gives us a no-admin linker path for host-side Rust verification.

## Command

Run from the repo root:

```powershell
npm run protocol:check:win
```

This runs:

```powershell
rustup run stable-x86_64-pc-windows-gnullvm cargo fmt --manifest-path programs\cryptoseeds_protocol\Cargo.toml -- --check
rustup run stable-x86_64-pc-windows-gnullvm cargo check --manifest-path programs\cryptoseeds_protocol\Cargo.toml
```

## Current Limit

This is not a replacement for `anchor build` or `anchor test` against a Solana local validator.

Full Anchor/Solana deployment verification still needs one of:

- WSL2 after enabling virtualization in BIOS/UEFI.
- A Linux CI runner.
- A remote Linux dev box.

## Current Result

`cargo fmt --check` and `cargo check` pass for `programs/cryptoseeds_protocol`.

Anchor/Solana dependency macros currently emit `unexpected cfg` warnings on Rust 1.96.0. These warnings are from upstream macro cfg declarations and are not compile errors in the CryptoSeeds program.
