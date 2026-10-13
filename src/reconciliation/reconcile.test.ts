import { describe, expect, it } from 'vitest';
import { sampleDraft, sampleInput } from '../../tests/fixtures/order.ts';
import { finalizeProposal } from './reconcile.ts';

const model = 'gemma-4-26b-a4b-it';
describe('reviewable proposals', () => {
  it('links validated sources and differences to a new proposal without writing an order', () => {
    const result = finalizeProposal(sampleInput, sampleDraft, model);
    expect(result.baseRevision).toBe(0);
    expect(result.pending).toEqual([]);
    expect(result.changes).toContainEqual({ field: 'items.normal.quantity', before: null, after: 12 });
    expect(result.evidence[0]?.kind).toBe('message');
    expect(sampleInput.current).toBeNull();
  });
  it('rejects evidence from a nonexistent message', () => {
    const draft = structuredClone(sampleDraft); draft.evidence[0]!.messageId = 'other';
    expect(() => finalizeProposal(sampleInput, draft, model)).toThrow('INVALID_MODEL_OUTPUT');
  });
  it('rejects a quote that was never said, including a whitespace-only quote', () => {
    for (const quote of ['never said', '   ']) {
      const draft = structuredClone(sampleDraft); draft.evidence[0]!.quote = quote;
      expect(() => finalizeProposal(sampleInput, draft, model)).toThrow('INVALID_MODEL_OUTPUT');
    }
  });
  it('rejects evidence for unsupported fields and duplicate field sources', () => {
    const draft = structuredClone(sampleDraft); draft.evidence[0]!.field = 'admin';
    expect(() => finalizeProposal(sampleInput, draft, model)).toThrow('INVALID_MODEL_OUTPUT');
    expect(() => finalizeProposal(sampleInput, { ...sampleDraft, evidence: [...sampleDraft.evidence, sampleDraft.evidence[0]!] }, model)).toThrow('INVALID_MODEL_OUTPUT');
  });
  it('marks missing evidence and fulfillment as blocking questions', () => {
    const draft = structuredClone(sampleDraft); draft.evidence = []; draft.state.fulfillment.date = null;
    const result = finalizeProposal(sampleInput, draft, model);
    expect(result.pending).toContainEqual(expect.objectContaining({ code: 'missing', field: 'fulfillment.date' }));
    expect(result.pending).toContainEqual(expect.objectContaining({ code: 'missing_evidence', field: 'items.normal.quantity' }));
  });
  it('retains ambiguity instead of assuming half of an odd total', () => {
    const draft = structuredClone(sampleDraft);
    draft.pending = [{ code: 'ambiguous', field: 'items', question: 'Quantos dos 17 serão sem granulado?' }];
    expect(finalizeProposal(sampleInput, draft, model).pending[0]?.code).toBe('ambiguous');
  });
  it('blocks a hallucinated product or variant', () => {
    const draft = structuredClone(sampleDraft); draft.state.items[0]!.variantId = 'vegan';
    expect(finalizeProposal(sampleInput, draft, model).pending).toContainEqual(expect.objectContaining({ code: 'unknown_product' }));
  });
  it('inherits only unchanged fields from the approved revision and does not mutate it', () => {
    const current = { orderId: 'order-1', revision: 1, proposalId: '11111111-1111-4111-8111-111111111111', state: sampleDraft.state, evidence: [] };
    const input = { ...sampleInput, current, messages: [{ id: 'm2', text: 'Troca para 18.' }] };
    const draft = structuredClone(sampleDraft); draft.state.items[0]!.quantity = 18;
    draft.evidence = [{ field: 'items.normal.quantity', messageId: 'm2', quote: 'Troca para 18.' }];
    const result = finalizeProposal(input, draft, model);
    expect(result.changes).toEqual([{ field: 'items.normal.quantity', before: 12, after: 18 }]);
    expect(result.evidence).toContainEqual({ field: 'fulfillment.date', kind: 'confirmed', revision: 1 });
    expect(result.pending).toEqual([]);
    expect(current.state.items[0]?.quantity).toBe(12);
  });
  it('requires a source for removal and explicit cancellation', () => {
    const current = { orderId: 'order-1', revision: 1, proposalId: '11111111-1111-4111-8111-111111111111', state: sampleDraft.state, evidence: [] };
    const result = finalizeProposal({ ...sampleInput, current }, { ...sampleDraft, state: { ...sampleDraft.state, items: [] }, evidence: [] }, model);
    expect(result.pending.some((q) => q.field.startsWith('items.normal'))).toBe(true);
  });
});
