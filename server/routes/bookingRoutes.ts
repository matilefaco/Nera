import express from 'express';
import { getDb } from '../firebaseAdmin.js';
import admin from 'firebase-admin';
import { removeEmptyFields, generateReservationCode, getClientKey } from '../utils.js';

export const bookingRouter = express.Router();

type ResolvedProfessional = {
  id: string;
  collection: 'users' | 'professionals';
  data: admin.firestore.DocumentData;
};

function cleanText(value: unknown): string {
  return String(value || '').trim();
}

function cleanSlug(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function firstNonEmpty(...values: unknown[]) {
  return values.find((value) => cleanText(value) !== '');
}

async function findProfessionalByIdOrSlug(identifier: unknown): Promise<ResolvedProfessional | null> {
  const db = getDb();
  const raw = cleanText(identifier);
  const slug = cleanSlug(identifier);
  if (!raw) return null;

  const collections: Array<'users' | 'professionals'> = ['users', 'professionals'];

  for (const collection of collections) {
    const doc = await db.collection(collection).doc(raw).get();
    if (doc.exists) {
      return { id: doc.id, collection, data: doc.data() || {} };
    }
  }

  const slugFields = ['slug', 'publicSlug', 'profileSlug', 'username', 'handle'];
  for (const collection of collections) {
    for (const field of slugFields) {
      const snap = await db.collection(collection).where(field, '==', slug).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { id: doc.id, collection, data: doc.data() || {} };
      }
    }
  }

  const slugDocCollections = ['slugs', 'profile_slugs', 'public_slugs'];
  for (const collection of slugDocCollections) {
    const slugDoc = await db.collection(collection).doc(slug).get();
    if (!slugDoc.exists) continue;

    const data = slugDoc.data() || {};
    const referencedId = cleanText(data.uid || data.userId || data.professionalId || data.profileId || data.ownerId);
    if (!referencedId) continue;

    for (const targetCollection of collections) {
      const proDoc = await db.collection(targetCollection).doc(referencedId).get();
      if (proDoc.exists) {
        return { id: proDoc.id, collection: targetCollection, data: proDoc.data() || {} };
      }
    }
  }

  return null;
}

function getServiceFromProfessional(proData: admin.firestore.DocumentData, serviceId: unknown) {
  const id = cleanText(serviceId);
  if (!id) return null;

  const serviceArrays = [proData.services, proData.catalogServices, proData.serviceList].filter(Array.isArray) as any[][];
  for (const services of serviceArrays) {
    const found = services.find((service) => {
      if (!service) return false;
      return cleanText(service.id) === id || cleanText(service.serviceId) === id || cleanText(service.name) === id || cleanText(service.title) === id;
    });
    if (found) return found;
  }

  return null;
}

async function updateClientSummaryInternal(transaction: admin.firestore.Transaction, data: any, professionalId: string, isNew: boolean, oldData?: any, existingSummarySnap?: admin.firestore.DocumentSnapshot) {
  const clientKey = getClientKey(
    cleanText(data.clientWhatsapp),
    cleanText(data.clientEmail),
    cleanText(data.clientName)
  );
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

bookingRouter.post("/public/create-booking", async (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const client = body.client || body.customer || {};
  const service = body.service || body.selectedService || {};

  const rawProfessionalId = firstNonEmpty(body.professionalId, body.professionalUid, body.providerId, body.userId, body.profileId, body.slug, body.professionalSlug);
  const date = firstNonEmpty(body.date, body.selectedDate, body.appointmentDate, body.bookingDate);
  const time = firstNonEmpty(body.time, body.selectedTime, body.appointmentTime, body.slot, body.hour);
  const serviceId = firstNonEmpty(body.serviceId, body.selectedServiceId, service.id, service.serviceId, service.name, service.title);
  const clientName = firstNonEmpty(body.clientName, body.name, client.name, client.clientName);
  const clientEmail = firstNonEmpty(body.clientEmail, body.email, client.email, client.clientEmail);
  const clientWhatsapp = firstNonEmpty(body.clientWhatsapp, body.clientPhone, body.whatsapp, body.phone, client.whatsapp, client.phone, client.clientWhatsapp, client.clientPhone);
  const locationType = firstNonEmpty(body.locationType, body.attendanceLocation, body.location?.type, body.location);
  const neighborhood = firstNonEmpty(body.neighborhood, body.location?.neighborhood, client.neighborhood);
  const prepInstructions = firstNonEmpty(body.prepInstructions, body.notes, body.observations);
  const couponId = firstNonEmpty(body.couponId, body.coupon?.id);

  console.log(`[API_BOOKING] Request received`, {
    rawProfessionalId,
    serviceId,
    date,
    time,
    hasClientName: Boolean(clientName),
    hasClientWhatsapp: Boolean(clientWhatsapp),
    bodyKeys: Object.keys(body)
  });
  
  const missingFields = [
    ['professionalId', rawProfessionalId],
    ['serviceId', serviceId],
    ['date', date],
    ['time', time],
    ['clientName', clientName],
    ['clientWhatsapp', clientWhatsapp]
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missingFields.length > 0) {
    console.warn(`[API_BOOKING] REJECTED: Missing fields`, missingFields);
    return res.status(400).json({ error: "Dados de agendamento incompletos", missingFields });
  }

  try {
    const resolvedProfessional = await findProfessionalByIdOrSlug(rawProfessionalId);
    if (!resolvedProfessional) {
      throw new Error('Profissional não encontrado.');
    }

    const professionalId = resolvedProfessional.id;
    const cleanClientName = cleanText(clientName);
    const cleanClientEmail = cleanText(clientEmail);
    const cleanClientWhatsapp = cleanText(clientWhatsapp);
    const cleanServiceId = cleanText(serviceId);
    const cleanDate = cleanText(date);
    const cleanTime = cleanText(time);

    const cleanedData = removeEmptyFields({
      professionalId,
      professionalSlug: cleanSlug(rawProfessionalId),
      date: cleanDate,
      time: cleanTime,
      serviceId: cleanServiceId,
      clientName: cleanClientName,
      clientEmail: cleanClientEmail,
      clientWhatsapp: cleanClientWhatsapp,
      locationType: cleanText(locationType),
      neighborhood: cleanText(neighborhood),
      prepInstructions: cleanText(prepInstructions),
      couponId: cleanText(couponId)
    });
    
    const apptRef = db.collection('appointments').doc();
    const reservationCode = generateReservationCode(cleanDate);
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
      const proRef = db.collection(resolvedProfessional.collection).doc(professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        throw new Error('Profissional não encontrado.');
      }

      if (!cleanServiceId) {
        throw new Error('ID do serviço não fornecido.');
      }

      const serviceRef = db.collection('services').doc(cleanServiceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists && !getServiceFromProfessional(proSnap.data() || {}, cleanServiceId)) {
        throw new Error('Serviço não encontrado.');
      }

      if (couponId) {
        const couponRef = db.collection('coupons').doc(cleanText(couponId));
        const couponSnap = await transaction.get(couponRef);
        if (!couponSnap.exists) {
           console.warn("Coupon not found:", couponId);
        }
      }

      const clientKey = getClientKey(cleanClientWhatsapp, cleanClientEmail, cleanClientName);
      const summaryId = `${professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      transaction.set(apptRef, finalData);

      const slugRef = db.collection('appointment_slugs').doc(manageSlug);
      transaction.set(slugRef, {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId,
        clientEmail: cleanClientEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await updateClientSummaryInternal(transaction, finalData, professionalId, true, undefined, summarySnap);
    });

    console.log(`[API_BOOKING] SUCCESS: Appt ${apptRef.id}, Slug ${manageSlug}`);
    return res.status(200).json({ 
      success: true, 
      appointmentId: apptRef.id,
      manageSlug,
      reservationCode
    });

  } catch (err: any) {
    console.error(`[API_BOOKING] ERROR:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

bookingRouter.get("/public/profile/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log("[PROFILE ROUTE HIT]", slug);

    const resolvedProfessional = await findProfessionalByIdOrSlug(slug);

    if (!resolvedProfessional) {
      return res.status(404).json({ error: "Profissional não encontrado" });
    }

    const data = resolvedProfessional.data;

    return res.json({
      ...data,
      id: resolvedProfessional.id,
      collection: resolvedProfessional.collection,
      slug: data.slug || data.publicSlug || data.profileSlug || cleanSlug(slug),
      name: data.name || data.displayName || data.businessName || 'Profissional',
      services: data.services || data.catalogServices || data.serviceList || []
    });

  } catch (err) {
    console.error("[PROFILE_BY_SLUG_ERROR]", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});
