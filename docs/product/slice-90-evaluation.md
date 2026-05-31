# Slice 90 Evaluation - Second Critical Audit Pass

## Goal

Find at least ten more concrete weaknesses after the first backend hardening pass and fix them with tests.

## Issues Fixed

1. Risk disclosure version selection used lexicographic sorting.
   - Fixed with numeric version comparison so `v10.0` beats `v2.0`.

2. Projects without a risk disclosure could still look structurally valid.
   - Fixed by warning and blocking eligibility when the risk disclosure is missing.

3. Required project documents could lack URI or content-hash proof.
   - Fixed by blocking eligibility when required documents are missing proof fields.

4. Rejected project operators were not an explicit eligibility blocker.
   - Fixed by surfacing rejected operator verification as a blocking disclosure issue.

5. Participation records could be prepared without checking project eligibility.
   - Fixed by requiring `activeTier` and eligibility evaluation before creating prepared participation.

6. Prepared participation accepted empty wallet addresses.
   - Fixed by rejecting blank wallet addresses before slot assignment.

7. Admin dashboard could unlock while demo mode was active.
   - Fixed by adding `DEMO_BLOCKED` access state and blocker text.

8. Fixture project registry returned mutable project references.
   - Fixed by returning defensive project copies from list/get calls.

9. Solana wallet boundary accepted malformed prepared instruction plans too late.
   - Fixed by validating instruction data hex, program ids, and account public keys before wallet boundary creation.

10. Solana signature requests did not check whether the simulation boundary belonged to the currently connected wallet.
    - Fixed by blocking boundary/wallet mismatches before signature request.

11. RYP amount parsing accepted invalid decimal configuration.
    - Fixed by requiring token decimals to be an integer between 0 and 18.

12. SeedBot fee model copy did not validate fee bps or split totals before disclosure.
    - Fixed with fee-model validation and invalid-preview copy.

## Verification

- `npm test` - 30 files, 149 tests passed.
- `npm run build`.
- `npm run copy:audit`.
- `npm run visual:audit`.
- `npm run ops:check`.
- `npm run token:check`.
- `npm run devnet:readiness` - expected `BLOCKED` status until real devnet deployment config replaces placeholder/demo settings.
- `npm run protocol:idl:check`.
- `npm audit --omit=dev` - 0 vulnerabilities.
- `cargo test --manifest-path programs/cryptoseeds_protocol/Cargo.toml` - 9 Rust tests passed.

## Safety Posture

- No broadcast path was added.
- No admin execution path was enabled.
- No SeedBot live trading path was enabled.
- Project participation preparation is now tied to eligibility and disclosure checks.

## Next Step

Continue toward localnet/devnet readiness, protocol fixture verification, and the first reviewed devnet deployment candidate.
