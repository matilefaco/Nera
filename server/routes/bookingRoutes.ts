import { bookingRateLimiter } from "../middleware/rateLimiter.js";
import express from "express";
import { randomBytes } from "crypto";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { logger, maskEmail, maskPhone, maskToken, maskUid } from "../utils/logger.js";
import { sendBookingConfirmedEmail } from "../emails/sendEmail.js";
import { createGoogleCalendarEvent } from "./calendarRoutes.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { isRevenueStatus, isCancelledStatus, isPendingStatus, isActiveSlotStatus } from "../constants/appointmentStatus.js";
import { sendBookingPendingClientNotification, sendNewBookingRequestNotification } from "../services/notificationService.js";

const router = express.Router();

const debugOnly = (req: any, res: any, next: any) => {
  const isProdEnv = process.env.NODE_ENV === "production";
  const isFirebaseProd = process.env.GCLOUD_PROJECT && process.env.FUNCTIONS_EMULATOR !== "true";
  
  // Try to block if we know for sure it's production
  if (isProdEnv || (isFirebaseProd && !process.env.NODE_ENV)) {
    return res.status(404).send("Not Found");
  }
  
  // Check the hostname as a fallback for SSR / Express
  if (req.hostname && req.hostname.includes("usenera.com")) {
    return res.status(404).send("Not Found");
  }
  
  return next();
};

// --- HELPER FUNCTIONS FOR BACKEND BOOKING ---
const normalizeId = (id: any): string => {
  return String(id || "").trim().replace(/^"+|"+$/g, "");
};

const getClientKey = (phone?: string, email?: string, name?: string): string => {
  const cleanPhone = phone?.replace(/\D/g, '') || '';
  if (cleanPhone && cleanPhone.length >= 8) return cleanPhone;
  if (email) return email.toLowerCase().trim();
  return `name-${(name || 'anon').toLowerCase().replace(/\s+/g, '-')}`;
};


// Tokens públicos de acesso precisam ser criptograficamente seguros. Não usar Math.random.
function generateSecureToken(bytes: number = 16): string {
  return randomBytes(bytes).toString("hex");
}

const generateRandomSuffix = (length: number = 4) => {
  return generateSecureToken(Math.ceil(length / 2)).substring(0, length).toUpperCase();
};

const generateReservationCode = (date: string) => {
  const formattedDate = (date || '').replace(/-/g, '');
  return `NR-${formattedDate}-${generateRandomSuffix()}`;
};

const removeEmptyFields = (obj: any): any => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const intervalsOverlap = (startA: number, endA: number, startB: number, endB: number): boolean => {
  return Math.max(startA, startB) < Math.min(endA, endB);
};

function getBookingLockId(appointment: any): string | null {
  const dateAttr = appointment.date || appointment.appointmentDate || appointment.selectedDate || appointment.scheduledDate;
  const timeAttr = appointment.time || appointment.appointmentTime || appointment.selectedTime || appointment.startTime;
  if (!appointment?.professionalId || !dateAttr || !timeAttr) return null;
  const cleanTime = String(timeAttr).replace(":", "");
  return appointment.professionalId + "_" + dateAttr + "_" + cleanTime;
}

const sanitizeAppointment = (data: any, isUpdate = false): any => {
  const sanitized = { ...data };

  if (!isUpdate || sanitized.clientName !== undefined) {
    sanitized.clientName = typeof sanitized.clientName === 'string' && sanitized.clientName.trim() !== '' 
      ? sanitized.clientName.trim() 
      : 'Cliente';
  }

  if (!isUpdate || sanitized.price !== undefined) {
    sanitized.price = Number(sanitized.price) || 0;
  }

  if (!isUpdate || sanitized.status !== undefined) {
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'cancelled_by_professional', 'cancelled_by_client', 'declined', 'accepted', 'pending_conflict'];
    if (!validStatuses.includes(sanitized.status)) {
      sanitized.status = 'pending';
    }
  }

  if (!isUpdate && !sanitized.professionalId) {
    throw new Error('professionalId é obrigatório');
  }

  if (!isUpdate && !sanitized.createdAt) {
    sanitized.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });

  return sanitized;
};

async function updateClientSummaryInternal(transaction: admin.firestore.Transaction, appointment: any, professionalId: string, isNew: boolean, oldStatus?: string, preFetchedSnap?: admin.firestore.DocumentSnapshot) {
  const db = getDb();
  const clientKey = getClientKey(appointment.clientWhatsapp, appointment.clientEmail, appointment.clientName);
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = db.collection('client_summaries').doc(summaryId);
  
  const summarySnap = preFetchedSnap || await transaction.get(summaryRef);
  let summary = summarySnap.exists ? summarySnap.data() as any : {
    professionalId,
    clientKey,
    clientName: appointment.clientName || 'Cliente',
    clientPhone: appointment.clientWhatsapp || '',
    clientEmail: appointment.clientEmail || '',
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    noShowCount: 0,
    totalSpent: 0,
    lastAppointmentDate: appointment.date || '',
    lastServiceName: appointment.serviceName || '',
    firstAppointmentDate: appointment.date || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const status = appointment.status;
  const price = (Number(appointment.price) || 0) + (Number(appointment.travelFee) || 0);

  if (isNew) {
    summary.totalAppointments += 1;
    if (!summary.firstAppointmentDate || new Date(appointment.date) < new Date(summary.firstAppointmentDate)) {
      summary.firstAppointmentDate = appointment.date;
    }
  }

  const wasConfirmed = isRevenueStatus(oldStatus);
  const isNowConfirmed = isRevenueStatus(status);

  if (isNowConfirmed && !wasConfirmed) {
    summary.confirmedAppointments += 1;
    summary.totalSpent += price;
  } else if (!isNowConfirmed && wasConfirmed) {
    summary.confirmedAppointments = Math.max(0, summary.confirmedAppointments - 1);
    summary.totalSpent = Math.max(0, summary.totalSpent - price);
  }

  if (isCancelledStatus(status)) {
    if (!isCancelledStatus(oldStatus)) {
      summary.cancelledAppointments += 1;
    }
  }

  if (appointment.noShow) {
    summary.noShowCount += 1;
  }

  if (!summary.lastAppointmentDate || new Date(appointment.date || '') >= new Date(summary.lastAppointmentDate)) {
    summary.lastAppointmentDate = appointment.date || '';
    summary.lastServiceName = appointment.serviceName || '';
    summary.clientName = appointment.clientName || summary.clientName || 'Cliente';
    summary.clientPhone = appointment.clientWhatsapp || summary.clientPhone || '';
    summary.clientEmail = appointment.clientEmail || summary.clientEmail || '';
  }

  summary.updatedAt = new Date().toISOString();
  transaction.set(summaryRef, summary, { merge: true });
}

// --- SECURE PUBLIC BOOKING ENDPOINT ---
router.get("/public/booking-health", (req, res) => {
  res.json({ 
    ok: true, 
    time: new Date().toISOString(),
    route: "booking"
  });
});

router.post("/public/create-booking", bookingRateLimiter, async (req, res) => {
  const db = getDb();
  const appointmentData = req.body;
  
  logger.info("BOOKING", "Booking payload received", {
   requestId: req.requestId,
   professionalId: maskUid(appointmentData.professionalId),
   meta: {
    hasClientName: Boolean(appointmentData.clientName),
    clientPhone: maskPhone(appointmentData.clientWhatsapp || appointmentData.clientPhone),
    clientEmail: maskEmail(appointmentData.clientEmail),
    serviceId: appointmentData.serviceId,
    date: appointmentData.date,
    time: appointmentData.time,
    status: appointmentData.status
   }
  });
  
  if (!appointmentData.professionalId || !appointmentData.date || !appointmentData.time) {
    logger.warn("BOOKING", "Rejected missing fields", { meta: { hasName: Boolean(appointmentData?.clientName) } });
    return res.status(400).json({ error: "Dados de agendamento incompletos (professionalId, date ou time ausentes)" });
  }

  try {
    // Plan Limit Check for Free Plan
    const professionalId = appointmentData.professionalId;
    const proDoc = await db.collection('users').doc(professionalId).get();
    if (!proDoc.exists) {
      logger.error("BOOKING", `Professional not found for limit check: ${professionalId}`);
      return res.status(404).json({ error: `Profissional não encontrado (${professionalId}).` });
    }
    
    const proUser = proDoc.data();
    const plan = proUser?.plan || 'free';

    if (plan === 'free') {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const startOfMonth = `${currentYear}-${currentMonth}-01`;
      // Calcula o último dia real do mês atual para evitar bug em meses com menos de 31 dias
      const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split('T')[0];

      const snapshot = await db.collection('appointments')
        .where('professionalId', '==', professionalId)
        .where('date', '>=', startOfMonth)
        .where('date', '<=', endOfMonth)
        .get();
        
      const countingStatuses = ['pending', 'pending_confirmation', 'pending_conflict', 'confirmed', 'accepted', 'completed', 'concluido'];
      
      let bookingCountOfMonth = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (countingStatuses.includes(data.status)) {
          bookingCountOfMonth++;
        }
      });
      
      if (bookingCountOfMonth >= 15) {
        logger.warn("BOOKING", `Booking limit reached for free plan`, { professionalId: maskUid(professionalId), meta: { currentCount: bookingCountOfMonth } });
        return res.status(403).json({
          error: "Esta profissional atingiu o limite de agendamentos do mês. Entre em contato com ela para agendar.",
          code: "BOOKING_LIMIT_REACHED"
        });
      }
    }

    const cleanedData = removeEmptyFields(appointmentData);
    const apptRef = db.collection('appointments').doc();
    const reservationCode = generateReservationCode(appointmentData.date);
    const manageSlug = generateSecureToken(24);

    const finalData: any = {
      ...cleanedData,
      status: 'pending',
      token: manageSlug,
      publicToken: manageSlug,
      manageToken: manageSlug,
      reservationCode,
      manageSlug,
      clientWhatsapp: appointmentData.clientWhatsapp || appointmentData.clientPhone || '',
      clientPhone: appointmentData.clientWhatsapp || appointmentData.clientPhone || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    logger.info("BOOKING", "Transaction starting");

    await db.runTransaction(async (transaction) => {
      // Professional Check
      const proRef = db.collection('users').doc(appointmentData.professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        logger.error("BOOKING", `Professional not found: ${appointmentData.professionalId}`);
        throw new Error(`Profissional não encontrado (${appointmentData.professionalId}). Verifique se o perfil existe.`);
      }

      // Service Check & Official Price
      if (!appointmentData.serviceId) {
        logger.error("BOOKING", `Missing serviceId`);
        throw new Error('ID do serviço não fornecido.');
      }
      const serviceRef = db.collection('services').doc(appointmentData.serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists) {
        logger.error("BOOKING", `Service not found: ${appointmentData.serviceId}`);
        throw new Error(`Serviço não encontrado (${appointmentData.serviceId}). Verifique se o serviço ainda existe.`);
      }
      const service = serviceSnap.data() as any;

      // Ownership check (Critical for data integrity after migration)
      if (normalizeId(service.professionalId) !== normalizeId(appointmentData.professionalId)) {
        logger.warn("BOOKING", `ID MISMATCH: Service ${appointmentData.serviceId} belongs to ${service.professionalId}, but booking requested for ${appointmentData.professionalId}.`);
        // If they are different, we should probably follow the service's owner to avoid orphan appointments

        // but for now we just log and use the service's proId as the source of truth if needed
      }

      // Force official price and duration from service
      finalData.price = Number(service.price) || 0;
      finalData.duration = Number(service.duration) || 60;
      finalData.serviceName = service.name;
      finalData.professionalId = service.professionalId; // Force owner from service

      // Coupon (if any)
      let couponSnap = null;
      let couponRef = null;
      if (appointmentData.couponId) {
        couponRef = db.collection('coupons').doc(appointmentData.couponId);
        couponSnap = await transaction.get(couponRef);
      }

      // Check Booking Lock (Must be before writes)
      const lockId = getBookingLockId(finalData);
      let lockRef: admin.firestore.DocumentReference | null = null;
      let lockSnap: admin.firestore.DocumentSnapshot | null = null;
      if (lockId) {
        lockRef = db.collection('booking_locks').doc(lockId);
        lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists) {
          const lockData = lockSnap.data();
          const isPending = lockData?.status === 'pending' || lockData?.status === 'pending_confirmation' || lockData?.status === 'pending_conflict';
          const isExpired = isPending && lockData?.expiresAt && lockData.expiresAt.toMillis() <= Date.now();
          if (!isExpired) {
            throw new Error('SLOT_LOCKED:Este horário acabou de ser reservado. Escolha outro horário.');
          }
        }
      }

      // Check for duration overlap with other appointments
      const existingApptsSnap = await transaction.get(
        db.collection('appointments')
          .where('professionalId', '==', finalData.professionalId)
          .where('date', '==', finalData.date)
      );

      const overlapBlockingStatuses = ['pending', 'pending_confirmation', 'pending_conflict', 'confirmed', 'accepted', 'completed', 'concluido'];
      const newStart = timeToMinutes(finalData.time);
      const newEnd = newStart + finalData.duration;

      for (const doc of existingApptsSnap.docs) {
        const existing = doc.data();
        if (overlapBlockingStatuses.includes(existing.status)) {
          const isPending = existing.status === 'pending' || existing.status === 'pending_confirmation' || existing.status === 'pending_conflict';
          if (isPending) {
            const existingLockId = getBookingLockId(existing);
            if (existingLockId) {
              const existingLockSnap = (existingLockId === lockId && lockSnap) ? lockSnap : await transaction.get(db.collection('booking_locks').doc(existingLockId));
              if (existingLockSnap.exists) {
                const existingLockData = existingLockSnap.data();
                const isExpired = existingLockData && existingLockData.expiresAt && existingLockData.expiresAt.toMillis() <= Date.now();
                if (isExpired) {
                  continue; // Ignorar o appointment pending cujo lock expirou
                }
              } else {
                continue; // Se não tem lock, não deveria estar bloqueando
              }
            }
          }

          const existingStart = timeToMinutes(existing.time);
          const existingDuration = Number(existing.duration || existing.serviceDuration || 60);
          const existingEnd = existingStart + existingDuration;

          if (intervalsOverlap(newStart, newEnd, existingStart, existingEnd)) {
            logger.warn("BOOKING", "Durational overlap detected in create-booking", {
              professionalId: maskUid(finalData.professionalId),
              meta: {
                date: finalData.date,
                time: finalData.time,
                newDuration: finalData.duration,
                existingTime: existing.time,
                existingDuration
              }
            });
            throw new Error('SLOT_LOCKED:Este horário acabou de ficar indisponível. Escolha outro horário.');
          }
        }
      }

      // Read Client Summary
      const clientKey = getClientKey(appointmentData.clientWhatsapp, appointmentData.clientEmail, appointmentData.clientName);
      const summaryId = `${appointmentData.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // 2. LOGIC & WRITES
      if (couponSnap && couponSnap.exists) {
        const coupon = couponSnap.data() as any;
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new Error('Este cupom atingiu o limite de usos.');
        }
        transaction.update(couponRef!, {
          usedCount: admin.firestore.FieldValue.increment(1)
        });
      }

      // Create Booking Lock
      if (lockRef) {
        transaction.set(lockRef, {
          professionalId: finalData.professionalId,
          date: finalData.date,
          time: finalData.time,
          appointmentId: apptRef.id,
          serviceId: finalData.serviceId || 'unknown',
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000)
        });
      }

      // Sanitize before inserting to enforce schemas
      const safeData = sanitizeAppointment(finalData, false);
      
      // Create Appointment
      transaction.set(apptRef, safeData);

      // Create reservation_links
      const linkRef = db.collection('reservation_links').doc(manageSlug);
      transaction.set(linkRef, {
        appointmentId: apptRef.id,
        manageSlug,
        reservationCode,
        professionalId: appointmentData.professionalId,
        clientEmail: appointmentData.clientEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Client Summary
      await updateClientSummaryInternal(transaction, safeData, appointmentData.professionalId, true, undefined, summarySnap);
    });

    logger.info("BOOKING", `SUCCESS: Committed Appt ${apptRef.id}`);

    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    
    // Background task: Send notifications safely without failing the booking
    (async () => {
      try {
        const proDoc = await db.collection('users').doc(appointmentData.professionalId).get();
        const proData = proDoc.exists ? proDoc.data() : null;
        
        let paymentMethodsArr: string[] = Array.isArray(appointmentData.paymentMethods) 
                                ? appointmentData.paymentMethods 
                                : (appointmentData.paymentMethods ? [String(appointmentData.paymentMethods)] : []);
                                
        // Need to determine location conditionally if service was home service
        const isHomeService = finalData.locationType === 'home' || finalData.locationType === 'domicilio';
        let locationDetail = 'No Estúdio';
        if (isHomeService) {
           locationDetail = `${finalData.neighborhood || 'Bairro omitido'}, ${proData?.city || 'Cidade omitida'}`;
        }

        await sendBookingPendingClientNotification({
          clientEmail: appointmentData.clientEmail,
          clientName: appointmentData.clientName,
          professionalName: proData?.name || 'Profissional',
          professionalWhatsapp: proData?.whatsapp || '',
          serviceName: finalData.serviceName,
          date: finalData.date,
          time: finalData.time,
          price: `R$ ${(finalData.price || 0).toFixed(2).replace('.', ',')}`,
          reservationCode,
          manageUrl: `${baseUrl}/r/${manageSlug}`,
          appointmentId: apptRef.id,
          paymentMethods: paymentMethodsArr,
        }, baseUrl);

        await sendNewBookingRequestNotification({
          professionalId: appointmentData.professionalId,
          clientName: appointmentData.clientName,
          serviceName: finalData.serviceName,
          date: finalData.date,
          time: finalData.time,
          totalPrice: finalData.price,
          price: finalData.price,
          appointmentId: apptRef.id,
          token: manageSlug,
          paymentMethods: paymentMethodsArr,
          locationDetail: locationDetail,
          clientWhatsapp: appointmentData.clientWhatsapp || appointmentData.clientPhone || '',
          clientEmail: appointmentData.clientEmail,
        }, baseUrl);
      } catch (err: any) {
        logger.error("NOTIFICATION", "Failed to send post-booking notifications", {
          appointmentId: apptRef.id,
          error: err.message
        });
      }
    })();

    res.json({
      success: true,
      bookingId: apptRef.id,
      token: manageSlug,
      reservationCode
    });

  } catch (err: any) {
    if (err.message && err.message.includes('SLOT_LOCKED:')) {
      return res.status(409).json({ error: err.message.replace('SLOT_LOCKED:', '') });
    }
    logger.error("BOOKING", "BOOKING ERROR", {
      requestId: req.requestId,
      error: err
    });
    res.status(500).json({ 
      error: err.message,
      code: err.code || null
    });
  }
});

// --- NEW: PUBLIC ENDPOINT TO SUBMIT REVIEW ---
router.post("/public/reviews/:token/submit", async (req, res) => {
  const db = getDb();
  const { token } = req.params;
  const { 
    rating, 
    tags, 
    comment, 
    publicDisplayMode, 
    firstName, 
    neighborhood,
    serviceId,
    serviceName
  } = req.body;

  if (!token || !rating) {
    return res.status(400).json({ error: "Token e rating são obrigatórios." });
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Find review request
      const q = db.collection('review_requests').where('token', '==', token).limit(1);
      const requestSnaps = await transaction.get(q);
      
      if (requestSnaps.empty) {
        throw new Error('Solicitação de avaliação não encontrada ou inválida.');
      }
      
      const requestDoc = requestSnaps.docs[0];
      const requestData = requestDoc.data();
      
      if (requestData.status === 'submitted') {
        throw new Error('Esta avaliação já foi enviada.');
      }
      if (requestData.status === 'expired') {
        throw new Error('Este link de avaliação expirou.');
      }

      const professionalId = requestData.professionalId;
      const reviewRef = db.collection('reviews').doc();
      const statsRef = db.collection('review_stats').doc(professionalId);
      
      // READS MUST BE BEFORE WRITES
      const statsDoc = await transaction.get(statsRef);
      const apptRef = db.collection('appointments').doc(requestData.bookingId);
      const apptDoc = await transaction.get(apptRef);
      const profRef = db.collection('users').doc(professionalId);
      const profDoc = await transaction.get(profRef);
      
      let locationLabel = '';
      if (profDoc.exists && apptDoc.exists) {
        const prof = profDoc.data()!;
        const appt = apptDoc.data()!;
        
        const locType = appt.locationType;
        if (locType === 'home' || locType === 'domicilio') {
           const apptNeigh = appt.neighborhood || neighborhood || '';
           const city = prof.city || '';
           if (apptNeigh && city) locationLabel = `${apptNeigh}, ${city}`;
           else if (city) locationLabel = city;
        } else {
           // studio
           const profNeigh = prof.neighborhood || '';
           const city = prof.city || '';
           if (profNeigh && city) locationLabel = `${profNeigh}, ${city}`;
           else if (city) locationLabel = city;
        }
      }

      // 2. Create the review
      transaction.set(reviewRef, {
        bookingId: requestData.bookingId,
        professionalId: professionalId,
        serviceId: serviceId || '',
        serviceName: serviceName || '',
        rating: Number(rating),
        tags: tags || [],
        comment: comment ? String(comment).trim() : '',
        publicDisplayMode: publicDisplayMode || 'named',
        publicApproved: true,
        firstName: firstName || 'Cliente',
        neighborhood: neighborhood || '',
        locationLabel: locationLabel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Complete the request
      transaction.update(requestDoc.ref, {
        status: 'submitted',
        submittedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Update the review stats
      let newAverageRating = Number(rating);
      let newTotalReviews = 1;
      let newTopTags = tags ? tags.slice(0, 5) : [];
      
      if (statsDoc.exists) {
        const currentStats = statsDoc.data()!;
        newTotalReviews = (currentStats.totalReviews || 0) + 1;
        newAverageRating = ((currentStats.averageRating || 0) * (currentStats.totalReviews || 0) + rating) / newTotalReviews;
        
        const updatedTags = [...(currentStats.topTags || [])];
        if (tags) {
          tags.forEach((tag: string) => {
            if (!updatedTags.includes(tag)) updatedTags.push(tag);
          });
        }
        newTopTags = updatedTags.slice(0, 5);

        transaction.update(statsRef, {
          averageRating: Number(newAverageRating.toFixed(1)),
          totalReviews: newTotalReviews,
          topTags: newTopTags,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(statsRef, {
          professionalId: professionalId,
          averageRating: rating,
          totalReviews: 1,
          totalCompletedBookings: 1,
          topTags: newTopTags,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 5. Sync simple stats to user profile
      const userRef = db.collection('users').doc(professionalId);
      transaction.update(userRef, {
        averageRating: Number(newAverageRating.toFixed(1)),
        totalReviews: newTotalReviews,
        topTags: newTopTags
      });

      return { success: true };
    });

    logger.info("REVIEW", "Review submitted successfully", { meta: { reviewToken: maskToken(token) } });
    res.json(result);
  } catch (err: any) {
    logger.error("REVIEW", "Submit review error", { error: err, meta: { reviewToken: maskToken(token) } });
    res.status(400).json({ error: err.message || "Não foi possível enviar agora. Tente novamente." });
  }
});

// --- DIAGNOSTIC ENDPOINT FOR EMAILS ---
router.get("/debug-booking-email", (req, res) => {
  return res.status(404).send("Not Found");
});

// --- NEW: DIAGNOSTIC ENDPOINT FOR CONFIRMATION FLOW ---
router.get("/debug-confirmation-email", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { appointmentId } = req.query;
    if (!appointmentId) return res.status(400).json({ error: "Missing appointmentId" });

    process.stdout.write(`[FIRESTORE READ] Attempting to read appointments/${appointmentId}... `);
    const apptDoc = await db.collection('appointments').doc(appointmentId as string).get();
    
    if (!apptDoc.exists) {
            return res.status(404).json({ error: "Appointment not found" });
    }
    
    const data = apptDoc.data();
    const result: any = {
      appointmentId,
      currentStatus: data?.status,
      clientEmail: data?.clientEmail,
      professionalId: data?.professionalId,
      token: data?.token,
      hasToken: !!data?.token,
      clientName: data?.clientName,
      shouldSendConfirmationEmail: (data?.status === 'confirmed' || data?.status === 'accepted') && !!data?.clientEmail,
      reason: ""
    };

    if (data?.status !== 'confirmed' && data?.status !== 'accepted') result.reason = `Status is '${data?.status}', not 'confirmed'. `;
    if (!data?.clientEmail) result.reason += "Missing clientEmail. ";
    if (!data?.token) result.reason += "Missing token. ";
    
    if (data?.professionalId) {
      process.stdout.write(`[FIRESTORE READ] Attempting to read users/${data.professionalId}... `);
      const proDoc = await db.collection('users').doc(data.professionalId).get();
      if (proDoc.exists) {
                result.professionalEmail = proDoc.data()?.email;
      } else {
              }
    }

    res.json(result);
  } catch (err: any) {
    logger.error("FIRESTORE", "Query error", { error: err });
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// --- NEW: EXECUTION ENDPOINT FOR CONFIRMATION EMAIL ---
router.get("/run-confirmation-email", debugOnly, async (req, res) => {
  const db = getDb();
  const { appointmentId, token: queryToken } = req.query;
  const response: any = {
    receivedAppointmentId: appointmentId || null,
    receivedToken: queryToken || null,
    firestoreDocFound: false,
    realDocumentId: null,
    validationPassed: false,
    sendAttempted: false,
    resendSuccess: false,
    payloadUsed: null,
    token: null,
    bookingId: null,
    publicId: null
  };

  try {
    if (!appointmentId && !queryToken) throw new Error("Missing appointmentId or token");

    let apptDoc: any = null;
    let apptRef: any = null;

    if (appointmentId) {
      apptRef = db.collection('appointments').doc(appointmentId as string);
      const apptSnap = await apptRef.get();
      if (apptSnap.exists) {
        apptDoc = apptSnap.data();
        response.firestoreDocFound = true;
        response.realDocumentId = apptSnap.id;
      }
    }

    // Fallback: Search by token if not found by ID or if ID looks like a token
    if (!apptDoc && (queryToken || appointmentId)) {
      const tokenToSearch = queryToken || appointmentId;
      const qToken = await db.collection('appointments').where('token', '==', tokenToSearch).limit(1).get();
      if (!qToken.empty) {
        apptRef = qToken.docs[0].ref;
        apptDoc = qToken.docs[0].data();
        response.firestoreDocFound = true;
        response.realDocumentId = qToken.docs[0].id;
        process.stdout.write(`[DEBUG RUN] Found appointment by token: ${qToken.docs[0].id}\n`);
      }
    }

    if (!apptDoc) {
      response.reason = "Appointment not found by ID or Token";
      return res.status(404).json(response);
    }

    response.token = apptDoc.token || "MISSING";
    response.bookingId = response.realDocumentId;
    response.clientEmail = apptDoc.clientEmail || "MISSING";
    response.createdAt = apptDoc.createdAt ? (apptDoc.createdAt.toDate ? apptDoc.createdAt.toDate().toISOString() : apptDoc.createdAt) : "MISSING";
    response.publicId = apptDoc.token ? `token_${apptDoc.token.substring(0, 5)}` : "N/A";

    const data = apptDoc;
    const proId = data?.professionalId;
    if (!proId) throw new Error("Missing professionalId in appointment");

    const proSnap = await db.collection('users').doc(proId).get();
    const pro = proSnap.exists ? proSnap.data() : null;

    const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, '') : '';
    const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;

    const payload = {
      clientName: data?.clientName,
      serviceName: data?.serviceName,
      date: data?.date,
      time: data?.time,
      location: data?.locationType === 'home' ? `Domicílio (${data?.neighborhood})` : 'Estúdio / Local Fixo',
      clientEmail: data?.clientEmail,
      professionalName: pro?.name || 'Sua Profissional',
      professionalEmail: pro?.email || '',
      bookingId: response.realDocumentId,
      token: data?.token,
      prepInstructions: data?.prepInstructions,
      whatsappUrl
    };
    response.payloadUsed = payload;

    // Validation
    if (!payload.clientEmail) throw new Error("Validation Failed: Missing clientEmail");
    if (!payload.token) throw new Error("Validation Failed: Missing token");
    
    const statusOk = (data?.status === 'confirmed' || data?.status === 'accepted');
    if (!statusOk) {
      process.stdout.write(`[DEBUG RUN] Warning: Status is ${data?.status}\n`);
      response.statusWarning = `Status is ${data?.status}, expected confirmed/accepted`;
    }
    response.validationPassed = true;

    // Send
    response.sendAttempted = true;
    const result = await sendBookingConfirmedEmail(payload);
    
    if (result.success) {
      response.resendSuccess = true;
      response.resendId = result.id;
      return res.json(response);
    } else {
      throw new Error(result.error || "Unknown Resend error");
    }

  } catch (err: any) {
    logger.error("DEBUG", "Debug run failed", { error: err });
    response.error = err.message;
    return res.status(400).json(response);
  }
});

// --- NEW: FULL AUDIT ENDPOINT ---
router.get("/debug-confirmation-email-full", debugOnly, async (req, res) => {
  const db = getDb();
  const { appointmentId } = req.query;
  const audit: any = {
    routeHit: true,
    dataLoaded: false,
    validationPassed: false,
    shouldSendConfirmationEmail: false,
    sendFunctionCalled: false,
    resendAttempted: false,
    resendSuccess: false,
    exactFailureStep: "init"
  };

  try {
    if (!appointmentId) {
      audit.exactFailureStep = "missing_id";
      return res.status(400).json(audit);
    }

    audit.exactFailureStep = "loading_data";
    const apptSnap = await db.collection('appointments').doc(appointmentId as string).get();
    if (!apptSnap.exists) {
      audit.exactFailureStep = "appointment_not_found";
      return res.status(404).json(audit);
    }
    audit.dataLoaded = true;

    const data = apptSnap.data();
    const proSnap = await db.collection('users').doc(data?.professionalId).get();
    const pro = proSnap.exists ? proSnap.data() : null;

    audit.exactFailureStep = "validating";
    const hasEmail = !!data?.clientEmail;
    const hasToken = !!data?.token;
    const isConfirmed = data?.status === 'confirmed' || data?.status === 'accepted';
    
    audit.validationPassed = hasEmail && hasToken;
    audit.shouldSendConfirmationEmail = audit.validationPassed && isConfirmed;

    if (!audit.validationPassed) {
      audit.exactFailureStep = !hasEmail ? "missing_client_email" : "missing_token";
      return res.status(200).json(audit);
    }

    audit.exactFailureStep = "calling_function";
    audit.sendFunctionCalled = true;
    audit.resendAttempted = true;

    const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, '') : '';
    const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;

    const result = await sendBookingConfirmedEmail({
      clientName: data?.clientName,
      serviceName: data?.serviceName,
      date: data?.date,
      time: data?.time,
      location: data?.locationType === 'home' ? `Domicílio (${data?.neighborhood})` : 'Estúdio / Local Fixo',
      clientEmail: data?.clientEmail,
      professionalName: pro?.name || 'Sua Profissional',
      professionalEmail: pro?.email || '',
      bookingId: appointmentId as string,
      token: data?.token,
      prepInstructions: data?.prepInstructions,
      whatsappUrl
    });

    audit.resendSuccess = result.success;
    audit.resendId = result.id;
    audit.exactFailureStep = "completed";
    res.json(audit);

  } catch (err: any) {
    audit.resendError = err.message;
    res.status(500).json(audit);
  }
});

router.get("/fix-duplicate-slots", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId } = req.query;
    if (!professionalId) return res.status(400).json({ error: "Missing professionalId" });

    logger.info("SYSTEM", "Fix duplicates scan starting", { professionalId: maskUid(professionalId as string) });
    
    const apptsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('status', 'in', ['confirmed', 'accepted', 'completed'])
      .get();

    const slots: Record<string, any[]> = {};
    apptsSnap.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.date}_${data.time}`;
      if (!slots[key]) slots[key] = [];
      slots[key].push({ id: doc.id, ...data });
    });

    const fixed = [];
    const conflicts = [];
    const errors = [];

    for (const [key, apps] of Object.entries(slots)) {
      // Sort apps by createdAt to pick the first one
      apps.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      const winner = apps[0];
      const losers = apps.slice(1);

      // Try to create lock for the winner
      const cleanTime = (winner.time || '').replace(':', '');
      const lockId = `${professionalId}_${winner.date}_${cleanTime}`;
      try {
        await db.collection('booking_locks').doc(lockId).set({
          professionalId,
          date: winner.date,
          time: winner.time,
          appointmentId: winner.id,
          serviceId: winner.serviceId || 'unknown',
          status: winner.status,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        fixed.push({ lockId, appointmentId: winner.id });
      } catch (err: any) {
        errors.push({ lockId, error: err.message });
      }

      // Flag losers as conflicts
      for (const loser of losers) {
        try {
          const updatePayload = {
            status: 'pending_conflict', // specific status for manual resolution
            conflictReason: `Conflito com a reserva ${winner.id}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          const safeUpdate = sanitizeAppointment(updatePayload, true);

          await db.collection('appointments').doc(loser.id).update(safeUpdate);
          conflicts.push({ id: loser.id, key });
        } catch (err: any) {
          errors.push({ id: loser.id, error: err.message });
        }
      }
    }

    res.json({
      totalCheckedSlots: Object.keys(slots).length,
      fixedLocksCount: fixed.length,
      conflictsFoundCount: conflicts.length,
      fixed,
      conflicts,
      errors
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-slot-lock", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, date, time } = req.query;
    if (!professionalId || !date || !time) return res.status(400).json({ error: "Missing parameters" });

    const cleanTime = (time as string).replace(':', '');
    const lockId = `${professionalId}_${date}_${cleanTime}`;
    const lockDoc = await db.collection('booking_locks').doc(lockId).get();
    
    const apptsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('date', '==', date)
      .where('time', '==', time)
      .get();

    const allApps = apptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const activeApps = allApps.filter((a: any) => isActiveSlotStatus(a.status) || a.status === 'pending_conflict');
    const pendingApps = allApps.filter((a: any) => isPendingStatus(a.status));

    res.json({
      lockId,
      lockExists: lockDoc.exists,
      lockData: lockDoc.exists ? lockDoc.data() : null,
      activeAppointmentsAtSlot: activeApps,
      pendingAppointmentsAtSlot: pendingApps,
      duplicateCount: activeApps.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- NEW: ATOMIC APPOINTMENT CONFIRMATION ENDPOINT ---
router.post("/appointments/:appointmentId/confirm", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const { professionalId } = req.body;
  const uid = req.uid;

  logger.info("BOOKING", "Confirm request received", { professionalId: maskUid(professionalId as string) });

  try {
        
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) {
        logger.error("BOOKING", "Appointment not found during confirm transaction");
        throw { status: 404, message: "Reserva não encontrada." };
      }

      const data: any = apptDoc.data();
      if (!data) {
        logger.error("BOOKING", "Appointment has no data during confirm transaction");
        throw { status: 400, message: "Dados da reserva inválidos." };
      }

      
      // Permission check using Auth UID, completely disregarding payload professionalId for authorization
      if (data.professionalId !== uid) {
        logger.warn("BOOKING", "Confirm permission denied");
        throw { status: 403, message: "Você não tem permissão para confirmar esta reserva." };
      }

      // Extract date and time with fallbacks
      const dateAttr = data.date || data.appointmentDate || data.selectedDate || data.scheduledDate;
      const timeAttr = data.time || data.appointmentTime || data.selectedTime || data.startTime;

      if (!dateAttr || !timeAttr) {
        logger.error("BOOKING", "Missing date/time configuration");
        throw { status: 400, message: `Dados incompletos: ${!dateAttr ? 'date' : 'time'} ausente` };
      }

      // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
      // 1. READS
      // Check for existing lock
      const cleanTime = timeAttr.replace(':', '');
      const lockId = `${data.professionalId}_${dateAttr}_${cleanTime}`;
      const lockRef = db.collection('booking_locks').doc(lockId);
      
            const lockSnap = await transaction.get(lockRef);

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // Check for duration overlap with other appointments
      const apptsQuery = db.collection('appointments')
        .where('professionalId', '==', data.professionalId)
        .where('date', '==', dateAttr);
      const existingApptsSnap = await transaction.get(apptsQuery);

      const blockingStatuses = ['confirmed', 'accepted', 'completed', 'concluido'];

      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        if (lockData && lockData.appointmentId !== appointmentId && blockingStatuses.includes(lockData.status)) {
          logger.warn("BOOKING", "Confirm failed, slot occupied");
          throw { status: 409, message: "Este horário acabou de ser ocupado por outra cliente." };
        }
      }

      const newStart = timeToMinutes(timeAttr);
      const newDuration = Number(data.duration || data.serviceDuration || 60);
      const newEnd = newStart + newDuration;

      for (const doc of existingApptsSnap.docs) {
        if (doc.id === appointmentId) continue; // Skip itself
        
        const existing = doc.data();
        if (blockingStatuses.includes(existing.status)) {
          const existingStart = timeToMinutes(existing.time);
          const existingDuration = Number(existing.duration || existing.serviceDuration || 60);
          const existingEnd = existingStart + existingDuration;
          
          if (intervalsOverlap(newStart, newEnd, existingStart, existingEnd)) {
            logger.warn("BOOKING", "Confirm failed, durational overlap detected", { 
              appointmentId,
              meta: { existingAppointmentId: doc.id }
            });
            throw { status: 409, message: "Este horário já possui um agendamento conflitante de outra cliente." };
          }
        }
      }

      // 2. WRITES
      // Update Appointment data
      const updatePayload: any = {
        status: "confirmed",
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        date: dateAttr,
        time: timeAttr
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

            transaction.update(apptRef, safeUpdate);

      // Create/Update the lock
            transaction.set(lockRef, {
        professionalId: data.professionalId,
        date: dateAttr,
        time: timeAttr,
        appointmentId: appointmentId,
        serviceId: data.serviceId || 'unknown',
        status: 'confirmed',
        createdAt: lockSnap.exists ? lockSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const updatedData = { ...data, ...updatePayload };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId, lockId, status: "confirmed" };
    });

    logger.info("BOOKING", "Confirm finished successfully");
    
    // Create Google Calendar event (don't await to avoid delaying the response)
    // We could fetch the appointment data again, or pass the data we had
    const apptDoc = await db.collection('appointments').doc(appointmentId).get();
    if (apptDoc.exists) {
      createGoogleCalendarEvent({ id: appointmentId, ...apptDoc.data() }, professionalId);
    }

    return res.json(result);

  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Erro interno do servidor";
    
    logger.error("BOOKING", "Confirm endpoint error", { error: err });

    return res.status(status).json({ error: message, code: status });
  }
});

// --- NEW: COMPLETE APPOINTMENT ENDPOINT ---
router.post("/appointments/:appointmentId/complete", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const uid = req.uid;

  logger.info("BOOKING", "Complete request received");

  try {
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) {
        throw { status: 404, message: "Agenda não encontrada." };
      }

      const data = apptDoc.data()!;

      if (data.professionalId !== uid) {
        throw { status: 403, message: "Você não tem permissão." };
      }

      if (data.status !== 'confirmed' && data.status !== 'accepted') {
        throw { status: 400, message: `Apenas atendimentos confirmados/aceitos podem ser concluídos. Status: ${data.status}` };
      }

      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      const updatePayload: any = {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      const updatedData = { ...data, ...safeUpdate };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId, status: "completed" };
    });

    logger.info("BOOKING", "Complete success");
    return res.json(result);

  } catch (err: any) {
    logger.error("BOOKING", "Complete endpoint error", { error: err });
    const status = err.status || 500;
    const message = err.message || "Erro ao concluir atendimento";
    res.status(status).json({ error: message, details: err });
  }
});

// --- NEW: DECLINE APPOINTMENT BY PROFESSIONAL ENDPOINT ---
router.post("/appointments/:appointmentId/decline", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const uid = req.uid;

  logger.info("BOOKING", "Decline request received");

  try {
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      if (data.professionalId !== uid) {
        throw { status: 403, message: "Você não tem permissão." };
      }

      if (data.status !== 'pending') {
        throw { status: 400, message: `Transição de ${data.status} para recusada não permitida.` };
      }

      // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
      // 1. READS
      let shouldDeleteLock = false;
      let deleteLockRef: admin.firestore.DocumentReference | null = null;
      
      const lockId = getBookingLockId(data);
      if (lockId) {
        deleteLockRef = db.collection('booking_locks').doc(lockId);
        const lockSnap = await transaction.get(deleteLockRef);
        if (lockSnap.exists) {
           if (lockSnap.data()?.appointmentId === appointmentId) {
             shouldDeleteLock = true;
           } else {
                        }
        }
      }

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // 2. WRITES
      if (shouldDeleteLock && deleteLockRef) {
        transaction.delete(deleteLockRef);
              }

      const updatePayload: any = {
        status: "cancelled_by_professional",
        declinedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: 'Recusado pelo profissional'
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      const updatedData = { ...data, ...safeUpdate };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId };
    });

    logger.info("BOOKING", "Decline success");
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Erro interno do servidor";
    logger.error("BOOKING", "Decline endpoint error", { error: err });
    return res.status(status).json({ error: message });
  }
});

// --- NEW: CANCEL CONFIRMED APPOINTMENT BY PROFESSIONAL ENDPOINT ---
router.post("/appointments/:appointmentId/cancel-by-professional", requireFirebaseAuth, async (req: AuthenticatedRequest, res: express.Response) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const uid = req.uid;

  logger.info("BOOKING", "Cancel request received");

  try {
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      if (data.professionalId !== uid) {
        throw { status: 403, message: "Você não tem permissão." };
      }

      if (data.status !== 'confirmed' && data.status !== 'accepted') {
        throw { status: 400, message: `Apenas confirmados podem ser cancelados. Status: ${data.status}` };
      }

      // IMPORTANTE: Firestore transactions exigem todos os reads antes dos writes.
      // 1. READS
      let shouldDeleteLock = false;
      let deleteLockRef: admin.firestore.DocumentReference | null = null;
      
      const lockId = getBookingLockId(data);
      if (lockId) {
        deleteLockRef = db.collection('booking_locks').doc(lockId);
        const lockSnap = await transaction.get(deleteLockRef);
        if (lockSnap.exists) {
           if (lockSnap.data()?.appointmentId === appointmentId) {
             shouldDeleteLock = true;
           } else {
                        }
        } else {
                   }
      } else {
              }

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // 2. WRITES
      if (shouldDeleteLock && deleteLockRef) {
        transaction.delete(deleteLockRef);
              }

      const updatePayload: any = {
        status: "cancelled_by_professional",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastChangeBy: 'professional',
        changeMessage: 'Cancelado pelo profissional'
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      const updatedData = { ...data, ...safeUpdate };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId };
    });

    logger.info("BOOKING", "Cancel success");
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Erro interno do servidor";
    logger.error("BOOKING", "Cancel endpoint error", { error: err });
    return res.status(status).json({ error: message });
  }
});

// --- NEW: DIAGNOSTIC ENDPOINT FOR CAN BOOK SLOT ---
router.get("/debug-can-book-slot", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId, date, time } = req.query;
    if (!professionalId || !date || !time) return res.status(400).json({ error: "Missing professionalId, date or time" });

    const proDoc = await db.collection('users').doc(professionalId as string).get();
    if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db.collection('services').doc(serviceId as string).get();
      if (svcDoc.exists) {
        serviceDuration = Number(svcDoc.data()?.duration) || 60;
      }
    }

    // Fetch appointments
    const apptsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('date', '==', date)
      .where('status', 'in', ['confirmed', 'completed', 'accepted'])
      .get();
    const appointments = apptsSnap.docs.map(d => d.data());

    // Fetch blocks
    const blocksSnap = await db.collection('blocked_schedules')
      .where('professionalId', '==', professionalId)
      .get();
    const blocks = blocksSnap.docs.map(d => d.data());

    // Check working hours
    const workingHours = pro.workingHours;
    const dObj = new Date(date as string + 'T12:00:00');
    const dayOfWeek = dObj.getDay();
    const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

    if (!isWorkingDay) {
      return res.json({ canBook: false, reason: "Not a working day", debug: { dayOfWeek, workingDays: workingHours?.workingDays } });
    }

    // Simple overlap logic for debug
    const [h, m] = (time as string).split(':').map(Number);
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + serviceDuration;

    // Check against work hours range
    const [whs, wms] = (workingHours.startTime || '09:00').split(':').map(Number);
    const [whe, wme] = (workingHours.endTime || '18:00').split(':').map(Number);
    const workStart = whs * 60 + wms;
    const workEnd = whe * 60 + wme;

    if (slotStart < workStart || slotEnd > workEnd) {
      return res.json({ canBook: false, reason: "Outside working hours", debug: { slotStart, slotEnd, workStart, workEnd } });
    }

    // Check against appointments
    const conflictingAppt = appointments.find((a: any) => {
      const [ah, am] = a.time.split(':').map(Number);
      const aStart = ah * 60 + am;
      const aEnd = aStart + (Number(a.duration) || 60);
      return Math.max(slotStart, aStart) < Math.min(slotEnd, aEnd);
    });

    if (conflictingAppt) {
      return res.json({ canBook: false, reason: "Conflict with existing appointment", conflictingAppt });
    }

    // Check against blocks
    const conflictingBlock = blocks.find((b: any) => {
      const isFixed = b.date === date;
      const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      if (!isFixed && !isRecurring) return false;
      
      const [bh, bm] = b.startTime.split(':').map(Number);
      const [beh, bem] = b.endTime.split(':').map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = beh * 60 + bem;
      return Math.max(slotStart, bStart) < Math.min(slotEnd, bEnd);
    });

    if (conflictingBlock) {
      return res.json({ canBook: false, reason: "Conflict with professional block", conflictingBlock });
    }

    res.json({ canBook: true, message: "Slot is available" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-reservation-token", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const results: any = { tokenReceived: token };

    // Search by token
    const q1 = await db.collection('appointments').where('token', '==', token).limit(1).get();
    results.foundByToken = !q1.empty;
    
    // Search by publicToken
    const q2 = await db.collection('appointments').where('publicToken', '==', token).limit(1).get();
    results.foundByPublicToken = !q2.empty;

    // Search by manageToken
    const q3 = await db.collection('appointments').where('manageToken', '==', token).limit(1).get();
    results.foundByManageToken = !q3.empty;

    // Search by docId
    const q4 = await db.collection('appointments').doc(token as string).get();
    results.foundByDocId = q4.exists;

    const mainDoc = q1.docs[0] || q2.docs[0] || q3.docs[0] || (q4.exists ? q4 : null);

    if (mainDoc) {
      results.appointmentId = mainDoc.id;
      results.appointmentData = mainDoc.data();
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-next-slot-full", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId } = req.query;
    if (!professionalId) return res.status(400).json({ error: "Missing professionalId" });

    const proDoc = await db.collection('users').doc(professionalId as string).get();
    if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db.collection('services').doc(serviceId as string).get();
      if (svcDoc.exists) serviceDuration = Number(svcDoc.data()?.duration) || 60;
    }

    const daysToLook = 14;
    const daysChecked = [];
    const now = new Date();
    
    const appointmentsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('status', 'in', ['confirmed', 'completed', 'accepted'])
      .get();
    const allAppts = appointmentsSnap.docs.map(d => d.data());

    const blocksSnap = await db.collection('blocked_schedules')
      .where('professionalId', '==', professionalId)
      .get();
    const allBlocks = blocksSnap.docs.map(d => d.data());

    for (let i = 0; i < daysToLook; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const dStr = d.toISOString().split('T')[0];
      
      const workingHours = pro.workingHours;
      const dayOfWeek = d.getDay();
      const isWorkingDay = workingHours?.workingDays?.includes(dayOfWeek);

      if (!isWorkingDay) {
        daysChecked.push({ date: dStr, agendaSlotsCount: 0, reason: "Not a working day" });
        continue;
      }

      const slots = [];
      const [whs, wms] = (workingHours.startTime || '09:00').split(':').map(Number);
      const [whe, wme] = (workingHours.endTime || '18:00').split(':').map(Number);
      const workStart = whs * 60 + wms;
      const workEnd = whe * 60 + wme;

      for (let curr = workStart; curr < workEnd; curr += 30) {
        const pEnd = curr + serviceDuration;
        if (pEnd > workEnd) break;
        
        if (i === 0) { // Today
           const nowMin = now.getHours() * 60 + now.getMinutes();
           if (curr <= nowMin + 40) continue;
        }

        const hasAppt = allAppts.some((a: any) => {
          if (a.date !== dStr) return false;
          const [ah, am] = a.time.split(':').map(Number);
          const aS = ah * 60 + am;
          const aE = aS + (Number(a.duration) || 60);
          return Math.max(curr, aS) < Math.min(pEnd, aE);
        });

        const hasBlock = allBlocks.some((b: any) => {
          const isF = b.date === dStr;
          const isR = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
          if (!isF && !isR) return false;
          const [bh, bm] = b.startTime.split(':').map(Number);
          const [beh, bem] = b.endTime.split(':').map(Number);
          const bS = bh * 60 + bm;
          const bE = beh * 60 + bem;
          return Math.max(curr, bS) < Math.min(pEnd, bE);
        });

        if (!hasAppt && !hasBlock) {
          const h = Math.floor(curr / 60);
          const m = curr % 60;
          slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
      }

      daysChecked.push({
        date: dStr,
        agendaSlotsCount: slots.length,
        agendaSlots: slots,
        badgeWouldShow: slots.length > 0
      });
    }

    res.json({
      professionalId,
      serviceDuration,
      daysChecked
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-bookable-slots", debugOnly, async (req, res) => {
  try {
    const db = getDb();
    const { professionalId, serviceId, date } = req.query;
    if (!professionalId || !date) return res.status(400).json({ error: "Missing professionalId or date" });

    const proDoc = await db.collection('users').doc(professionalId as string).get();
    if (!proDoc.exists) return res.status(404).json({ error: "Professional not found" });
    const pro: any = proDoc.data();

    let serviceDuration = 60;
    if (serviceId) {
      const svcDoc = await db.collection('services').doc(serviceId as string).get();
      if (svcDoc.exists) {
        const svcData: any = svcDoc.data();
        serviceDuration = Number(svcData.duration) || 60;
      }
    }

    const apptsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('date', '==', date)
      .where('status', 'in', ['confirmed', 'completed'])
      .get();
    
    const appointments = apptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const blocksSnap = await db.collection('blocked_schedules')
      .where('professionalId', '==', professionalId)
      .get();
    const blockedSchedules = blocksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const d = new Date(date as string + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const dayBlocks = blockedSchedules.filter((b: any) => {
      const isFixed = b.date === date;
      const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      return isFixed || isRecurring;
    });

    res.json({
      professionalId,
      serviceId,
      serviceDuration,
      date,
      workingHours: pro.workingHours,
      isWorkingDay: pro.workingHours?.workingDays?.includes(dayOfWeek),
      appointmentsInDay: appointments.length,
      blocksInDay: dayBlocks.length,
      appointments: appointments.map((a: any) => ({ time: a.time, duration: a.duration })),
      blocks: dayBlocks.map((b: any) => ({ start: b.startTime, end: b.endTime }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/public/manage/:manageSlug/confirm-presence", async (req, res) => {
  const db = getDb();
  const { manageSlug } = req.params;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Validate slug
      const linkRef = db.collection('reservation_links').doc(manageSlug);
      const linkDoc = await transaction.get(linkRef);
      
      if (!linkDoc.exists) {
        throw { status: 404, message: "Link de gerenciamento inválido." };
      }
      
      const appointmentId = linkDoc.data()?.appointmentId;
      if (!appointmentId) throw { status: 404, message: "Reserva não encontrada no link." };

      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // Check for terminal or invalid statuses
      if (['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'declined', 'completed', 'concluido'].includes(data.status)) {
        throw { status: 409, message: "Esta reserva não pode ser confirmada." };
      }

      // WRITES
      const updatePayload: any = {
        clientConfirmed24h: true,
        clientConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastChangeBy: 'client',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Só alterar status para confirmed se o status atual for pending/pending_confirmation
      if (['pending', 'pending_confirmation'].includes(data.status)) {
        updatePayload.status = 'confirmed';
      }

      const safeUpdate = sanitizeAppointment(updatePayload, true);
      transaction.update(apptRef, safeUpdate);

      const updatedData = { ...data, ...updatePayload };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId };
    });

    res.json(result);
  } catch (err: any) {
    logger.error("BOOKING", "Manage Confirm Presence Error", { error: err });
    if (err.status) {
       res.status(err.status).json({ error: err.message });
    } else {
       res.status(500).json({ error: err.message });
    }
  }
});


// --- NEW: CANCEL BY CLIENT VIA MANAGE SLUG ---
router.post("/public/manage/:manageSlug/cancel", async (req: express.Request, res: express.Response) => {
  const db = getDb();
  const { manageSlug } = req.params;
  const { reason } = req.body;

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Validate slug
      const linkRef = db.collection('reservation_links').doc(manageSlug);
      const linkDoc = await transaction.get(linkRef);
      
      if (!linkDoc.exists) {
        throw { status: 404, message: "Link de gerenciamento inválido." };
      }
      
      const appointmentId = linkDoc.data()?.appointmentId;
      if (!appointmentId) throw { status: 404, message: "Reserva não encontrada no link." };

      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) throw { status: 404, message: "Reserva não encontrada." };
      const data: any = apptDoc.data();

      if (['cancelled', 'cancelled_by_client', 'cancelled_by_professional'].includes(data.status)) {
        throw { status: 400, message: "Reserva já está cancelada." };
      }

      // 1. READS for Lock
      let shouldDeleteLock = false;
      let deleteLockRef: admin.firestore.DocumentReference | null = null;
      
      const lockId = getBookingLockId(data);
      if (lockId) {
        deleteLockRef = db.collection('booking_locks').doc(lockId);
        const lockSnap = await transaction.get(deleteLockRef);
        if (lockSnap.exists) {
           if (lockSnap.data()?.appointmentId === appointmentId) {
             shouldDeleteLock = true;
           } else {
                        }
        }
      }

      // Read Client Summary
      const clientKey = getClientKey(data.clientWhatsapp, data.clientEmail, data.clientName);
      const summaryId = `${data.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);

      // 2. WRITES
      if (shouldDeleteLock && deleteLockRef) {
        transaction.delete(deleteLockRef);
              }

      const updatePayload: any = {
        status: "cancelled_by_client",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: reason || 'Cancelado pelo cliente',
        lastChangeBy: 'client',
        changeMessage: 'Cliente cancelou a reserva'
      };
      
      const safeUpdate = sanitizeAppointment(updatePayload, true);

      transaction.update(apptRef, safeUpdate);
      
      const updatedData = { ...data, ...safeUpdate };
      await updateClientSummaryInternal(transaction, updatedData, data.professionalId, false, data.status, summarySnap);

      return { success: true, appointmentId };
    });

    logger.info("BOOKING", "Cancel by client success");
    return res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    const message = err.message || "Erro interno do servidor";
    logger.error("BOOKING", "Cancel by client error", { error: err });
    return res.status(status).json({ error: message });
  }
});

export default router;
