import express from 'express';
import { getDb } from '../firebaseAdmin.js';
import admin from 'firebase-admin';
import { removeEmptyFields, generateReservationCode, getClientKey } from '../utils.js';

export const bookingRouter = express.Router();


bookingRouter.get("/public/booking-health", (req, res) => {
  return res.json({ status: "ok", time: new Date().toISOString() });
});

async function updateClientSummaryInternal(transaction: admin.firestore.Transaction, data: any, professionalId: string, isNew: boolean, oldData?: any, existingSummarySnap?: admin.firestore.DocumentSnapshot) {
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

function firstNonEmpty(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeCreateBookingPayload(rawBody: any) {
  const body = rawBody || {};
  const client = body.client || body.customer || {};
  const service = body.service || body.selectedService || {};
  const professional = body.professional || body.profile || body.pro || {};

  return {
    ...body,
    professionalId: firstNonEmpty(
      body.professionalId,
      body.professionalUid,
      body.providerId,
      body.userId,
      body.profileId,
      professional.id,
      professional.uid
    ),
    date: firstNonEmpty(body.date, body.selectedDate, body.appointmentDate, body.bookingDate),
    time: firstNonEmpty(body.time, body.selectedTime, body.appointmentTime, body.slot, body.hour),
    serviceId: firstNonEmpty(body.serviceId, body.selectedServiceId, service.id, service.serviceId),
    clientName: firstNonEmpty(body.clientName, body.name, client.name, client.clientName),
    clientEmail: firstNonEmpty(body.clientEmail, body.email, client.email, client.clientEmail),
    clientWhatsapp: firstNonEmpty(
      body.clientWhatsapp,
      body.clientPhone,
      body.whatsapp,
      body.phone,
      client.whatsapp,
      client.phone,
      client.clientWhatsapp,
      client.clientPhone
    ),
    locationType: firstNonEmpty(body.locationType, body.attendanceLocation, body.location?.type, body.location),
    neighborhood: firstNonEmpty(body.neighborhood, body.location?.neighborhood, client.neighborhood),
    prepInstructions: firstNonEmpty(body.prepInstructions, body.notes, body.observations),
    couponId: firstNonEmpty(body.couponId, body.coupon?.id)
  };
}

bookingRouter.post("/public/create-booking", async (req, res) => {
  const db = getDb();
  const normalizedBody = normalizeCreateBookingPayload(req.body);
  
  const {
    professionalId,
    date,
    time,
    serviceId,
    clientName,
    clientEmail,
    clientWhatsapp,
    locationType,
    neighborhood,
    prepInstructions,
    couponId
  } = normalizedBody;

  console.log(`[API_BOOKING] Request received`, {
    professionalId,
    serviceId,
    date,
    time,
    hasClientName: Boolean(clientName),
    hasClientWhatsapp: Boolean(clientWhatsapp),
    bodyKeys: Object.keys(req.body || {})
  });

  const missingFields = [
    ['professionalId', professionalId],
    ['serviceId', serviceId],
    ['date', date],
    ['time', time],
    ['clientName', clientName],
    ['clientWhatsapp', clientWhatsapp]
  ].filter(([, value]) => !value).map(([key]) => key);
  
  if (missingFields.length > 0) {
    console.warn(`[API_BOOKING] REJECTED: Missing fields`, missingFields, 'bodyKeys:', Object.keys(req.body || {}));
    return res.status(400).json({
      error: "Dados de agendamento incompletos",
      missingFields
    });
  }

  try {
    const cleanedData = removeEmptyFields({
      professionalId,
      date,
      time,
      serviceId,
      clientName,
      clientEmail,
      clientWhatsapp,
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
      const proRef = db.collection('users').doc(professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        throw new Error('Profissional não encontrado.');
      }

      if (!serviceId) {
        throw new Error('ID do serviço não fornecido.');
      }
      const serviceRef = db.collection('services').doc(serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists) {
        throw new Error('Serviço não encontrado.');
      }

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
