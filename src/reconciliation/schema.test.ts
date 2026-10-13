import { describe, expect, it } from 'vitest';
import { requestSchema, stateSchema } from './schema.ts';

const request = {
  orderId: 'order-1', referenceDate: '2026-10-13', current: null,
  messages: [{ id: 'm1', text: 'Quero 12 brigadeiros.' }],
  catalog: [{ id: 'brigadeiro', name: 'Brigadeiro', aliases: [], variants: [{ id: 'normal', name: 'Com granulado' }] }],
};

describe('reconciliation input', () => {
  it('accepts one explicitly selected order', () => expect(requestSchema.parse(request)).toEqual(request));
  it.each(['2026-02-30', '2026-13-01', 'amanhã'])('rejects invalid reference date %s', (referenceDate) => {
    expect(requestSchema.safeParse({ ...request, referenceDate }).success).toBe(false);
  });
  it('rejects duplicate message ids', () => {
    expect(requestSchema.safeParse({ ...request, messages: [request.messages[0], request.messages[0]] }).success).toBe(false);
  });
  it('rejects combined message text over 8000 characters', () => {
    expect(requestSchema.safeParse({ ...request, messages: [{ id: 'a', text: 'x'.repeat(4001) }, { id: 'b', text: 'x'.repeat(4000) }] }).success).toBe(false);
  });
  it('rejects duplicate product and variant ids', () => {
    expect(requestSchema.safeParse({ ...request, catalog: [request.catalog[0], request.catalog[0]] }).success).toBe(false);
    expect(requestSchema.safeParse({ ...request, catalog: [{ ...request.catalog[0], variants: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }] }).success).toBe(false);
  });
  it('rejects noninteger quantities and unexpected properties', () => {
    const state = { status: 'active', items: [{ lineId: 'l1', productId: 'brigadeiro', variantId: 'normal', quantity: 1.5 }], fulfillment: { date: null, time: null, mode: null } };
    expect(stateSchema.safeParse(state).success).toBe(false);
    expect(requestSchema.safeParse({ ...request, secret: 'not-allowed' }).success).toBe(false);
  });
  it('rejects fractional money and duplicate item lines', () => {
    expect(requestSchema.safeParse({ ...request, catalog: [{ ...request.catalog[0], priceCents: 1.2 }] }).success).toBe(false);
    const line = { lineId: 'l1', productId: 'brigadeiro', variantId: 'normal', quantity: 12 };
    expect(stateSchema.safeParse({ status: 'active', items: [line, { ...line, lineId: 'l2' }], fulfillment: { date: null, time: null, mode: null } }).success).toBe(false);
  });
});
