# Order reconciliation

Execution authorized by the user on 2026-10-13, following the private capability map.

## Objective and boundaries
Turn one ordered conversation into a reviewable proposal. This service is stateless.
Messages, catalog and current approved snapshot are untrusted HTTP input. Gemma output
is untrusted, never an instruction to write orders or execute tools. One selected order
per request; no customer inference or conversation merging. Unknown/ambiguous facts
remain pending. Source verification proves literal existence, not semantic correctness.

## Contract
`POST /api/reconcile` accepts `orderId`, `messages: [{id,text}]`, `referenceDate`
(real YYYY-MM-DD date in America/Bahia), `catalog` and nullable `current` snapshot.
Max 30 unique message ids, 8000 combined characters, 10 unique products, 20 item lines.
Each catalog product has id/name/aliases and named variant ids; prices are optional
integer cents entered by the operator. Current snapshot must belong to this order.
Output: proposal id, order id, base revision, candidate state, literal message evidence,
pending questions, deterministic changes, model id and bounded inference metadata.
Critical candidate fields: status, line product/variant/quantity, fulfillment date/time,
mode. Sources are required for new/changed fields; unchanged fields may inherit current.
Manual edits explicitly have human origin. Quantity is a positive integer. Duplicate
product+variant lines, invalid dates, missing ids/quotes and out-of-catalog selections
are never accepted as confirmable. Missing mandatory fields create blocking questions.
Pending proposals cannot be confirmed. Multiple-order warnings also block confirmation.

HTTP errors: consistent `{error:{code,message},requestId}`; invalid JSON 400, invalid
input 422, oversized body 413, wrong type 415, capacity/quota 429, disabled/unconfigured
503, provider failure/invalid output 502, timeout 504. Errors contain no provider body.
Health at `/api/health` makes no model call and distinguishes configured from live proven.
One call per analysis; at most one format correction, never retry 429/auth/network errors.
Timeout/cancellation covers the entire analysis. Kill switch and bounded concurrency,
per-client and process-wide budgets. In-memory budgets reset on restart; not a financial cap.

## Structure, style and commands
`src/reconciliation/` owns schemas/evidence/differences; `server/` owns transport,
Gemma REST adapter, Mastra workflow and HTTP. `npm test -- server/model.test.ts`,
`npm test -- src/reconciliation/`, `npm run typecheck`, `npm run build`.
Example style: `function changed<T>(before: T, after: T): boolean { return before !== after; }`
Use semicolons, explicit types at public boundaries, small named functions and `.ts`
relative imports rewritten by TypeScript for production. Pin dependencies and lockfile.

## Verification
Test unknown sources, invented variants, duplicate ids, invalid/relative dates, malicious
instructions, preservation, pending questions, 429/timeout/cancel, two malformed model
responses and health without credentials. Use real Mastra with a fake only at the model
network boundary. Real Gemma smoke/evaluation is separate from deterministic CI.
24 labeled synthetic scenarios (12 development, 12 held-out) compare a generic baseline
and the full workflow. Do not report evaluation success from fixture tests.
Always validate, fail explicitly and minimize data. Ask before changing commercial scope,
enabling billing or deploying a paid service. Never commit secrets or unreviewed user data.
