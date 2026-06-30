# Public Testnet Readiness

The public testnet readiness command gives one non-mutating answer for whether the repo can move from local/devnet preparation into public devnet review.

```bash
npm run testnet:readiness -- --env .env.devnet.example
```

The default profile is `wallet-execution`. It runs the existing readiness gates and returns a single JSON report:

- ops readiness,
- devnet status,
- devnet broadcast readiness,
- devnet program inspection,
- devnet protocol state inspection.

It does not create accounts, deploy programs, initialize protocol state, send transactions, or enable frontend broadcast.

The report intentionally includes the broadcast readiness gate. If the only remaining blocker is `VITE_SOLANA_BROADCAST_ENABLED is false`, the system may be ready for a read-only devnet preview, but it is not ready for wallet-enabled public testnet flows.

For a read-only public preview gate, run:

```bash
npm run testnet:readiness -- --profile read-only --env .env.devnet.example
```

The read-only profile checks ops readiness, devnet status, devnet program inspection, and devnet protocol state inspection. It intentionally excludes the broadcast readiness gate because no wallet execution path should be enabled for that profile.

## Status Values

- `READY_FOR_PUBLIC_TESTNET_REVIEW`: all child readiness checks passed.
- `READY_FOR_READ_ONLY_TESTNET_PREVIEW`: the read-only preview profile passed while keeping wallet execution out of scope.
- `BLOCKED`: one or more child readiness checks reported blockers, failed, or did not return parseable JSON.

Use strict mode when a non-zero exit code is needed for release automation:

```bash
npm run testnet:readiness -- --env .env.devnet.example --strict
```

```bash
npm run testnet:readiness -- --profile read-only --env .env.devnet.example --strict
```

## Current Expected Blocker

Until the devnet authority wallet has SOL and the devnet program is deployed, the report should remain `BLOCKED`.

Current required authority:

```text
Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe
```

Minimum funding to create the devnet test mint is `0.1 SOL`; `3 SOL` is recommended before deployment.

## Review Rule

Passing the read-only profile is not permission to enable wallet signing or broadcast. Passing the wallet-execution profile is not permission to skip human release review. Wallet-approved transaction categories should still be enabled one category at a time after decoded account inspection and signer/account preview review.
