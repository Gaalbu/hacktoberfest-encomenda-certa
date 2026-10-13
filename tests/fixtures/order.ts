import type { ModelDraft, ReconcileInput } from '../../src/reconciliation/schema.ts';

export const sampleInput: ReconcileInput = {
  orderId: 'order-1', referenceDate: '2026-10-13', current: null,
  catalog: [{ id: 'brigadeiro', name: 'Brigadeiro', aliases: ['brigadeiros'], variants: [{ id: 'normal', name: 'Com granulado' }, { id: 'plain', name: 'Sem granulado' }] }],
  messages: [{ id: 'm1', text: 'Quero 12 brigadeiros normais para retirar em 2026-10-17 às 15:00.' }],
};
export const sampleDraft: ModelDraft = {
  state: { status: 'active', items: [{ lineId: 'normal', productId: 'brigadeiro', variantId: 'normal', quantity: 12 }], fulfillment: { date: '2026-10-17', time: '15:00', mode: 'pickup' } },
  evidence: ['status', 'items.normal.productId', 'items.normal.variantId', 'items.normal.quantity', 'fulfillment.date', 'fulfillment.time', 'fulfillment.mode'].map((field) => ({ field, messageId: 'm1', quote: sampleInput.messages[0]!.text })),
  pending: [],
};
