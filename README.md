# VaultFoundry v8

## Reusable Blocks 2.0

This release expands the reusable-content system:

- Block categories and filtering
- Block search
- Block metadata editing
- Block version history
- Immutable component snapshots for block versions
- Version-aware block API (`GET /api/blocks/:id?version=N`)
- Drag blocks directly from the Builder library onto the email canvas
- Click-to-insert blocks remains supported
- Inserted blocks remain independent copies and retain source block/version metadata

## Architecture

Blocks continue to be independent from emails. Updating a block does not mutate emails that previously inserted it.

The local development store records historical block component snapshots in `versions`. This can map directly to the planned PostgreSQL `block_versions` table later.

## Verification

The workspace does not include installed npm dependencies, so a full Next.js build cannot be run in this environment. System TypeScript was invoked only to confirm that dependency resolution is unavailable; no build-success claim is made.
