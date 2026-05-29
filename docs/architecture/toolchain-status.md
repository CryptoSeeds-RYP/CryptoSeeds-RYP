# Toolchain Status

Current machine status:

- Node.js: installed
- npm: installed through `npm.cmd`
- Rust: installed in user profile
- Cargo: installed in user profile, but not currently on this shell's `PATH`
- Rustfmt: installed through rustup
- Chocolatey: installed but not usable for global installs without admin shell
- WSL: not installed
- MSVC C++ build tools: not found on PATH
- Solana/Agave CLI: not installed
- Anchor CLI / AVM: not installed

Verified Rust:

- `rustc 1.96.0`
- `cargo 1.96.0`

## Current Blocker

Anchor/Solana program compilation needs a full Solana development toolchain. On Windows, the cleanest production-grade path is usually one of:

1. Install WSL and use the official Solana Linux setup path.
2. Install native Windows C++ build tools, then install Anchor/AVM and Agave/Solana tooling natively.

The local attempt to install Anchor Version Manager through Cargo did not complete. The machine also does not expose `cl.exe` / `link.exe`, which is required by the default Windows MSVC Rust toolchain when compiling Rust crates.

`cargo check` using `C:\Users\FiercePC\.cargo\bin\cargo.exe` currently resolves and downloads dependencies, but fails at build-script linking with:

```text
linker `link.exe` not found
```

`cargo fmt -- --check` passes for the protocol program.

## Recommendation

Continue writing the protocol code and architecture in-repo now. Before compiling/deploying:

- Choose WSL or native Windows build tools.
- Install Solana/Agave CLI.
- Install Anchor CLI through AVM.
- Generate a real program keypair.
- Replace the placeholder program id in `Anchor.toml` and `declare_id!`.
- Run `anchor build`.
