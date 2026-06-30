# Public Testnet Readiness

The public testnet readiness command gives one non-mutating answer for whether the repo can move from local/devnet preparation into public devnet review.

```bash
npm run testnet:readiness -- --env .env.devnet.example
```

The command runs the existing readiness gates and returns a single JSON report:

- ops readiness,
- devnet status,
- devnet broadcast readiness,
- devnet program inspection.

It does not create accounts, deploy programs, initialize protocol state, send transactions, or enable frontend broadcast.

The report intentionally includes the broadcast readiness gate. If the only remaining blocker is `VITE_SOLANA_BROADCAST_ENABLED is false`, the system may be ready for a read-only devnet preview, but it is not ready for wallet-enabled public testnet flows.

## Status Values

- `READY_FOR_PUBLIC_TESTNET_REVIEW`: all child readiness checks passed.
- `BLOCKED`: one or more child readiness checks reported blockers, failed, or did not return parseable JSON.

Use strict mode when a non-zero exit code is needed for release automation:

```bash
npm run testnet:readiness -- --env .env.devnet.example --strict
```

## Current Expected Blocker

Until the devnet authority wallet has SOL and the devnet program is deployed, the report should remain `BLOCKED`.

Current required authority:

```text
Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe
```

Minimum funding to create the devnet test mint is `0.1 SOL`; `3 SOL` is recommended before deployment.

## Review Rule

Passing this command is not permission to enable public wallet execution by itself. It only means the repo-side public testnet readiness gates agree. Wallet-approved transaction categories should still be enabled one category at a time after decoded account inspection and signer/account preview review.
