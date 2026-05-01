import express from 'express';
import { getDb } from '../firebaseAdmin.js';
import admin from 'firebase-admin';
import { removeEmptyFields, generateReservationCode, getClientKey } from '../utils.js';

export const bookingRouter = express.Router();

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

  console.log(`[API_BOOKING] Request received for professional: ${professionalId} on ${date} at ${time}`);
  
  if (!professionalId || !date || !time) {
    console.warn(`[API_BOOKING] REJECTED: Missing fields (proId, date or time)`);
    return res.status(400).json({ error: "Dados de agendamento incompletos" });
  }

  try {
    const cleanedData = removeEmptyFields({
      professionalId,
      date,
      time,
      serviceId,
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
      // Professional Check
      const proRef = db.collection('users').doc(professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        throw new Error('Profissional não encontrado.');
      }

      // Service Check
      if (!serviceId) {
        throw new Error('ID do serviço não fornecido.');
      }
      const serviceRef = db.collection('services').doc(serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists) {
        throw new Error('Serviço não encontrado.');
      }

      // Coupon (if any)
      if (couponId) {
        const couponRef = db.collection('coupons').doc(couponId);
        const couponSnap = await transaction.get(couponRef);
        if (!couponSnap.exists) {
           console.warn("Coupon not found:", couponId);
        }
      }

      const clientKey = getClientKey(clientWhatsapp, clientEmail, clientName);
      const summaryId = `${professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      transaction.set(apptRef, finalData);

      // Slug tracking
      const slugRef = db.collection('appointment_slugs').doc(manageSlug);
      transaction.set(slugRef, {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId: professionalId,
        clientEmail: clientEmail || '',
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

    if (!slug) {
      return res.status(400).json({ error: "Slug obrigatório" });
    }

    const db = getDb();
    
    // Attempting 'professionals' first as requested, but we should be careful if 'users' was the standard
    // However, the user provided this specific code.
    let snapshot = await db
      .collection("professionals")
      .where("slug", "==", slug.toLowerCase())
      .limit(1)
      .get();

    // Fallback to 'users' if 'professionals' is empty (safety measure)
    if (snapshot.empty) {
      snapshot = await db
        .collection("users")
        .where("slug", "==", slug.toLowerCase())
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      return res.status(404).json({ error: "Profissional não encontrado" });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return res.json({
      id: doc.id,
      slug: data.slug,
      name: data.name || data.displayName || 'Profissional',
      services: data.services || [],
      ...data
    });

  } catch (err) {
    console.error("[PROFILE_BY_SLUG_ERROR]", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});
