# Confirmed order book

## Objective
Pure browser-compatible domain code for human confirmation; depends on reconciliation.
The backend never stores orders. UI and browser persistence are a later integration.

## Contract
A confirmed snapshot carries id, positive revision, state, latest proposal id and bounded
revision summaries with explicit human/message origins. Confirmation validates proposal,
order, base revision, catalog and unresolved questions before advancing. A replay of the
last proposal is a no-op; a stale proposal is a conflict. Cancel only after confirmation.
Manual edits require an explicit human confirmation path; sources for changed fields
are marked human rather than fabricated. Confirmed active orders require items and
complete fulfillment. Preserve approved state on every failure.
Maximum 25 orders. JSON backup has version and strict schema; validate size, duplicate ids,
references and revision sequence. Import is atomic; reject conflicting replacements.

## Commands, structure and style
`src/orders/` owns confirmation, backups and storage adapter; same strict TypeScript style
as reconciliation. `npm test -- src/orders/`, `npm run typecheck`, `npm run build`.
Storage interface: `getItem(key): string|null`, `setItem(key,value): void`, `removeItem(key): void`.
No wrappers hiding exceptions; report storage corruption and failed writes.

## Success and tests
Cover stale revision, wrong order, pending, double confirmation, manual edits, cancellation,
save/reload, quota failure, corruption, import/export and duplicate imports. A snapshot
is returned as saved only after successful write. Never erase corrupt data silently.
Always validate backups and keep history bounded. Ask before adding cloud storage.
Never imply local storage is encrypted or automatically backed up.
