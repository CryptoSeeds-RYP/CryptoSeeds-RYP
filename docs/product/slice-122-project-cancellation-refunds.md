# Slice 122: Project Cancellation And Refund Accounting

Project records now support cancellation and external refund accounting.

This is an accounting layer only. It does not custody user funds, transfer project funds, or imply automated financial rights.

## Added

- `CANCELLED` project lifecycle status.
- `cancel_project` admin instruction.
- `record_project_refund` admin instruction.
- `cancellation_hash` on `ProjectRecord`.
- `cancelled_at` on `ProjectRecord`.
- `refund_pool_amount` on `ProjectRecord`.
- `total_refunded_amount` on `ProjectRecord`.
- Events for project cancellation and refund accounting updates.
- TypeScript transaction planners for project cancellation and refund records.
- Localnet smoke coverage for cancellation/refund rejection paths.

## Rules

- Cancellation metadata must use a non-zero reviewed hash.
- Completed or already-cancelled projects cannot be cancelled again.
- Refund pool accounting cannot exceed recorded project participation.
- Refund accounting can only be recorded after cancellation.
- Refund records must use a positive amount.
- Total recorded refunds cannot exceed the refund pool.
- No token custody or token movement occurs in these instructions.

## Deferred

- Wallet-facing refund claim records.
- Project owner signed refund evidence.
- Program-controlled escrow or token movement, pending legal/security review.
- Positive refund smoke path after a funded public participation path exists.
