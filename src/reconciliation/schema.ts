import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const uniqueIds = (values: { id: string }[]) => new Set(values.map((value) => value.id)).size === values.length;
export const productSchema = z.strictObject({
  id: idSchema, name: z.string().min(1).max(80), aliases: z.array(z.string().min(1).max(80)).max(10),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  variants: z.array(z.strictObject({ id: idSchema, name: z.string().min(1).max(80) })).min(1).max(10).refine(uniqueIds, 'Duplicate variant ids'),
});
export const catalogSchema = z.array(productSchema).min(1).max(10).refine(uniqueIds, 'Duplicate product ids');
export const itemSchema = z.strictObject({
  lineId: idSchema, productId: idSchema, variantId: idSchema, quantity: z.number().int().min(1).max(10_000),
});
export const stateSchema = z.strictObject({
  status: z.enum(['active', 'cancelled']),
  items: z.array(itemSchema).max(20).refine((items) => {
    const ids = new Set(items.map((item) => item.lineId));
    const variants = new Set(items.map((item) => `${item.productId}/${item.variantId}`));
    return ids.size === items.length && variants.size === items.length;
  }, 'Duplicate item lines'),
  fulfillment: z.strictObject({ date: dateSchema.nullable(), time: timeSchema.nullable(), mode: z.enum(['pickup', 'delivery']).nullable() }),
});
export const messageEvidenceSchema = z.strictObject({ field: z.string().min(1).max(120), messageId: idSchema, quote: z.string().min(1).max(1000) });
export const fieldSourceSchema = z.discriminatedUnion('kind', [
  messageEvidenceSchema.extend({ kind: z.literal('message') }),
  z.strictObject({ kind: z.literal('confirmed'), field: z.string().min(1).max(120), revision: z.number().int().min(1) }),
  z.strictObject({ kind: z.literal('human'), field: z.string().min(1).max(120) }),
]);
export const snapshotSchema = z.strictObject({
  orderId: idSchema, revision: z.number().int().min(1), proposalId: z.string().uuid(),
  state: stateSchema, evidence: z.array(fieldSourceSchema).max(100),
});
export const requestSchema = z.strictObject({
  orderId: idSchema, referenceDate: dateSchema,
  messages: z.array(z.strictObject({ id: idSchema, text: z.string().min(1).max(8000) })).min(1).max(30)
    .refine(uniqueIds, 'Duplicate message ids')
    .refine((messages) => messages.reduce((sum, message) => sum + message.text.length, 0) <= 8000, 'Message text exceeds 8000 characters'),
  catalog: catalogSchema, current: snapshotSchema.nullable(),
}).refine((input) => !input.current || input.current.orderId === input.orderId, 'Snapshot belongs to a different order');
export const pendingSchema = z.strictObject({
  code: z.enum(['missing', 'ambiguous', 'unknown_product', 'multiple_orders', 'missing_evidence']),
  field: z.string().min(1).max(120), question: z.string().min(1).max(240),
});
export const draftSchema = z.strictObject({
  state: stateSchema, evidence: z.array(messageEvidenceSchema).max(100), pending: z.array(pendingSchema).max(30),
});
export const changeSchema = z.strictObject({ field: z.string(), before: z.union([z.string(), z.number(), z.null()]), after: z.union([z.string(), z.number(), z.null()]) });
export const proposalSchema = z.strictObject({
  proposalId: z.string().uuid(), orderId: idSchema, baseRevision: z.number().int().min(0), state: stateSchema,
  evidence: z.array(fieldSourceSchema).max(100), pending: z.array(pendingSchema).max(100), changes: z.array(changeSchema).max(100),
  model: z.string().min(1).max(80),
});
export type ReconcileInput = z.infer<typeof requestSchema>;
export type OrderState = z.infer<typeof stateSchema>;
export type ApprovedSnapshot = z.infer<typeof snapshotSchema>;
export type ModelDraft = z.infer<typeof draftSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type FieldSource = z.infer<typeof fieldSourceSchema>;
