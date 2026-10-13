import { DomainError } from './errors.ts';
import { draftSchema, proposalSchema, requestSchema, type ModelDraft, type ReconcileInput, type OrderState, type FieldSource, type Proposal, type Catalog } from './schema.ts';

export function stateFields(state: OrderState | null): Map<string, string | number | null> {
  if (!state) return new Map();
  const fields = new Map<string, string | number | null>([
    ['status', state.status], ['fulfillment.date', state.fulfillment.date],
    ['fulfillment.time', state.fulfillment.time], ['fulfillment.mode', state.fulfillment.mode],
  ]);
  for (const item of state.items) {
    fields.set(`items.${item.lineId}.productId`, item.productId);
    fields.set(`items.${item.lineId}.variantId`, item.variantId);
    fields.set(`items.${item.lineId}.quantity`, item.quantity);
  }
  return fields;
}

export function stateChanges(before: OrderState | null, after: OrderState): Proposal['changes'] {
  const oldFields = stateFields(before);
  const newFields = stateFields(after);
  return [...new Set([...oldFields.keys(), ...newFields.keys()])].flatMap((field) => {
    const previous = oldFields.get(field) ?? null;
    const next = newFields.get(field) ?? null;
    return previous === next ? [] : [{ field, before: previous, after: next }];
  });
}

function validatedSources(input: ReconcileInput, draft: ModelDraft): FieldSource[] {
  const allowed = new Set([...stateFields(input.current?.state ?? null).keys(), ...stateFields(draft.state).keys()]);
  for (const item of input.current?.state.items ?? []) allowed.add(`items.${item.lineId}`);
  for (const item of draft.state.items) allowed.add(`items.${item.lineId}`);
  const seen = new Set<string>();
  return draft.evidence.map((source) => {
    const message = input.messages.find((entry) => entry.id === source.messageId);
    if (!allowed.has(source.field) || seen.has(source.field) || !source.quote.trim() || !message?.text.includes(source.quote)) {
      throw new DomainError('INVALID_MODEL_OUTPUT');
    }
    seen.add(source.field);
    return { ...source, kind: 'message' as const };
  });
}

export function requiredQuestions(state: OrderState, catalog: Catalog): Proposal['pending'] {
  if (state.status === 'cancelled') return [];
  const pending: Proposal['pending'] = [];
  for (const [field, value] of Object.entries(state.fulfillment)) {
    if (value === null) pending.push({ code: 'missing', field: `fulfillment.${field}`, question: `Confirme ${field === 'date' ? 'a data' : field === 'time' ? 'o horário' : 'retirada ou entrega'}.` });
  }
  if (!state.items.length) pending.push({ code: 'missing', field: 'items', question: 'Quais produtos e quantidades serão preparados?' });
  for (const item of state.items) {
    const product = catalog.find((entry) => entry.id === item.productId);
    if (!product?.variants.some((variant) => variant.id === item.variantId)) {
      pending.push({ code: 'unknown_product', field: `items.${item.lineId}`, question: 'Escolha um produto e uma variante existentes no catálogo.' });
    }
  }
  return pending;
}

function completeSources(input: ReconcileInput, draft: ModelDraft, evidence: FieldSource[], pending: Proposal['pending']): void {
  const before = stateFields(input.current?.state ?? null);
  const after = stateFields(draft.state);
  for (const field of new Set([...before.keys(), ...after.keys()])) {
    const value = after.get(field) ?? null;
    const old = before.get(field) ?? null;
    if (value === null && old === null) continue;
    if (evidence.some((source) => source.field === field)) continue;
    if (input.current && old === value) {
      evidence.push({ kind: 'confirmed', field, revision: input.current.revision });
      continue;
    }
    const line = field.startsWith('items.') ? field.split('.').slice(0, 2).join('.') : null;
    if (line && evidence.some((source) => source.field === line)) continue;
    if (draft.state.status === 'cancelled' && evidence.some((source) => source.field === 'status')) continue;
    pending.push({ code: 'missing_evidence', field, question: 'Confirme esta alteração; não há mensagem de origem válida.' });
  }
}

export function finalizeProposal(rawInput: ReconcileInput, rawDraft: ModelDraft, model: string): Proposal {
  const input = requestSchema.parse(rawInput);
  const parsed = draftSchema.safeParse(rawDraft);
  if (!parsed.success) throw new DomainError('INVALID_MODEL_OUTPUT');
  const draft = parsed.data;
  const evidence = validatedSources(input, draft);
  const pending = [...draft.pending, ...requiredQuestions(draft.state, input.catalog)];
  completeSources(input, draft, evidence, pending);
  return proposalSchema.parse({
    proposalId: crypto.randomUUID(), orderId: input.orderId, baseRevision: input.current?.revision ?? 0,
    state: draft.state, evidence, pending, model, changes: stateChanges(input.current?.state ?? null, draft.state),
  });
}
