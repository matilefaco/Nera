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
  return Array.from(
    new Set(
      values
        .map((value) => normalizeId(value))
        .filter(Boolean)
    )
  );
}

function candidateMatches(candidate: unknown, keys: string[]): boolean {
  const normalizedCandidateId = normalizeId(candidate);
  const normalizedCandidateText = normalizeText(candidate);

  return keys.some((key) => {
    const normalizedKeyId = normalizeId(key);
    const normalizedKeyText = normalizeText(key);

    return (
      normalizedCandidateId === normalizedKeyId ||
      normalizedCandidateText === normalizedKeyText ||
      (!!normalizedCandidateText && !!normalizedKeyText && normalizedCandidateText.includes(normalizedKeyText)) ||
      (!!normalizedCandidateText && !!normalizedKeyText && normalizedKeyText.includes(normalizedCandidateText))
    );
  });
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

      console.warn('[API_BOOKING] Service doc found, but professionalId mismatch', {
        serviceId: serviceKey,
        serviceProfessionalId,
        expectedProfessionalId: professionalId
      });
    }
  }

  const servicesSnapshot = await db
    .collection('services')
    .where('professionalId', '==', professionalId)
    .get();

  console.log('[API_BOOKING] professional root services found:', servicesSnapshot.size);

  const rootServices = servicesSnapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() || {}
  }));

  const rootMatch = rootServices.find(({ id, data }) => {
    const candidates = [
      id,
      data.id,
      data.serviceId,
      data.slug,
      data.code,
      data.name,
      data.title
    ];

    return candidates.some((candidate) => candidateMatches(candidate, lookupKeys));
  });

  if (rootMatch) {
    return { ...rootMatch, source: 'root-services' };
  }

  const embeddedServices = Array.isArray(professionalData.services) ? professionalData.services : [];

  const embeddedMatch = embeddedServices.find((service: any) => {
    const candidates = [
      service?.id,
      service?.serviceId,
      service?.slug,
      service?.code,
      service?.name,
      service?.title
    ];

    return candidates.some((candidate) => candidateMatches(candidate, lookupKeys));
  });

  if (embeddedMatch) {
    const embeddedId = normalizeId(embeddedMatch.id || embeddedMatch.serviceId || serviceKey || embeddedMatch.name || embeddedMatch.title);
    return {
      id: embeddedId || serviceKey || 'embedded-service',
      data: {
        ...embeddedMatch,
        professionalId
      },
      source: 'embedded-profile'
    };
  }

  if (rootServices.length === 1) {
    console.warn('[API_BOOKING] Using single professional service fallback', {
      requestedServiceId: serviceKey,
      fallbackServiceId: rootServices[0].id
    });
    return { ...rootServices[0], source: 'single-professional-service' };
  }

  // Last-resort compatibility for old Hosting releases that submit a legacy/non-Firestore id.
  // This keeps the client booking from failing while preserving a clear audit flag in Firestore.
  const legacyName =
    requestBody.serviceName ||
    requestBody.serviceTitle ||
    requestService.name ||
    requestService.title ||
    serviceKey ||
    'Serviço selecionado';

  if (serviceKey || legacyName) {
    console.error('[API_BOOKING] CRITICAL legacy service fallback used. Service could not be matched exactly.', {
      requestedServiceId: serviceKey,
      professionalId,
      legacyName,
      rootServices: rootServices.map((service) => ({ id: service.id, name: service.data.name || service.data.title }))
    });

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

async function updateClientSummaryInternal(transaction: admin.firestore.Transaction, data: any, professionalId: string, isNew: boolean, oldData?: any, existingSummarySnap?: admin.firestore.DocumentSnapshot) {
  // Mock logic for restoration - the user wants the structure back
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

bookingRouter.post("/public/create-booking", async (req, res) => {
  const db = getDb();
  
  const {
    professionalId,
    date,
    time,
    serviceId,
    clientName,
    clientEmail,
    clientWhatsapp,
    client, // Support nested client
    locationType,
    neighborhood,
    prepInstructions,
    couponId
  } = req.body;

  // Extract from nested if present
  const cName = clientName || client?.name;
  const cEmail = clientEmail || client?.email;
  const cWhatsapp = clientWhatsapp || client?.phone;
  const safeProfessionalId = normalizeId(professionalId);
  const safeServiceId = normalizeId(serviceId);

  console.log(`[API_BOOKING] Request received for professional: ${safeProfessionalId} on ${date} at ${time}`);
  console.log('[API_BOOKING] raw body:', JSON.stringify(req.body));
  console.log('[API_BOOKING] serviceId received:', serviceId, 'normalized:', safeServiceId);
  
  if (!safeProfessionalId || !date || !time) {
    console.warn(`[API_BOOKING] REJECTED: Missing fields (proId, date or time)`);
    return res.status(400).json({ error: "Dados de agendamento incompletos" });
  }

  try {
    const proRef = db.collection('users').doc(safeProfessionalId);
    const proSnap = await proRef.get();
    if (!proSnap.exists) {
      throw new Error('Profissional não encontrado.');
    }

    const serviceMatch = await findServiceForBooking({
      db,
      rawServiceId: safeServiceId,
      professionalId: safeProfessionalId,
      professionalData: proSnap.data() || {},
      requestBody: req.body || {}
    });

    console.log('[API_BOOKING] service match:', serviceMatch ? { id: serviceMatch.id, source: serviceMatch.source, name: serviceMatch.data.name || serviceMatch.data.title } : null);

    if (!serviceMatch) {
      throw new Error('Serviço não encontrado.');
    }

    const cleanedData = removeEmptyFields({
      professionalId: safeProfessionalId,
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
      // Re-read Professional Check inside the transaction.
      const txProSnap = await transaction.get(proRef);
      if (!txProSnap.exists) {
        throw new Error('Profissional não encontrado.');
      }

      // Coupon (if any)
      if (couponId) {
        const couponRef = db.collection('coupons').doc(couponId);
        const couponSnap = await transaction.get(couponRef);
        if (!couponSnap.exists) {
           console.warn("Coupon not found:", couponId);
        }
      }

      const clientKey = getClientKey(cWhatsapp, cEmail, cName);
      const summaryId = `${safeProfessionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      transaction.set(apptRef, finalData);

      // Slug tracking
      const slugRef = db.collection('appointment_slugs').doc(manageSlug);
      transaction.set(slugRef, {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId: safeProfessionalId,
        clientEmail: cEmail || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await updateClientSummaryInternal(transaction, finalData, safeProfessionalId, true, undefined, summarySnap);
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

// v4: robust profile lookup exclusively in USERS collection
bookingRouter.get("/public/profile/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log("[PROFILE LOOKUP USERS]", slug);

    if (!slug) {
      return res.status(400).json({ error: "Slug obrigatório" });
    }

    const db = getDb();
    const slugLower = slug.toLowerCase();
    
    let docToReturn: any = null;
    let foundDoc: admin.firestore.DocumentSnapshot | null = null;

    // 1. Try lookups in sequence (ONLY in 'users' collection)
    // A. By slug field
    let snapshot = await db.collection("users").where("slug", "==", slugLower).limit(1).get();
    
    // B. By username or handle
    if (snapshot.empty) {
      snapshot = await db.collection("users").where("username", "==", slugLower).limit(1).get();
    }
    if (snapshot.empty) {
      snapshot = await db.collection("users").where("handle", "==", slugLower).limit(1).get();
    }

    // C. Fallback: Direct Document ID
    if (snapshot.empty) {
      const directDoc = await db.collection("users").doc(slug).get();
      if (directDoc.exists) {
        foundDoc = directDoc;
      }
    } else {
      foundDoc = snapshot.docs[0];
    }

    if (!foundDoc) {
      console.log("[PROFILE LOOKUP]", { slug, found: false });
      return res.status(404).json({ error: "Profissional não encontrado" });
    }

    const data = foundDoc.data() || {};
    docToReturn = { id: foundDoc.id, ...data };

    // 2. Migration Logic: If found but missing slug, auto-generate and save
    if (!data.slug) {
      const generatedSlug = slugLower; // use slug from URL (lowercase)
      console.log("[SLUG AUTO-CREATED]", generatedSlug);
      
      try {
        await foundDoc.ref.update({ slug: generatedSlug });
        docToReturn.slug = generatedSlug;
      } catch (upErr: any) {
        console.error("[PROFILE MIGRATION ERROR]", upErr.message);
      }
    }

    // 3. Fetch services from root collection if needed
    // Normalize correct ID just in case
    const safeProfessionalId = normalizeId(foundDoc.id);

    const servicesSnapshot = await db.collection("services").where("professionalId", "==", safeProfessionalId).get();
    
    // Mapping and extra normalization on the returned objects (Task 3 compliance)
    const services = servicesSnapshot.docs.map(s => {
      const sData = s.data();
      return { 
        id: s.id, 
        ...sData,
        professionalId: normalizeId(sData.professionalId)
      };
    });

    if (services.length === 0) {
      console.error(`[CRITICAL] No services found for professionalId: ${safeProfessionalId} (slug: ${slug})`);
    }

    console.log("[PROFILE LOOKUP]", { slug, found: true, id: foundDoc.id, servicesCount: services.length });

    return res.json({
      ...docToReturn,
      id: safeProfessionalId,
      name: docToReturn.name || docToReturn.displayName || 'Profissional',
      services: services.length > 0 ? services : (docToReturn.services || [])
    });

  } catch (err) {
    console.error("[PROFILE_BY_SLUG_ERROR]", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});
