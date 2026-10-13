# Production list

## Objective and boundary
Consolidate approved snapshots by fulfillment date/product/variant. Depends on order-book;
no model, network, persistence or reinterpretation of messages. UI is a later integration.

## Contract
One latest revision per order id; reject conflicting duplicate revisions. Aggregate active
confirmed orders only. Exclude cancellations. Preserve sources to each order and revision.
Return stable date/product/variant ordering, integer quantity and contribution references.
Revision replacement must not count both old and new quantities; pending candidates are
not snapshots and fail schema validation. Variants are never merged by display name.

## Structure, style and commands
`src/production/aggregate.ts`; strict typed pure functions and explicit input validation.
`npm test -- src/production/`, `npm run typecheck`, `npm run build`.

## Success and tests
Multiple orders, product variants, dates, cancellation, replacing revisions, duplicate
conflicts, pending input and empty input have exact expected outputs. Always aggregate
confirmed data. Ask before ingredient planning. Never claim food/allergen safety.
