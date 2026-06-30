# Operations Model

CryptoSeeds should be advanced internally and simple operationally. The target is a system a non-specialist operator can monitor through plain-language checks, while an AI agent can run diagnostics, draft reports, and prepare review queues without ever taking custody or making live approvals.

## Principles

- Traffic-light status over complex operator dashboards.
- Scripted checks for repeated work.
- Plain-language runbooks for incidents and releases.
- Human or multisig approval for live state changes.
- AI agents may assist, but must not sign, custody, broadcast, approve projects, move treasury funds, or alter fee parameters.
- Sensitive operations must produce visible logs and review artifacts.

## Maintenance Runbook

| Item | Cadence | Script | Automation Mode | Approval |
| --- | --- | --- | --- | --- |
| App regression check | Every commit | `npm.cmd test && npm.cmd run build` | Monitor only | No |
| Copy and visual safety | Every commit | `npm.cmd run copy:audit && npm.cmd run visual:audit` | Monitor only | No |
| RYP token health | Daily | `npm.cmd run token:check` | Monitor only | No |
| Devnet protocol state inspection | Before launch | `npm.cmd run devnet:inspect:protocol -- --env .env.devnet.example` | Monitor only | No |
| Read-only public testnet gate | Before launch | `npm.cmd run testnet:readiness -- --profile read-only --env .env.devnet.example` | Draft only | Yes |
| Broadcast readiness gate | Before launch | `npm.cmd run testnet:readiness -- --profile wallet-execution --env .env.devnet.example` | Approval required | Yes |
| Protocol drift gate | Every commit | `npm.cmd run protocol:idl:check` | Monitor only | No |
| Reward epoch draft check | Weekly | `npm.cmd run rewards:epoch:draft` | Draft only | Yes |
| Project disclosure review | Weekly | Review queue | Draft only | Yes |
| Treasury label review | Weekly | Review queue | Draft only | Yes |
| SeedBot permission review | Before launch | Disabled | Blocked | Yes |

## AI Agent Policy

Allowed:

- Run checks.
- Summarize logs.
- Draft PRs.
- Draft governance/project review queues.
- Alert humans to blockers.
- Prepare transaction previews.

Blocked:

- Requesting or storing seed phrases.
- Creating or holding production private keys.
- Signing wallet transactions.
- Enabling broadcast.
- Moving treasury funds.
- Approving projects.
- Changing fee splits.
- Creating SeedBot agent permissions.
- Broadcasting live SeedBot trades.

## Set-And-Forget Target

The eventual production operations surface should show:

- token health,
- protocol health,
- project disclosure health,
- treasury label health,
- reward epoch draft balance and vault role health,
- SeedBot permission status,
- open governance actions,
- failed checks,
- next required human approval.

The operator should see what needs attention without understanding every protocol detail. Advanced details should remain available behind each status.
