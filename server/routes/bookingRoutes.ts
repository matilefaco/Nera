import express from 'express';
import { getDb } from '../firebaseAdmin.js';
import admin from 'firebase-admin';
import { removeEmptyFields, generateReservationCode, getClientKey, normalizeId } from '../utils.js';

export const bookingRouter = express.Router();

type ServiceMatch = {
  id: string;
  data: Record<string, any>;
  source: 'direct-doc' | 'root-services' | 'embedded-profile' | 'single-professional-service' | 'legacy-unmatched';
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueCandidates(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeId(value)).filter(Boolean)));
}

function candidateMatches(candidate: unknown, keys: string[]): boolean {
  const candidateId = normalizeId(candidate);
  const candidateText = normalizeText(candidate);

  return keys.some((key) => {
    const keyId = normalizeId(key);
    const keyText = normalizeText(key);
    return (
      candidateId === keyId ||
      candidateText === keyText ||
      (!!candidateText && !!keyText && candidateText.includes(keyText)) ||
      (!!candidateText && !!keyText && keyText.includes(candidateText))
    );
  });
}

async function resolveDashboardProfessionalId(
  db: admin.firestore.Firestore,
  profileDocId: string,
  professionalData: Record<string, any>
): Promise<string> {
  const explicit = normalizeId(
    professionalData.dashboardProfessionalId ||
    professionalData.authUid ||
    professionalData.ownerId ||
    professionalData.userId ||
    professionalData.uid
  );

  if (explicit && explicit !== profileDocId) return explicit;

  const email = String(professionalData.email || '').trim().toLowerCase();
  if (email) {
    try {
      const authUser = await admin.auth().getUserByEmail(email);
      const authUid = normalizeId(authUser.uid);
      if (authUid) {
        console.log('[API_BOOKING] owner resolved by Firebase Auth email', { profileDocId, authUid, email });
        try {
          await db.collection('users').doc(profileDocId).set({ dashboardProfessionalId: authUid }, { merge: true });
        } catch (cacheErr: any) {
          console.warn('[API_BOOKING] could not cache dashboardProfessionalId', cacheErr.message);
        }
        return authUid;
      }
    } catch (authErr: any) {
      console.warn('[API_BOOKING] auth email lookup failed', { email, message: authErr.message });
    }

    try {
      const sameEmail = await db.collection('users').where('email', '==', email).limit(10).get();
      const otherDoc = sameEmail.docs.find((doc) => normalizeId(doc.id) !== profileDocId);
      if (otherDoc) {
        const ownerId = normalizeId(otherDoc.id);
        console.log('[API_BOOKING] owner resolved by users.email', { profileDocId, ownerId, email });
        try {
          await db.collection('users').doc(profileDocId).set({ dashboardProfessionalId: ownerId }, { merge: true });
        } catch (cacheErr: any) {
          console.warn('[API_BOOKING] could not cache dashboardProfessionalId', cacheErr.message);
        }
        return ownerId;
      }
    } catch (queryErr: any) {
      console.warn('[API_BOOKING] users.email lookup failed', { email, message: queryErr.message });
    }
  }

  return profileDocId;
}

async function findServiceForBooking(params: {
  db: admin.firestore.Firestore;
  rawServiceId: unknown;
  professionalId: string;
  professionalData: Record<string, any>;
  requestBody: Record<string, any>;
}): Promise<ServiceMatch | null> {
  const { db, rawServiceId, professionalId, professionalData, requestBody } = params;
  const serviceKey = normalizeId(rawServiceId);
  const requestService = requestBody.service || requestBody.selectedService || {};
  const lookupKeys = uniqueCandidates([
    serviceKey,
    requestBody.serviceId,
    requestBody.serviceName,
    requestBody.serviceTitle,
    requestBody.name,
    requestBody.title,
    requestService.id,
    requestService.serviceId,
    requestService.slug,
    requestService.code,
    requestService.name,
    requestService.title
  ]);

  console.log('[API_BOOKING] service lookup keys:', lookupKeys);

  if (serviceKey) {
    const directSnap = await db.collection('services').doc(serviceKey).get();
    if (directSnap.exists) {
      const directData = directSnap.data() || {};
      const serviceProfessionalId = normalizeId(directData.professionalId);
      if (!serviceProfessionalId || serviceProfessionalId === professionalId) {
        return { id: directSnap.id, data: directData, source: 'direct-doc' };
      }
      console.warn('[API_BOOKING] Service doc professionalId mismatch', {
        serviceId: serviceKey,
        serviceProfessionalId,
        expectedProfessionalId: professionalId
      });
    }
  }

  const servicesSnapshot = await db.collection('services').where('professionalId', '==', professionalId).get();
  console.log('[API_BOOKING] professional root services found:', servicesSnapshot.size);

  const rootServices = servicesSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const rootMatch = rootServices.find(({ id, data }) => {
    const candidates = [id, data.id, data.serviceId, data.slug, data.code, data.name, data.title];
    return candidates.some((candidate) => candidateMatches(candidate, lookupKeys));
  });

  if (rootMatch) return { ...rootMatch, source: 'root-services' };

  const embeddedServices = Array.isArray(professionalData.services) ? professionalData.services : [];
  const embeddedMatch = embeddedServices.find((service: any) => {
    const candidates = [service?.id, service?.serviceId, service?.slug, service?.code, service?.name, service?.title];
    return candidates.some((candidate) => candidateMatches(candidate, lookupKeys));
  });

  if (embeddedMatch) {
    const embeddedId = normalizeId(embeddedMatch.id || embeddedMatch.serviceId || serviceKey || embeddedMatch.name || embeddedMatch.title);
    return { id: embeddedId || serviceKey || 'embedded-service', data: { ...embeddedMatch, professionalId }, source: 'embedded-profile' };
  }

  if (rootServices.length === 1) {
    console.warn('[API_BOOKING] Using single professional service fallback', {
      requestedServiceId: serviceKey,
      fallbackServiceId: rootServices[0].id
    });
    return { ...rootServices[0], source: 'single-professional-service' };
  }

  const legacyName = requestBody.serviceName || requestBody.serviceTitle || requestService.name || requestService.title || serviceKey || 'Serviço selecionado';
  if (serviceKey || legacyName) {
    console.error('[API_BOOKING] Legacy service fallback used', { requestedServiceId: serviceKey, professionalId, legacyName });
    return {
      id: serviceKey || normalizeId(legacyName) || 'legacy-service',
      data: {
        id: serviceKey,
        name: legacyName,
        title: legacyName,
        price: requestBody.servicePrice || requestBody.price || requestService.price,
        duration: requestBody.serviceDuration || requestBody.duration || requestService.duration,
        professionalId,
        lookupStatus: 'legacy-unmatched'
      },
      source: 'legacy-unmatched'
    };
  }

  return null;
}

async function updateClientSummaryInternal(
  transaction: admin.firestore.Transaction,
  data: any,
  professionalId: string,
  isNew: boolean,
  oldData?: any,
  existingSummarySnap?: admin.firestore.DocumentSnapshot
) {
  const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = getDb().collection('client_summaries').doc(summaryId);

  if (isNew) {
    transaction.set(summaryRef, {
      professionalId,
      clientName: data.clientName,
      clientEmail: data.clientEmail || '',
      clientWhatsapp: data.clientWhatsapp || '',
      lastBookingDate: data.date,
      totalBookings: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
}

bookingRouter.post('/public/create-booking', async (req, res) => {
  const db = getDb();
  const {
    professionalId,
    date,
    time,
    serviceId,
    clientName,
    clientEmail,
    clientWhatsapp,
    client,
    locationType,
    neighborhood,
    prepInstructions,
    couponId
  } = req.body;

  const cName = clientName || client?.name;
  const cEmail = clientEmail || client?.email;
  const cWhatsapp = clientWhatsapp || client?.phone;
  const publicProfessionalId = normalizeId(professionalId);
  const safeServiceId = normalizeId(serviceId);

  console.log('[API_BOOKING] Request received', { publicProfessionalId, date, time, safeServiceId });

  if (!publicProfessionalId || !date || !time) {
    console.warn('[API_BOOKING] REJECTED: Missing fields');
    return res.status(400).json({ error: 'Dados de agendamento incompletos' });
  }

  try {
    const proRef = db.collection('users').doc(publicProfessionalId);
    const proSnap = await proRef.get();
    if (!proSnap.exists) throw new Error('Profissional não encontrado.');

    const professionalData = proSnap.data() || {};
    const dashboardProfessionalId = await resolveDashboardProfessionalId(db, publicProfessionalId, professionalData);
    console.log('[API_BOOKING] professional ids:', { publicProfessionalId, dashboardProfessionalId, profileUid: professionalData.uid || null });

    const serviceMatch = await findServiceForBooking({
      db,
      rawServiceId: safeServiceId,
      professionalId: publicProfessionalId,
      professionalData,
      requestBody: req.body || {}
    });

    console.log('[API_BOOKING] service match:', serviceMatch ? { id: serviceMatch.id, source: serviceMatch.source, name: serviceMatch.data.name || serviceMatch.data.title } : null);
    if (!serviceMatch) throw new Error('Serviço não encontrado.');

    const cleanedData = removeEmptyFields({
      professionalId: dashboardProfessionalId,
      publicProfessionalId,
      profileDocumentId: publicProfessionalId,
      date,
      time,
      serviceId: serviceMatch.id,
      serviceName: serviceMatch.data.name || serviceMatch.data.title,
      servicePrice: serviceMatch.data.price,
      serviceDuration: serviceMatch.data.duration,
      serviceLookupSource: serviceMatch.source,
      clientName: cName,
      clientEmail: cEmail,
      clientWhatsapp: cWhatsapp,
      locationType,
      neighborhood,
      prepInstructions,
      couponId
    });

    const apptRef = db.collection('appointments').doc();
    const reservationCode = generateReservationCode(date);
    const manageSlug = reservationCode.toLowerCase();

    const finalData = {
      ...cleanedData,
      id: apptRef.id,
      status: 'pending',
      reservationCode,
      manageSlug,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.runTransaction(async (transaction) => {
      const txProSnap = await transaction.get(proRef);
      if (!txProSnap.exists) throw new Error('Profissional não encontrado.');

      if (couponId) {
        const couponRef = db.collection('coupons').doc(couponId);
        const couponSnap = await transaction.get(couponRef);
        if (!couponSnap.exists) console.warn('Coupon not found:', couponId);
      }

      const clientKey = getClientKey(cWhatsapp, cEmail, cName);
      const summaryId = `${dashboardProfessionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      transaction.set(apptRef, finalData);
      transaction.set(db.collection('appointment_slugs').doc(manageSlug), {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId: dashboardProfessionalId,
        publicProfessionalId,
        profileDocumentId: publicProfessionalId,
        clientEmail: cEmail || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await updateClientSummaryInternal(transaction, finalData, dashboardProfessionalId, true, undefined, summarySnap);
    });

    console.log('[API_BOOKING] SUCCESS:', { appointmentId: apptRef.id, manageSlug, professionalId: dashboardProfessionalId });
    return res.status(200).json({ success: true, appointmentId: apptRef.id, manageSlug, reservationCode });
  } catch (err: any) {
    console.error('[API_BOOKING] ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

bookingRouter.get('/public/profile/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('[PROFILE LOOKUP USERS]', slug);

    if (!slug) return res.status(400).json({ error: 'Slug obrigatório' });

    const db = getDb();
    const slugLower = slug.toLowerCase();
    let docToReturn: any = null;
    let foundDoc: admin.firestore.DocumentSnapshot | null = null;

    let snapshot = await db.collection('users').where('slug', '==', slugLower).limit(1).get();
    if (snapshot.empty) snapshot = await db.collection('users').where('username', '==', slugLower).limit(1).get();
    if (snapshot.empty) snapshot = await db.collection('users').where('handle', '==', slugLower).limit(1).get();

    if (snapshot.empty) {
      const directDoc = await db.collection('users').doc(slug).get();
      if (directDoc.exists) foundDoc = directDoc;
    } else {
      foundDoc = snapshot.docs[0];
    }

    if (!foundDoc) {
      console.log('[PROFILE LOOKUP]', { slug, found: false });
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const data = foundDoc.data() || {};
    docToReturn = { id: foundDoc.id, ...data };

    if (!data.slug) {
      const generatedSlug = slugLower;
      console.log('[SLUG AUTO-CREATED]', generatedSlug);
      try {
        await foundDoc.ref.update({ slug: generatedSlug });
        docToReturn.slug = generatedSlug;
      } catch (upErr: any) {
        console.error('[PROFILE MIGRATION ERROR]', upErr.message);
      }
    }

    const safeProfessionalId = normalizeId(foundDoc.id);
    const servicesSnapshot = await db.collection('services').where('professionalId', '==', safeProfessionalId).get();
    const services = servicesSnapshot.docs.map(s => {
      const sData = s.data();
      return { id: s.id, ...sData, professionalId: normalizeId(sData.professionalId) };
    });

    if (services.length === 0) console.error(`[CRITICAL] No services found for professionalId: ${safeProfessionalId} (slug: ${slug})`);
    console.log('[PROFILE LOOKUP]', { slug, found: true, id: foundDoc.id, servicesCount: services.length });

    return res.json({
      ...docToReturn,
      id: safeProfessionalId,
      name: docToReturn.name || docToReturn.displayName || 'Profissional',
      services: services.length > 0 ? services : (docToReturn.services || [])
    });
  } catch (err) {
    console.error('[PROFILE_BY_SLUG_ERROR]', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
});
