import { z } from 'zod';

/** Разрешённые типы событий ledger (allowlist). */
export const ALLOWED_LEDGER_EVENT_TYPES = [
  'FILE_REGISTERED',
  // Добавлять сюда при необходимости: 'TMC_MOVEMENT', 'REQUEST_STATUS_CHANGE' и т.п.
] as const;

const fileRegisteredPayload = z.object({
  action: z.literal('FILE_REGISTERED'),
  relative_path: z.string().min(1).max(2048),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const eventSchemas: Record<(typeof ALLOWED_LEDGER_EVENT_TYPES)[number], z.ZodType> = {
  FILE_REGISTERED: fileRegisteredPayload,
};

export const ledgerAppendSchema = z.object({
  event_type: z.enum(ALLOWED_LEDGER_EVENT_TYPES),
  payload_json: z.record(z.string(), z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: 'payload must be non-empty object',
  }),
});

export function validateLedgerAppend(data: unknown): {
  success: true;
  event_type: (typeof ALLOWED_LEDGER_EVENT_TYPES)[number];
  payload_json: Record<string, unknown>;
} | { success: false; error: string } {
  const parsed = ledgerAppendSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues?.map((e) => e.message).join('; ') ?? parsed.error.message;
    return { success: false, error: msg };
  }
  const { event_type, payload_json } = parsed.data;
  const schema = eventSchemas[event_type];
  if (schema) {
    const payloadResult = schema.safeParse(payload_json);
    if (!payloadResult.success) {
      const msg = payloadResult.error.issues?.map((e) => e.message).join('; ') ?? payloadResult.error.message;
      return { success: false, error: `Invalid payload for ${event_type}: ${msg}` };
    }
  }
  return { success: true, event_type, payload_json };
}
