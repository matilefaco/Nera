import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { sendBookingConfirmedEmail } from "../emails/sendEmail.js";
import { createGoogleCalendarEvent } from "./calendarRoutes.js";

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

const generateRandomSuffix = (length: number = 4) => {
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
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

async function updateClientSummaryInternal(transaction: admin.firestore.Transaction, appointment: any, professionalId: string, isNew: boolean, oldStatus?: string, preFetchedSnap?: admin.firestore.DocumentSnapshot) {
  const db = getDb();
  const clientKey = getClientKey(appointment.clientWhatsapp, appointment.clientEmail, appointment.clientName);
  const summaryId = `${professionalId}_${clientKey}`;
  const summaryRef = db.collection('client_summaries').doc(summaryId);
  
  const summarySnap = preFetchedSnap || await transaction.get(summaryRef);
  let summary = summarySnap.exists ? summarySnap.data() as any : {
    professionalId,
    clientKey,
    clientName: appointment.clientName,
    clientPhone: appointment.clientWhatsapp || '',
    clientEmail: appointment.clientEmail || '',
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    noShowCount: 0,
    totalSpent: 0,
    lastAppointmentDate: appointment.date,
    lastServiceName: appointment.serviceName,
    firstAppointmentDate: appointment.date,
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

  const wasConfirmed = oldStatus === 'confirmed' || oldStatus === 'accepted' || oldStatus === 'completed';
  const isNowConfirmed = status === 'confirmed' || status === 'accepted' || status === 'completed';

  if (isNowConfirmed && !wasConfirmed) {
    summary.confirmedAppointments += 1;
    summary.totalSpent += price;
  } else if (!isNowConfirmed && wasConfirmed) {
    summary.confirmedAppointments = Math.max(0, summary.confirmedAppointments - 1);
    summary.totalSpent = Math.max(0, summary.totalSpent - price);
  }

  if (status === 'cancelled' || status === 'cancelled_by_client' || status === 'cancelled_by_professional') {
    if (oldStatus !== 'cancelled' && oldStatus !== 'cancelled_by_client' && oldStatus !== 'cancelled_by_professional') {
      summary.cancelledAppointments += 1;
    }
  }

  if (appointment.noShow) {
    summary.noShowCount += 1;
  }

  if (!summary.lastAppointmentDate || new Date(appointment.date) >= new Date(summary.lastAppointmentDate)) {
    summary.lastAppointmentDate = appointment.date;
    summary.lastServiceName = appointment.serviceName;
    summary.clientName = appointment.clientName || summary.clientName;
    summary.clientPhone = appointment.clientWhatsapp || summary.clientPhone;
    summary.clientEmail = appointment.clientEmail || summary.clientEmail;
  }

  summary.updatedAt = new Date().toISOString();
  transaction.set(summaryRef, summary, { merge: true });
}

// --- SECURE PUBLIC BOOKING ENDPOINT ---
router.get("/public/booking-health", (req, res) => {
  res.json({ 
    ok: true, 
    route: "booking", 
    time: new Date().toISOString(),
    headers: req.headers,
    processId: process.pid
  });
});

router.post("/public/create-booking", async (req, res) => {
  const db = getDb();
  const appointmentData = req.body;
  console.log("BOOKING PAYLOAD RECEBIDO:", JSON.stringify(appointmentData, null, 2));
  
  if (!appointmentData.professionalId || !appointmentData.date || !appointmentData.time) {
    console.error(`[API_BOOKING] REJECTED: Missing fields`, appointmentData);
    return res.status(400).json({ error: "Dados de agendamento incompletos (professionalId, date ou time ausentes)" });
  }

  try {
    const cleanedData = removeEmptyFields(appointmentData);
    const apptRef = db.collection('appointments').doc();
    const reservationCode = generateReservationCode(appointmentData.date);
    const manageSlug = reservationCode.toLowerCase();

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

    console.log(`[API_BOOKING] Transaction starting. ApptID: ${apptRef.id}`);

    await db.runTransaction(async (transaction) => {
      // Professional Check
      const proRef = db.collection('users').doc(appointmentData.professionalId);
      const proSnap = await transaction.get(proRef);
      if (!proSnap.exists) {
        console.error(`BOOKING ERROR: Professional not found: ${appointmentData.professionalId}`);
        throw new Error(`Profissional não encontrado (${appointmentData.professionalId}). Verifique se o perfil existe.`);
      }

      // Service Check & Official Price
      if (!appointmentData.serviceId) {
        console.error(`BOOKING ERROR: Missing serviceId`);
        throw new Error('ID do serviço não fornecido.');
      }
      const serviceRef = db.collection('services').doc(appointmentData.serviceId);
      const serviceSnap = await transaction.get(serviceRef);
      if (!serviceSnap.exists) {
        console.error(`BOOKING ERROR: Service not found: ${appointmentData.serviceId}`);
        throw new Error(`Serviço não encontrado (${appointmentData.serviceId}). Verifique se o serviço ainda existe.`);
      }
      const service = serviceSnap.data() as any;

      // Ownership check (Critical for data integrity after migration)
      if (normalizeId(service.professionalId) !== normalizeId(appointmentData.professionalId)) {
        console.warn(`[API_BOOKING] ID MISMATCH: Service ${appointmentData.serviceId} belongs to ${service.professionalId}, but booking requested for ${appointmentData.professionalId}.`);
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

      // Create Appointment
      transaction.set(apptRef, finalData);

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
      const clientKey = getClientKey(appointmentData.clientWhatsapp, appointmentData.clientEmail, appointmentData.clientName);
      const summaryId = `${appointmentData.professionalId}_${clientKey}`;
      const summaryRef = db.collection('client_summaries').doc(summaryId);
      const summarySnap = await transaction.get(summaryRef);
      await updateClientSummaryInternal(transaction, finalData, appointmentData.professionalId, true, undefined, summarySnap);
    });

    console.log(`[API_BOOKING] SUCCESS: Committed Appt ${apptRef.id}`);

    res.json({
      success: true,
      bookingId: apptRef.id,
      token: manageSlug,
      reservationCode
    });

  } catch (err: any) {
    console.error("BOOKING ERROR:", err.message);
    res.status(500).json({ 
      error: err.message,
      code: err.code || null
    });
  }
});

// --- DIAGNOSTIC ENDPOINT FOR EMAILS ---
router.get("/debug-booking-email", debugOnly, async (req: any, res: any) => {
  try {
    const db = getDb();
    const query = req.query || {};
    const { appointmentId } = query;
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      env: {
        resendKeyPresent: !!process.env.RESEND_API_KEY,
        emailFrom: process.env.EMAIL_FROM || "Nera <agenda@usenera.com>",
        appUrl: process.env.APP_URL,
        nodeEnv: process.env.NODE_ENV
      }
    };

    if (appointmentId) {
      debugInfo.appointmentId = appointmentId;
      const apptDoc = await db.collection('appointments').doc(appointmentId as string).get();
      if (apptDoc.exists) {
        const data = apptDoc.data();
        debugInfo.appointment = {
          status: data?.status,
          clientEmail: data?.clientEmail,
          clientName: data?.clientName,
          token: !!data?.token,
          professionalId: data?.professionalId
        };

        if (data?.professionalId) {
          const proDoc = await db.collection('users').doc(data.professionalId).get();
          if (proDoc.exists) {
            debugInfo.professional = {
              email: proDoc.data()?.email,
              name: proDoc.data()?.name
            };
          }
        }
      } else {
        debugInfo.error = "Appointment not found in Firestore";
      }
    }

    res.json(debugInfo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
      console.log('FAILED (not found)');
      return res.status(404).json({ error: "Appointment not found" });
    }
    console.log('SUCCESS');

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
        console.log('SUCCESS');
        result.professionalEmail = proDoc.data()?.email;
      } else {
        console.log('FAILED (not found)');
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error('[FIRESTORE ERROR]', err.message);
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
    console.error(`[DEBUG RUN] Failed:`, err.message);
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

    console.log(`[FIX DUPLICATES] Scanning for ${professionalId}...`);
    
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
          await db.collection('appointments').doc(loser.id).update({
            status: 'pending_conflict', // specific status for manual resolution
            conflictReason: `Conflito com a reserva ${winner.id}`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
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
    const activeApps = allApps.filter((a: any) => ['confirmed', 'accepted', 'completed', 'pending_conflict'].includes(a.status));
    const pendingApps = allApps.filter((a: any) => a.status === 'pending');

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
router.post("/appointments/:appointmentId/confirm", async (req, res) => {
  const db = getDb();
  const { appointmentId } = req.params;
  const { professionalId } = req.body;

  console.log(`[CONFIRM APPOINTMENT] Request received for ${appointmentId} from ${professionalId}`);

  if (!professionalId) {
    return res.status(400).json({ error: "Dados incompletos: professionalId ausente" });
  }

  try {
    console.log(`[CONFIRM ENDPOINT HIT] appointmentId: ${appointmentId}, professionalId: ${professionalId}`);
    
    const result = await db.runTransaction(async (transaction) => {
      const apptRef = db.collection('appointments').doc(appointmentId);
      const apptDoc = await transaction.get(apptRef);

      if (!apptDoc.exists) {
        console.error(`[CONFIRM TRANSACTION] Appointment ${appointmentId} NOT FOUND`);
        throw { status: 404, message: "Reserva não encontrada." };
      }

      const data = apptDoc.data();
      if (!data) {
        console.error(`[CONFIRM TRANSACTION] Appointment ${appointmentId} has NO DATA`);
        throw { status: 400, message: "Dados da reserva inválidos." };
      }

      console.log(`[CONFIRM PRECHECK]`, {
        appointmentId: appointmentId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        date: data.date || data.appointmentDate || data.selectedDate || data.scheduledDate,
        time: data.time || data.appointmentTime || data.selectedTime || data.startTime,
        status: data.status,
        clientName: data.clientName
      });

      // Permission check
      if (data.professionalId !== professionalId) {
        console.error(`[CONFIRM TRANSACTION] Permission Denied: Appt proId=${data.professionalId}, Payload proId=${professionalId}`);
        throw { status: 403, message: "Você não tem permissão para confirmar esta reserva." };
      }

      // Extract date and time with fallbacks
      const dateAttr = data.date || data.appointmentDate || data.selectedDate || data.scheduledDate;
      const timeAttr = data.time || data.appointmentTime || data.selectedTime || data.startTime;

      if (!dateAttr || !timeAttr) {
        console.error(`[CONFIRM TRANSACTION] Missing date/time. date=${dateAttr}, time=${timeAttr}`);
        throw { status: 400, message: `Dados incompletos: ${!dateAttr ? 'date' : 'time'} ausente` };
      }

      // Check for existing lock
      const cleanTime = timeAttr.replace(':', '');
      const lockId = `${data.professionalId}_${dateAttr}_${cleanTime}`;
      const lockRef = db.collection('booking_locks').doc(lockId);
      
      console.log(`[CONFIRM TRANSACTION] Checking lock at: ${lockId}`);
      const lockSnap = await transaction.get(lockRef);

      const blockingStatuses = ['confirmed', 'accepted', 'completed'];

      if (lockSnap.exists) {
        const lockData = lockSnap.data();
        if (lockData && lockData.appointmentId !== appointmentId && blockingStatuses.includes(lockData.status)) {
          console.warn(`[CONFIRM TRANSACTION] FAIL: Slot occupied by ${lockData.appointmentId}`);
          throw { status: 409, message: "Este horário acabou de ser ocupado por outra cliente." };
        }
      }

      // Update Appointment data
      const updatePayload: any = {
        status: "confirmed",
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        date: dateAttr,
        time: timeAttr
      };

      console.log(`[CONFIRM TRANSACTION] Updating appointment ${appointmentId}...`);
      transaction.update(apptRef, updatePayload);

      // Create/Update the lock
      console.log(`[CONFIRM TRANSACTION] Creating/Updating lock ${lockId}...`);
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

      return { success: true, appointmentId, lockId, status: "confirmed" };
    });

    console.log(`[CONFIRM ENDPOINT SUCCESS] for ${appointmentId}`);
    
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
    
    console.error(`[CONFIRM ENDPOINT ERROR]`, {
      code: status,
      message,
      appointmentId,
      professionalId,
      stack: err.stack
    });

    return res.status(status).json({ error: message, code: status });
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

router.post("/booking/:id/confirm-presence", async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const appRef = db.collection('appointments').doc(id);
    const appDoc = await appRef.get();
    
    if (!appDoc.exists) return res.status(404).json({ error: "Reserva não encontrada" });
    
    await appRef.update({
      clientConfirmed24h: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
