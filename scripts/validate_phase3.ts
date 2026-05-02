import assert from 'node:assert/strict';
import { validateProfilePayload, validateBookingPayload, hasUndefinedDeep, sanitizeDeep } from '../src/lib/payloadValidators.js';

const run = () => {
  const profile = validateProfilePayload({ uid: 'uid-123', profileData: { slug: 'ana-silva', bio: undefined } });
  assert.equal(profile.uid, 'uid-123');
  assert.equal(profile.profileData.slug, 'ana-silva');

  const booking = validateBookingPayload({
    professionalId: 'pro-1', serviceId: 'svc-1', clientName: 'Ana', clientWhatsapp: '85999990000', date: '2026-05-03', time: '09:00', extra: undefined,
  });
  assert.equal(booking.serviceId, 'svc-1');

  const cleaned = sanitizeDeep({ a: 1, b: undefined, deep: { c: undefined, d: 2 } });
  assert.deepEqual(cleaned, { a: 1, deep: { d: 2 } });
  assert.equal(hasUndefinedDeep(cleaned), false);

  assert.throws(() => validateProfilePayload({ profileData: { slug: 'x' } }), /uid ausente/);
  assert.throws(() => validateProfilePayload({ uid: 'ok', profileData: {} }), /slug ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: '', serviceId: 's', clientName: 'n', clientWhatsapp: 'w', date: 'd', time: 't' }), /professionalId ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: 'p', clientName: 'n', clientWhatsapp: 'w', date: 'd', time: 't' }), /serviceId ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: 'p', serviceId: 's', clientWhatsapp: 'w', date: 'd', time: 't' }), /clientName ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: 'p', serviceId: 's', clientName: 'n', date: 'd', time: 't' }), /clientWhatsapp ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: 'p', serviceId: 's', clientName: 'n', clientWhatsapp: 'w', time: 't' }), /date ausente/);
  assert.throws(() => validateBookingPayload({ professionalId: 'p', serviceId: 's', clientName: 'n', clientWhatsapp: 'w', date: 'd' }), /time ausente/);

  console.log('Phase 3 validation checks passed.');
};

run();
