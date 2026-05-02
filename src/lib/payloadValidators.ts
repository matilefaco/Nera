import { z } from 'zod';
import { sanitizeForFirestore } from './firestoreSafe.js';

const requiredString = (field: string) => z.string({ error: `${field} ausente` }).trim().min(1, `${field} ausente`);

export const profilePayloadSchema = z.object({
  uid: requiredString('uid'),
  profileData: z.object({
    slug: requiredString('slug'),
  }).passthrough(),
  services: z.array(z.record(z.string(), z.any())).optional(),
});

export const bookingPayloadSchema = z.object({
  professionalId: requiredString('professionalId'),
  serviceId: requiredString('serviceId'),
  clientName: requiredString('clientName'),
  clientWhatsapp: requiredString('clientWhatsapp'),
  date: requiredString('date'),
  time: requiredString('time'),
}).passthrough();

export const sanitizeDeep = <T>(payload: T): T => sanitizeForFirestore(payload);

export function validateProfilePayload(payload: unknown) {
  const parsed = profilePayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Payload de perfil inválido');
  return sanitizeDeep(parsed.data);
}

export function validateBookingPayload(payload: unknown) {
  const parsed = bookingPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Payload de booking inválido');
  return sanitizeDeep(parsed.data);
}

export function hasUndefinedDeep(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefinedDeep);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasUndefinedDeep);
  return false;
}
