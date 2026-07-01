import express from "express";
import { randomBytes } from "crypto";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { logger, maskPhone, maskToken, maskUid } from "../utils/logger.js";
import { PUBLIC_APP_URL, buildPublicBookingUrl } from "../utils.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { 
  sendProfessionalNewBookingEmail,
  sendWaitlistInviteEmail,
  sendBookingPendingEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendBookingCancelledClientEmail,
  sendBookingRescheduledEmail,
  sendBookingReminder24hEmail,
  sendReviewRequestEmail,
  sendConfirmationRequest24hEmail,
  sendRetentionEmail,
  sendDailyDigestEmail
} from "../emails/sendEmail.js";
import { sendWhatsApp, handleInboundMessage } from "../services/whatsappService.js";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contato@usenera.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export async function sendPushToUser(professionalId: string, payload: any) {
  const db = getDb();
  try {
    const subscriptionsSnap = await db.collection('users').doc(professionalId).collection('push_subscriptions').get();
    
    if (subscriptionsSnap.empty) {
            return;
    }

    const notificationPayload = JSON.stringify(payload);

    const promises = subscriptionsSnap.docs.map(doc => {
      const subscription = doc.data().subscription;
      return webpush.sendNotification(subscription, notificationPayload).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
                    return doc.ref.delete();
        }
        logger.error("PUSH", "Error sending push to doc", { error: err });
      });
    });

    await Promise.all(promises);
  } catch (error) {
    logger.error("PUSH", "Error in sendPushToUser", { error });
  }
}

/**
 * Creates an internal alert for last-minute cancellations (less than 2 hours).
 */
async function createLastMinuteAlert(payload: any) {
  if (!payload) return;
  const db = getDb();
  const { professionalId, clientName, serviceName, date, time, appointmentId } = payload;
  const apptId = appointmentId || payload.id;

  if (!professionalId || !date || !time || !apptId) {
        return;
  }

  try {
    // Determine time difference
    // Note: This assumes server time and appointment time are in the same relative timezone
    const apptDate = new Date(`${date}T${time}`);
    const now = new Date();
    const diffMs = apptDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    
    // If cancellation is within 2 hours of the appointment
    if (diffHours > 0 && diffHours <= 2) {
      const alertId = `last_minute_${apptId}`;
      const alertRef = db.collection('alerts').doc(alertId);
      
      const alertSnap = await alertRef.get();
      if (alertSnap.exists) {
                return;
      }

      await alertRef.set({
        professionalId,
        appointmentId: apptId,
        type: 'last_minute_cancellation',
        clientName: clientName || 'Cliente',
        serviceName: serviceName || 'Serviço',
        scheduledDate: date,
        scheduledTime: time,
        hoursUntil: Math.round(diffHours * 10) / 10,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

            
      // Also trigger a push
      await sendPushToUser(professionalId, {
        title: "Cancelamento de última hora!",
        body: `${clientName} cancelou ${serviceName} às ${time}.`,
        icon: "/icon-192.png",
        data: { url: "/dashboard" }
      });
    }
  } catch (err) {
    logger.error("ALERT", "Error creating last-minute alert", { error: err });
  }
}

import { 
  buildNewBookingMessageForPro, 
  buildBookingConfirmedMessageForClient,
  buildBookingRejectedMessageForClient,
  buildCancellationByProMessageForClient,
  buildCancellationMessage,
  buildWaitlistInviteMessage,
  buildRescheduledByProMessageForClient,
  buildReminderMessage24h,
  buildReviewRequestMessage
} from "../services/whatsappMessages.js";
import { shouldSendEmail, markEmailSent, sendWhatsAppMeta } from "../utils.js";
import { sendProfessionalBookingRescheduledEmail } from '../emails/sendEmail.js';
import { updateGoogleCalendarEvent, deleteGoogleCalendarEvent } from "./calendarRoutes.js";
import { checkPlanFeature } from "../middleware/planMiddleware.js";
import { requireCronSecret } from "../middleware/cronSecretMiddleware.js";
import { authMutationLimiter, notificationMutationLimiter } from "../middleware/rateLimiter.js";


// Tokens públicos de acesso precisam ser criptograficamente seguros. Não usar Math.random.
function generateSecureToken(bytes: number = 16): string {
  return randomBytes(bytes).toString("hex");
}

const router = express.Router();

const debugOnly = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not Found");
  }
  return next();
};

router.get("/debug-email", debugOnly, async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Nera <ola@usenera.com>";
  const appUrl = process.env.APP_URL;
  
  res.json({
    resendKeyPresent: !!apiKey,
    resendKeyPrefix: apiKey ? `${apiKey.substring(0, 5)}...` : 'N/A',
    from,
    appUrl: appUrl || PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV
  });
});

router.get("/test-email", debugOnly, async (req, res) => {
    const target = (req.query.email as string) || "matilefaco@hotmail.com";
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing');
    }
    
    const result = await sendProfessionalNewBookingEmail({
      clientName: "Teste Audit",
      clientWhatsapp: "(11) 99999-9999",
      whatsappUrl: "https://wa.me/5511999999999",
      serviceName: "Corte de Cabelo (Teste)",
      date: new Date().toISOString().split('T')[0],
      time: "14:00",
      location: "Estúdio Teste",
      totalPrice: "R$ 100,00",
      professionalEmail: target,
      professionalName: "Profissional de Teste",
      bookingId: "test-id-" + Date.now()
    });
    res.json({ status: "Email test sent successfully", result });
  } catch (err: any) {
        res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Mock for sendRawEmail which was deprecated in original server.ts
function sendRawEmailDraft(...args: any[]) { logger.warn("EMAIL", "sendRawEmail is deprecated"); return { success: false }; }

router.get("/test-email-real", debugOnly, async (req, res) => {
  const target = "matilefaco@hotmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Teste Nera funcionando",
    "Seu sistema de emails está ativo com domínio verificado."
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-email-gmail", debugOnly, async (req, res) => {
  const target = "matilefaco1@gmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Teste Nera GMAIL",
    "Teste de envio oficial para GMAIL através do sistema Nera."
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-email-hotmail-clean", debugOnly, async (req, res) => {
  const target = "matilefaco@hotmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Confirmação Nera",
    "Seu agendamento está confirmado.",
    { 
      isHtml: true, 
      customHtml: `<div style="font-family: sans-serif; padding: 20px;">Olá!<br><br>Seu agendamento no Nera foi confirmado com sucesso.</div>` 
    }
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-email-hotmail-plain", debugOnly, async (req, res) => {
  const target = "matilefaco@hotmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Confirmação Nera",
    "Seu agendamento no Nera foi confirmado com sucesso.",
    { isHtml: false }
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-whatsapp", debugOnly, async (req, res) => {
  const db = getDb();
  const { phone, message, type, simulateInbound } = req.query;
  if (!phone) return res.status(400).json({ error: "Missing phone" });
  
  if (simulateInbound === 'true') {
    const result = await handleInboundMessage(db, phone as string, message as string || '1', { simulated: true });
    return res.json(result);
  }

  const targetPhone = phone as string;
  const eventType = (type as string) || 'test_generic';
  let msg = (message as string);

  const mockData = {
    clientName: "Cliente Teste",
    serviceName: "Design de Sobrancelhas",
    date: "2026-04-26",
    time: "14:00",
    professionalName: "Helena Prado",
    professionalSlug: "helena-prado",
    reviewUrl: "https://usenera.com/review/test"
  };

  if (!msg) {
    const formattedDate = mockData.date.split('-').reverse().join('/');
    switch (eventType) {
      case 'NEW_BOOKING':
        msg = `✨ *Novo pedido de agendamento*\n\n*Cliente:* ${mockData.clientName}\n*Serviço:* ${mockData.serviceName}\n*Data:* ${formattedDate}\n*Hora:* ${mockData.time}\n\nAbra o painel do Nera para confirmar.`;
        break;
      case 'CONFIRMED':
        msg = `✨ *Seu horário foi confirmado!*\n\n*Profissional:* ${mockData.professionalName}\n*Serviço:* ${mockData.serviceName}\n*Data:* ${formattedDate}\n*Hora:* ${mockData.time}\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença\n\nNos vemos em breve 💛`;
        break;
      case 'CANCELLED':
        msg = `Seu agendamento foi cancelado.\nSe desejar, reagende facilmente:\nhttps://usenera.com/p/${mockData.professionalSlug}`;
        break;
      case 'REMINDER_24H':
        msg = `✨ *Lembrete do seu atendimento amanhã:*\n\n${mockData.serviceName}\n${formattedDate}\n${mockData.time}\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença`;
        break;
      case 'REMINDER_2H':
        msg = `Estamos te esperando hoje às ${mockData.time} 💛`;
        break;
      case 'REVIEW':
        msg = `Obrigada por agendar com ${mockData.professionalName} 💛. Sua opinião é muito importante para nós. Se puder, deixe sua avaliação: ${mockData.reviewUrl}`;
        break;
      default:
        msg = "Teste de WhatsApp do sistema Nera 🚀";
    }
  }

  try {
    const result = await sendWhatsApp(db, targetPhone, msg, { 
      userId: 'system_test',
      type: `simulated_${eventType}`,
      metadata: { isSimulation: true }
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/zapi/webhook", async (req, res) => {
  const webhookToken = process.env.ZAPI_WEBHOOK_TOKEN;
  const isProduction = process.env.NODE_ENV === "production";

  if (!webhookToken) {
    if (isProduction) {
      logger.error("WHATSAPP", "Security Error: ZAPI_WEBHOOK_TOKEN is not configured in production environment.");
      return res.status(503).json({ error: "Service unavailable due to misconfiguration" });
    } else {
      logger.warn("WHATSAPP", "ZAPI_WEBHOOK_TOKEN is not configured. Bypassing authentication in non-production environment.");
    }
  } else {
    const receivedToken = req.headers["client-token"] || req.headers["x-zapi-token"];
    if (!receivedToken || receivedToken !== webhookToken) {
      logger.warn("WHATSAPP", "Unauthorized webhook access attempt", {
        hasHeader: !!receivedToken,
        tokenLength: receivedToken ? String(receivedToken).length : 0
      });
      return res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
    }
  }

  const db = getDb();
  const payload = req.body;
  const messageId = payload.messageId || payload.id;
  const isMessage = payload.type === 'on-message-received' || (payload.phone && payload.text);

  logger.info("WHATSAPP", "Z-API Webhook received", {
   requestId: req.requestId,
   meta: {
     type: payload.type,
     hasPhone: !!payload.phone,
     hasMessageId: !!messageId,
     isMessage
   }
  });

  if (isMessage) {
    const phone = payload.phone;
    const message = payload.text?.message || payload.text || "";
    
    if (phone && message) {
      handleInboundMessage(db, phone, message, payload).catch(err => {
        logger.error("WHATSAPP", "Error processing message", {
          requestId: req.requestId,
          error: err,
          meta: { phone: maskPhone(phone), messageId }
        });
      });
    }
  }
  res.status(200).send("OK");
});

router.get("/debug-whatsapp", debugOnly, async (req, res) => {
  res.json({
    zapiInstanceId: !!process.env.ZAPI_INSTANCE_ID,
    zapiInstanceToken: !!process.env.ZAPI_INSTANCE_TOKEN || !!process.env.ZAPI_TOKEN,
    zapiClientToken: !!process.env.ZAPI_CLIENT_TOKEN,
    zapiBaseUrl: !!process.env.ZAPI_BASE_URL,
    metaAccessToken: !!process.env.META_ACCESS_TOKEN,
    phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    vapidPublicPresent: !!VAPID_PUBLIC_KEY,
    vapidPrivatePresent: !!VAPID_PRIVATE_KEY
  });
});

router.post("/push/subscribe", async (req, res) => {
  const db = getDb();
  const { subscription, userId, userAgent } = req.body;
  const authHeader = req.headers.authorization;

    
  if (!subscription || !userId) {
    logger.warn("PUSH", "Missing subscription or userId");
    return res.status(400).json({ error: "Missing subscription or userId" });
  }

  // Security check: Validate Firebase ID Token
  let verifiedUid = "";
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      verifiedUid = decodedToken.uid;
          } catch (err) {
      logger.error("PUSH", "Token verification failed", { error: err });
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  } else {
    logger.warn("PUSH", "Missing Authorization header");
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  // Ensure body userId matches token UID
  if (userId !== verifiedUid) {
    logger.warn("PUSH", "UID mismatch in push subscribe");
    return res.status(403).json({ error: "Forbidden: UID mismatch" });
  }

  const endpoint = subscription.endpoint;
  const keys = subscription.keys;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    logger.warn("PUSH", "Invalid subscription structure");
    return res.status(400).json({ error: "Invalid subscription structure: missing endpoint or keys (p256dh/auth)" });
  }

  try {
    const subscriptionId = Buffer.from(endpoint).toString('base64').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
        
    const docRef = db.collection('users').doc(userId).collection('push_subscriptions').doc(subscriptionId);
    
    const dataToSave = {
      subscription: {
        endpoint: endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth
        }
      },
      userAgent: userAgent || req.headers['user-agent'] || 'unknown',
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      (dataToSave as any).createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Save to user subcollection
    await docRef.set(dataToSave, { merge: true });

    // VERIFICATION: Check if saved
    const savedDoc = await docRef.get();
    if (!savedDoc.exists) {
      logger.error("PUSH", "Verification failed: Document was not saved");
      throw new Error("Subscription não foi salva no Firestore (users collection)");
    }

    // DEBUG COLLECTION: Save to a root level collection for easier debugging only in non-production
    if (process.env.NODE_ENV !== "production") {
      const maskedUserAgent = (userAgent || req.headers['user-agent'] || 'unknown').substring(0, 100);
      await db.collection('push_subscriptions_debug').doc(subscriptionId).set({
        userId,
        subscriptionId,
        createdAt: docSnap.exists ? (docSnap.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()) : admin.firestore.FieldValue.serverTimestamp(),
        userAgent: maskedUserAgent,
        environment: process.env.NODE_ENV || 'development',
        verified: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    logger.info("PUSH", "Push subscription saved successfully");
    res.status(201).json({ 
      success: true, 
      subscriptionId,
      path: `users/${userId}/push_subscriptions/${subscriptionId}`
    });
  } catch (error: any) {
    logger.error("PUSH", "Critical error during push subscribe", { error });
    res.status(500).json({ error: error.message });
  }
});

router.post("/notify", requireFirebaseAuth, notificationMutationLimiter, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const uid = authReq.uid;

  const db = getDb();
  const { type, payload } = req.body;

  const allowedTypes = [
    'BOOKING_PENDING_CLIENT',
    'NEW_BOOKING_REQUEST',
    'BOOKING_REJECTED',
    'BOOKING_CANCELLED',
    'BOOKING_CANCELLED_BY_CLIENT',
    'BOOKING_CONFIRMED',
    'BOOKING_RESCHEDULED_BY_CLIENT',
    'BOOKING_RESCHEDULED',
    'BOOKING_RESCHEDULED_BY_PROFESSIONAL',
    'WAITLIST_ACCEPTED_PROFESSIONAL',
    'WAITLIST_INVITATION',
    'WAITLIST_SLOT_OPENED'
  ];

  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo de notificação inválido ou desconhecido: ${type}` });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: "O corpo da requisição deve conter um objeto 'payload'." });
  }

  const baseUrl = PUBLIC_APP_URL;

  // Idempotency check helper using the whatsapp_logs collection
  const checkIdempotency = async (key: string) => {
    const rootSnap = await db.collection('whatsapp_logs')
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (!rootSnap.empty) return true;

    const metaSnap = await db.collection('whatsapp_logs')
      .where('metadata.idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (!metaSnap.empty) return true;

    return false;
  };

  try {
    let safePayload: any = {};
    let pro: any = {};

    if (type.startsWith('BOOKING_')) {
      const appointmentId = payload.appointmentId || payload.id;
      if (!appointmentId || typeof appointmentId !== 'string') {
        return res.status(400).json({ error: "O campo 'appointmentId' é obrigatório para eventos do tipo BOOKING_*." });
      }

      const apptDoc = await db.collection('appointments').doc(appointmentId).get();
      if (!apptDoc.exists) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      const apptData = apptDoc.data();
      if (!apptData) {
        return res.status(500).json({ error: "Erro ao ler dados do agendamento." });
      }

      if (apptData.professionalId !== uid) {
        return res.status(403).json({ error: "Acesso negado: Você não é o profissional deste agendamento." });
      }

      // Fetch professional user details
      const proDoc = await db.collection('users').doc(uid).get();
      if (!proDoc.exists) {
        return res.status(404).json({ error: `Profissional ${uid} não encontrado.` });
      }
      pro = proDoc.data() || {};

      // Map safePayload from apptData and pro (never trusting the incoming payload for sensitive fields or controls)
      safePayload = {
        appointmentId,
        professionalId: uid,
        clientName: apptData.clientName || 'Cliente',
        clientEmail: apptData.clientEmail || '',
        clientWhatsapp: apptData.clientWhatsapp || apptData.clientPhone || apptData.phone || '',
        serviceName: apptData.serviceName || 'Serviço',
        date: apptData.date || '',
        time: apptData.time || '',
        price: apptData.price || apptData.totalPrice || 0,
        totalPrice: apptData.totalPrice || apptData.price || 0,
        reservationCode: apptData.reservationCode || apptData.id || appointmentId,
        manageSlug: apptData.manageSlug || apptData.id || appointmentId,
        paymentMethods: apptData.paymentMethods || [],
        locationDetail: apptData.locationDetail || '',
        neighborhood: apptData.neighborhood || '',
        reason: apptData.cancellationReason || apptData.reason || 'Não informado',
        previousDate: apptData.previousDate || '',
        previousTime: apptData.previousTime || '',
        rescheduledBy: apptData.rescheduledBy || (type === 'BOOKING_RESCHEDULED_BY_CLIENT' ? 'client' : 'professional'),
        professionalSlug: pro.slug || ''
      };
    } else if (type.startsWith('WAITLIST_')) {
      const waitlistEntryId = payload.waitlistEntryId || payload.id || payload.candidateId;
      if (!waitlistEntryId || typeof waitlistEntryId !== 'string') {
        return res.status(400).json({ error: "O campo 'waitlistEntryId' (ou id/candidateId) é obrigatório para eventos do tipo WAITLIST_*." });
      }

      const waitlistDoc = await db.collection('waitlist').doc(waitlistEntryId).get();
      if (!waitlistDoc.exists) {
        return res.status(404).json({ error: "Entrada na lista de espera não encontrada." });
      }

      const waitlistData = waitlistDoc.data();
      if (!waitlistData) {
        return res.status(500).json({ error: "Erro ao ler dados da lista de espera." });
      }

      if (waitlistData.professionalId !== uid) {
        return res.status(403).json({ error: "Acesso negado: Você não é o profissional desta lista de espera." });
      }

      // Fetch professional user details
      const proDoc = await db.collection('users').doc(uid).get();
      if (!proDoc.exists) {
        return res.status(404).json({ error: `Profissional ${uid} não encontrado.` });
      }
      pro = proDoc.data() || {};

      // Map safePayload from waitlistData and pro without raw payload inputs
      safePayload = {
        id: waitlistEntryId,
        waitlistEntryId,
        professionalId: uid,
        clientName: waitlistData.clientName || 'Cliente',
        clientEmail: waitlistData.clientEmail || '',
        clientWhatsapp: waitlistData.clientWhatsapp || '',
        serviceName: waitlistData.serviceName || 'Serviço',
        requestedDate: waitlistData.requestedDate || '',
        date: waitlistData.requestedDate || '',
        assignedTime: waitlistData.assignedTime || waitlistData.preferredTime || '',
        time: waitlistData.assignedTime || waitlistData.preferredTime || '',
        candidateName: waitlistData.clientName || 'Cliente',
        candidateId: waitlistEntryId,
        professionalName: pro.name || 'Profissional',
        professionalSlug: pro.slug || ''
      };
    }

    if (type === 'BOOKING_PENDING_CLIENT') {
      const eventKey = 'bookingPendingClient';
      const appointmentId = safePayload.appointmentId;
      const professionalName = pro.name || 'Profissional';
      const professionalWhatsapp = pro.whatsapp || pro.phone || '';
      const manageUrl = `${baseUrl}/p/${safePayload.professionalSlug}?appointmentId=${appointmentId}`;

      if (await shouldSendEmail(appointmentId, eventKey)) {
        const result = await sendBookingPendingEmail({
          clientEmail: safePayload.clientEmail,
          clientName: safePayload.clientName,
          professionalName,
          professionalWhatsapp,
          serviceName: safePayload.serviceName,
          date: safePayload.date,
          time: safePayload.time,
          price: safePayload.price,
          reservationCode: safePayload.reservationCode,
          manageUrl,
          appointmentId,
          paymentMethods: safePayload.paymentMethods
        });
        if (result.success) await markEmailSent(appointmentId, eventKey);
        return res.json(result);
      }
      return res.json({ success: true, skipped: 'duplicate' });
    }

    if (type === 'NEW_BOOKING_REQUEST') {
      const eventKey = 'professionalNewBooking';
      const appointmentId = safePayload.appointmentId;
      const professionalId = safePayload.professionalId;
      const proEmail = pro.email;
      const proPhone = pro.whatsapp || pro.phone;

      if (proEmail && await shouldSendEmail(appointmentId, eventKey)) {
        const cleanPhone = safePayload.clientWhatsapp ? safePayload.clientWhatsapp.replace(/\D/g, '') : '';
        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : undefined;

        const result = await sendProfessionalNewBookingEmail({
          professionalEmail: proEmail,
          professionalName: pro.name || 'Profissional',
          clientName: safePayload.clientName,
          serviceName: safePayload.serviceName,
          date: safePayload.date,
          time: safePayload.time,
          price: `R$ ${(safePayload.totalPrice || 0).toFixed(2).replace('.', ',')}`,
          location: safePayload.locationDetail || safePayload.neighborhood || 'Estúdio',
          agendaUrl: `${baseUrl}/pedidos`,
          appointmentId,
          paymentMethods: safePayload.paymentMethods,
          clientWhatsapp: safePayload.clientWhatsapp || 'Não informado',
          whatsappUrl: waUrl
        });
        if (result.success) await markEmailSent(appointmentId, eventKey);
      }

      if (proPhone) {
        const idempotencyKey = `NEW_BOOKING_REQUEST:${appointmentId}:${safePayload.date}:${safePayload.time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const formattedDate = safePayload.date ? safePayload.date.split('-').reverse().join('/') : '';
          const msg = buildNewBookingMessageForPro({
            profissionalNome: pro.name || 'Profissional',
            servicoNome: safePayload.serviceName,
            data: formattedDate,
            horario: safePayload.time,
            clienteNome: safePayload.clientName,
            clienteWhatsApp: safePayload.clientWhatsapp || 'Não informado',
            local: safePayload.locationDetail || safePayload.neighborhood || 'Estúdio',
            linkManage: `${baseUrl}/pedidos?appointmentId=${appointmentId}`
          });

          await sendWhatsApp(db, proPhone, msg, {
            appointmentId,
            userId: professionalId,
            type: 'professional_new_booking',
            clientName: safePayload.clientName,
            clientWhatsapp: safePayload.clientWhatsapp,
            idempotencyKey
          });
        }
      }

      // Trigger Web Push Notification
      await sendPushToUser(professionalId, {
        title: "Nova reserva!",
        body: `${safePayload.clientName} quer ${safePayload.serviceName} em ${safePayload.date} às ${safePayload.time}`,
        icon: "/icon-192.png",
        data: {
          url: "/pedidos"
        }
      });

      return res.json({ success: true });
    }

    if (type === 'BOOKING_REJECTED') {
      const professionalId = safePayload.professionalId;
      const appointmentId = safePayload.appointmentId;
      const clientWhatsapp = safePayload.clientWhatsapp;

      if (clientWhatsapp) {
        const idempotencyKey = `BOOKING_REJECTED:${appointmentId}:${safePayload.date}:${safePayload.time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const activeSlug = (safePayload.professionalSlug || "").trim();
          const profileLink = (activeSlug && activeSlug !== "app") ? `${baseUrl}/p/${activeSlug}` : baseUrl;
          const formattedDate = safePayload.date.split('-').reverse().join('/');
          const msg = buildBookingRejectedMessageForClient({
            clientName: safePayload.clientName,
            serviceName: safePayload.serviceName,
            date: formattedDate,
            time: safePayload.time,
            professionalPageUrl: profileLink
          });
          
          await sendWhatsApp(db, clientWhatsapp, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_rejected',
            clientName: safePayload.clientName,
            clientWhatsapp,
            idempotencyKey
          });
        }
      }
      return res.json({ success: true });
    }

    if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_CANCELLED_BY_CLIENT') {
      const appointmentId = safePayload.appointmentId;
      const professionalId = safePayload.professionalId;
      const date = safePayload.date;
      const time = safePayload.time;
      const clientName = safePayload.clientName;
      const clientWhatsapp = safePayload.clientWhatsapp;
      const clientEmail = safePayload.clientEmail;
      const serviceName = safePayload.serviceName;

      // CREATE LAST MINUTE ALERT IF APPLICABLE
      await createLastMinuteAlert(safePayload);

      const eventKeyPro = 'bookingCancelledProfessional';
      const eventKeyClient = 'bookingCancelledClient';

      const proPhone = pro.whatsapp;
      const waitlistSnap = await db.collection('waitlist')
        .where('professionalId', '==', professionalId)
        .where('requestedDate', '==', date)
        .where('status', '==', 'waiting')
        .get();
      const waitlistCount = waitlistSnap.size;
      const activeSlug = (safePayload.professionalSlug || "").trim();
      const profileUrl = (activeSlug && activeSlug !== "app") ? `${baseUrl}/p/${activeSlug}` : baseUrl;

      if (proPhone) {
        const idempotencyKeyPro = `BOOKING_CANCELLED_PRO:${appointmentId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKeyPro))) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Horário liberado! 🗓️\n\nA reserva de ${clientName} em ${formattedDate} às ${time} foi CANCELADA. Seu horário ficou disponível novamente.`;
          await sendWhatsApp(db, proPhone, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_cancelled_pro',
            clientName,
            clientWhatsapp,
            idempotencyKey: idempotencyKeyPro
          });
        }
      }

      if (pro.email && await shouldSendEmail(appointmentId, eventKeyPro)) {
        const result = await sendBookingCancelledEmail({
          clientName, serviceName, date, time, 
          location: '', professionalEmail: pro.email,
          professionalName: pro.name, bookingId: appointmentId || '',
          cancellationReason: safePayload.reason,
          waitlistCount,
          profileUrl
        });
        if (result.success) await markEmailSent(appointmentId, eventKeyPro);
      }

      if (clientWhatsapp) {
        const idempotencyKeyClient = `BOOKING_CANCELLED_CLIENT:${appointmentId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKeyClient))) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = buildCancellationMessage({
            serviceName: serviceName,
            date: formattedDate,
            time: time,
            professionalPageUrl: profileUrl
          });
          await sendWhatsApp(db, clientWhatsapp, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_cancelled_client',
            clientName,
            clientWhatsapp,
            idempotencyKey: idempotencyKeyClient
          });
        }
      }

      if (clientEmail && await shouldSendEmail(appointmentId, eventKeyClient)) {
         const result = await sendBookingCancelledClientEmail({
            clientName, serviceName, date, time,
            location: '', clientEmail, 
            professionalName: pro.name || 'Sua Profissional', bookingId: appointmentId || '',
            profileUrl, cancellationReason: safePayload.reason
         });
         if (result.success) await markEmailSent(appointmentId, eventKeyClient);
      }
      
      // Delete Google Calendar Event
      const apptDoc = await db.collection('appointments').doc(appointmentId).get();
      if (apptDoc.exists) {
        const apptData = apptDoc.data();
        if (apptData?.googleCalendarEventId) {
          deleteGoogleCalendarEvent({ id: appointmentId, ...apptData }, professionalId);
        }
      }
      return res.json({ success: true });
    }

    if (type === 'BOOKING_CONFIRMED') {
      const appointmentId = safePayload.appointmentId;
      const professionalId = safePayload.professionalId;
      const clientWhatsapp = safePayload.clientWhatsapp;

      if (clientWhatsapp) {
        const idempotencyKey = `BOOKING_CONFIRMED:${appointmentId}:${safePayload.date}:${safePayload.time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const formattedDate = safePayload.date.split('-').reverse().join('/');
          const msg = buildBookingConfirmedMessageForClient({
            serviceName: safePayload.serviceName,
            professionalName: pro.name || 'Sua Profissional',
            date: formattedDate,
            time: safePayload.time,
            local: safePayload.locationDetail || safePayload.neighborhood || 'Estúdio',
            linkManage: buildPublicBookingUrl(safePayload.manageSlug || appointmentId)
          });
          
          await sendWhatsApp(db, clientWhatsapp, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_confirmed_client',
            clientName: safePayload.clientName,
            clientWhatsapp,
            idempotencyKey
          });
        }
      }

      return res.json({ success: true, emailTriggered: 'background' });
    }

    if (type === 'BOOKING_RESCHEDULED_BY_CLIENT' || type === 'BOOKING_RESCHEDULED' || type === 'BOOKING_RESCHEDULED_BY_PROFESSIONAL') {
      const appointmentId = safePayload.appointmentId;
      const professionalId = safePayload.professionalId;
      const clientName = safePayload.clientName;
      const clientEmail = safePayload.clientEmail;
      const previousDate = safePayload.previousDate;
      const previousTime = safePayload.previousTime;
      const date = safePayload.date;
      const time = safePayload.time;
      const serviceName = safePayload.serviceName;
      const rescheduledBy = safePayload.rescheduledBy;

      const proPhone = pro.whatsapp;
      
      // Notify professional via WhatsApp ONLY if CLIENT rescheduled
      if (proPhone && rescheduledBy === 'client') {
        const idempotencyKeyPro = `BOOKING_RESCHEDULED_PRO:${appointmentId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKeyPro))) {
          const oldFormatted = previousDate ? previousDate.split('-').reverse().join('/') : '';
          const newFormatted = date.split('-').reverse().join('/');
          
          const msg = `🚨 *Alteração de Horário!* \n\n${clientName} REAGENDOU o atendimento:\n\n` +
                      `De: ${oldFormatted} às ${previousTime}\n` +
                      `Para: *${newFormatted} às ${time}*\n\n` +
                      `O horário antigo foi liberado automaticamente. Confira no Dashboard: \n${baseUrl}/dashboard`;

          await sendWhatsApp(db, proPhone, msg, {
            userId: professionalId,
            appointmentId,
            clientName,
            clientWhatsapp: safePayload.clientWhatsapp || '',
            type: 'booking_rescheduled_pro',
            idempotencyKey: idempotencyKeyPro
          });
        }
      }

      if (pro.email && rescheduledBy === 'client') {
        const eventKeyPro = `bookingRescheduledPro_${appointmentId}_${date}_${time}`;
        if (await shouldSendEmail(appointmentId, eventKeyPro)) {
          const oldFormatted = previousDate ? previousDate.split('-').reverse().join('/') : '';
          const newFormatted = date.split('-').reverse().join('/');
          const result = await sendProfessionalBookingRescheduledEmail({
            professionalEmail: pro.email,
            professionalName: pro.name || 'Sua Profissional',
            clientName,
            serviceName,
            oldFormatDate: oldFormatted,
            oldTime: previousTime,
            newFormatDate: newFormatted,
            newTime: time,
            agendaUrl: `${baseUrl}/dashboard`
          });
          if (result.success) await markEmailSent(appointmentId, eventKeyPro);
        }
      }

      if (clientEmail) {
        const eventKey = `bookingRescheduledClient_${appointmentId}_${date}_${time}`;
        if (await shouldSendEmail(appointmentId, eventKey)) {
          const result = await sendBookingRescheduledEmail({
            clientEmail, 
            clientName, 
            professionalName: pro.name || 'Sua Profissional',
            serviceName, 
            oldDate: previousDate, 
            oldTime: previousTime,
            newDate: date, 
            newTime: time, 
            appointmentId,
            rescheduledBy
          });
          if (result.success) await markEmailSent(appointmentId, eventKey);
        }
      }

      // Notify client via WhatsApp ONLY if PROFESSIONAL rescheduled
      if (safePayload.clientWhatsapp && rescheduledBy === 'professional') {
        const idempotencyKeyClient = `BOOKING_RESCHEDULED_CLIENT:${appointmentId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKeyClient))) {
          const newFormatted = date.split('-').reverse().join('/');
          const msg = buildRescheduledByProMessageForClient({
            clientName,
            date: newFormatted,
            time,
            serviceName,
            professionalName: pro.name || 'Sua Profissional',
            oldDate: previousDate ? previousDate.split('-').reverse().join('/') : undefined,
            oldTime: previousTime,
            manageBookingUrl: buildPublicBookingUrl(safePayload.manageSlug || appointmentId)
          });
          const result = await sendWhatsApp(db, safePayload.clientWhatsapp, msg, {
            userId: professionalId,
            appointmentId,
            clientName,
            clientWhatsapp: safePayload.clientWhatsapp,
            type: 'booking_rescheduled_client',
            idempotencyKey: idempotencyKeyClient
          });
          if (!result.success) logger.error("WHATSAPP", "Failed to send reschedule WhatsApp", { result });
        }
      }
      
      // Update Google Calendar Event
      const apptDoc = await db.collection('appointments').doc(appointmentId).get();
      if (apptDoc.exists) {
        const apptData = apptDoc.data();
        if (apptData?.googleCalendarEventId) {
          updateGoogleCalendarEvent({ id: appointmentId, ...apptData }, professionalId);
        }
      }
      return res.json({ success: true });
    }

    if (type === 'WAITLIST_ACCEPTED_PROFESSIONAL') {
      const waitlistEntryId = safePayload.waitlistEntryId;
      const professionalId = safePayload.professionalId;
      const clientName = safePayload.clientName;
      const date = safePayload.date;
      const time = safePayload.time;

      if (pro.whatsapp) {
        const idempotencyKey = `WAITLIST_ACCEPTED_PROFESSIONAL:${waitlistEntryId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Ótima notícia!\n\n${clientName} aceitou o horário liberado para ${formattedDate} às ${time}.\n\nO agendamento já foi confirmado e entrou automaticamente na sua agenda.`;
          
          await sendWhatsAppMeta(pro.whatsapp, msg, {
            userId: professionalId,
            type: 'waitlist_accepted_professional',
            appointmentId: waitlistEntryId,
            clientName,
            idempotencyKey
          });
        }
      }
      return res.json({ success: true });
    }

    if (type === 'WAITLIST_INVITATION') {
      const waitlistEntryId = safePayload.waitlistEntryId;
      const clientWhatsapp = safePayload.clientWhatsapp;
      const clientEmail = safePayload.clientEmail;
      const clientName = safePayload.clientName;
      const date = safePayload.date;
      const time = safePayload.time;
      const serviceName = safePayload.serviceName;
      const professionalName = pro.name || 'Profissional';
      const professionalSlug = pro.slug || '';

      const formattedDate = date.split('-').reverse().join('/');
      const waitlistInviteUrl = `${baseUrl}/p/${professionalSlug || 'perfil'}?w=${waitlistEntryId}`;

      if (clientEmail) {
        await sendWaitlistInviteEmail({
          clientName,
          clientEmail,
          professionalName,
          date: formattedDate,
          time,
          serviceName: serviceName || 'Serviço',
          bookingUrl: waitlistInviteUrl,
          expiresInHours: 0.25, // 15 mins default
        }).catch((e) => logger.error("EMAIL", "Failed to send waitlist email", { error: e }));
      }
      
      if (clientWhatsapp) {
        const idempotencyKey = `WAITLIST_INVITATION:${waitlistEntryId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const msg = buildWaitlistInviteMessage({
            serviceName: serviceName || 'serviço',
            date: formattedDate,
            time,
            professionalName,
            waitlistInviteUrl
          });
          
          await sendWhatsAppMeta(clientWhatsapp, msg, {
            userId: safePayload.professionalId, 
            appointmentId: waitlistEntryId,
            clientName,
            clientWhatsapp,
            type: 'waitlist_invitation',
            idempotencyKey
          });
        }
      }
      return res.json({ success: true });
    }

    if (type === 'WAITLIST_SLOT_OPENED') {
      const waitlistEntryId = safePayload.waitlistEntryId;
      const professionalId = safePayload.professionalId;
      const date = safePayload.date;
      const time = safePayload.time;
      const candidateName = safePayload.candidateName;

      if (pro.whatsapp) {
        const idempotencyKey = `WAITLIST_SLOT_OPENED:${waitlistEntryId}:${date}:${time}`;
        if (!(await checkIdempotency(idempotencyKey))) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Vaga na lista de espera! 🗓️\n\nO horário de ${time} (${formattedDate}) ficou disponível e ${candidateName} está aguardando.\n\nConfira no seu Dashboard: \n${baseUrl}/dashboard`;
          
          await sendWhatsAppMeta(pro.whatsapp, msg, {
            userId: professionalId,
            clientName: candidateName,
            type: 'waitlist_slot_opened',
            appointmentId: waitlistEntryId,
            idempotencyKey
          });
        }
      }
      return res.json({ success: true });
    }

    res.json({ success: true, message: "Type processed or ignored." });

  } catch (error: any) {
    logger.error("NOTIFICATION", "Notification Service Error", { error });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/cron/reminders24h', requireCronSecret, async (req, res) => {
  const db = getDb();
  const startTime = Date.now();
  let processedCount = 0;
  let sentCount = 0;
  let failedCount = 0;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    logger.info("CRON", "Starting 24h reminders & confirmations", { meta: { event: "cron_start", type: "reminders24h" } });

    const snap = await db.collection('appointments')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'confirmed')
      .get();
    
    processedCount = snap.size;
    const appUrl = PUBLIC_APP_URL;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      
      const proSnap = await db.collection('users').doc(appt.professionalId).get();
      if (!proSnap.exists) continue;
      const pro = proSnap.data();

      // Only send if not confirmed yet
      if (appt.clientConfirmed24h) continue;

      if (appt.clientEmail) {
        const eventKey = 'confirmationRequest24h';
        if (await shouldSendEmail(apptId, eventKey)) {
          const result = await sendConfirmationRequest24hEmail({
            clientEmail: appt.clientEmail,
            clientName: appt.clientName,
            professionalName: pro?.name || 'Profissional',
            serviceName: appt.serviceName,
            date: appt.date,
            time: appt.time,
            confirmUrl: `${buildPublicBookingUrl(apptId)}?action=confirm-presence`,
            rescheduleUrl: `${buildPublicBookingUrl(apptId)}?action=reschedule`,
            cancelUrl: `${buildPublicBookingUrl(apptId)}?action=cancel`,
            appointmentId: apptId
          });
          
          if (result.success) {
            await markEmailSent(apptId, eventKey);
            await docSnap.ref.update({
              status: 'pending_confirmation',
              reminder24hSentAt: admin.firestore.FieldValue.serverTimestamp() // Keep for history compatibility
            });
            sentCount++;
          } else {
            failedCount++;
          }
        }
      }

      const plan = pro?.plan || 'free';
      const expiresAt = pro?.planExpiresAt;
      const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
      const activePlan = isExpired ? 'free' : plan;

      if (activePlan === 'pro' && appt.clientWhatsapp && !appt.reminder24hWhatsappSentAt) {
        const [y, m, d] = appt.date.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
        const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const diaSemana = weekdays[dateObj.getDay()];

        const msg = buildReminderMessage24h({
          serviceName: appt.serviceName,
          time: appt.time,
          professionalName: pro?.name || 'Profissional',
          manageBookingUrl: buildPublicBookingUrl(appt.manageSlug || apptId)
        });

        const result = await sendWhatsApp(db, appt.clientWhatsapp, msg, {
          appointmentId: apptId,
          userId: appt.professionalId,
          type: 'reminder_24h',
          clientName: appt.clientName,
          clientWhatsapp: appt.clientWhatsapp
        });

        if (result.success) {
          const updates: any = {
            reminder24hWhatsappSentAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (docSnap.data().status !== 'pending_confirmation') {
            updates.status = 'pending_confirmation';
          }
          await docSnap.ref.update(updates);
          sentCount++;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info("CRON", "Finished 24h reminders & confirmations", { meta: { event: "cron_finish", type: "reminders24h", durationMs, processedCount, sentCount, failedCount } });
    res.json({ success: true, processed: processedCount, sent: sentCount, failed: failedCount, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    logger.error("CRON", "Error on reminders24h", { error: err, meta: { durationMs, processedCount, sentCount } });
    res.status(500).json({ error: String(err) });
  }
});

router.get('/cron/reminders2h', requireCronSecret, async (req, res) => {
  // Desabilitado temporariamente por decisão de produto (evitar spam/mensagem invasiva)
  return res.json({ success: true, sent: 0, message: "Lembrete 2h desabilitado temporariamente" });

  const db = getDb();

  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    const snap = await db.collection('appointments')
      .where('date', '==', today)
      .where('status', '==', 'confirmed')
      .where('reminder2hSentAt', '==', null)
      .get();

    let sentCount = 0;
    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      
      const [hours, minutes] = appt.time.split(':').map(Number);
      const apptTime = new Date();
      apptTime.setHours(hours, minutes, 0, 0);

      const diffMinutes = (apptTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes > 90 && diffMinutes < 150) {
        if (appt.clientWhatsapp) {
          const proSnap = await db.collection('users').doc(appt.professionalId).get();
          const pro = proSnap.data() as any;
          const plan = pro?.plan || 'free';
          const expiresAt = pro?.planExpiresAt;
          const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
          const activePlan = isExpired ? 'free' : plan;

          if (activePlan === 'pro') {
            const msg = `Estamos te esperando hoje às ${appt.time} 💛`;
            const result = await sendWhatsApp(db, appt.clientWhatsapp, msg, {
              appointmentId: apptId,
              userId: appt.professionalId,
              type: 'reminder_2h',
              clientName: appt.clientName,
              clientWhatsapp: appt.clientWhatsapp
            });

            if (result.success) {
              await docSnap.ref.update({
                reminder2hSentAt: admin.firestore.FieldValue.serverTimestamp()
              });
              sentCount++;
            }
          }
        }
      }
    }

    res.json({ success: true, sent: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cron/review-requests', requireCronSecret, async (req, res) => {
  const db = getDb();

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const snap = await db.collection('appointments')
      .where('date', '==', yesterdayStr)
      .where('status', '==', 'completed')
      .where('reviewRequestedAt', '==', null)
      .get();

    let sentCount = 0;
    const baseUrl = PUBLIC_APP_URL;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      const clientPhone = appt.clientWhatsapp;

      if (clientPhone) {
        const proSnap = await db.collection('users').doc(appt.professionalId).get();
        const pro = proSnap.data() as any;
        const plan = pro?.plan || 'free';
        const expiresAt = pro?.planExpiresAt;
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
        const activePlan = isExpired ? 'free' : plan;

        const token = generateSecureToken(24);
        const reviewUrl = `${baseUrl}/review/${token}`;
        
        await db.collection('review_requests').doc(token).set({
          professionalId: appt.professionalId,
          professionalName: pro?.name || appt.professionalName || 'Sua Profissional',
          professionalAvatar: pro?.avatar || pro?.photoUrl || '',
          bookingId: apptId,
          token,
          status: 'pending',
          clientDisplayName: appt.clientName,
          clientNeighborhood: appt.neighborhood || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Review requests are intentionally sent by email only to avoid spam-like WhatsApp experience.
        let sent = false; // Kept for compatibility with later logic

        if (appt.clientEmail) {
          const eventKey = 'reviewRequestClient';
          if (await shouldSendEmail(apptId, eventKey)) {
            const result = await sendReviewRequestEmail({
              clientName: appt.clientName,
              serviceName: appt.serviceName,
              date: appt.date,
              time: appt.time,
              location: appt.locationDetail || appt.address || appt.neighborhood || 'Local não informado',
              professionalName: appt.professionalName,
              professionalEmail: '', 
              clientEmail: appt.clientEmail,
              bookingId: apptId,
              reviewUrl
            });
            if (result.success) {
              await markEmailSent(apptId, eventKey);
              sent = true;
            }
          }
        }

        if (sent || appt.clientEmail) {
          await docSnap.ref.update({
            reviewRequestedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sentCount++;
        }
      }
    }

    res.json({ success: true, date: yesterdayStr, sent: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});



router.get('/cron/retention', requireCronSecret, async (req, res) => {
  const db = getDb();

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const snap = await db.collection('appointments')
      .where('date', '==', thirtyDaysAgoStr)
      .where('status', 'in', ['confirmed', 'completed'])
      .where('retentionSent', '!=', true)
      .get();
    
    let sentCount = 0;
    const appUrl = PUBLIC_APP_URL;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      
      const futureSnap = await db.collection('appointments')
        .where('clientEmail', '==', appt.clientEmail)
        .where('date', '>', thirtyDaysAgoStr)
        .limit(1)
        .get();
      
      if (futureSnap.empty) {
        if (appt.clientEmail) {
          const eventKey = 'retention30d';
          if (await shouldSendEmail(docSnap.id, eventKey)) {
            const result = await sendRetentionEmail({
              clientEmail: appt.clientEmail,
              clientName: appt.clientName,
              professionalName: appt.professionalName || 'Profissional',
              serviceName: appt.serviceName,
              bookingUrl: `${appUrl}/p/${appt.professionalSlug || ''}`,
              appointmentId: docSnap.id
            });
            
            if (result.success) {
              await markEmailSent(docSnap.id, eventKey);
              await docSnap.ref.update({
                retentionSent: true,
                retentionSentAt: admin.firestore.FieldValue.serverTimestamp()
              });
              sentCount++;
            }
          }
        }
      } else {
        await docSnap.ref.update({
          retentionSent: true
        });
      }
    }

    res.json({ success: true, processed: snap.size, sent: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/cron/daily-digest', requireCronSecret, async (req, res) => {
  const db = getDb();

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // We get all appointments for today
    const snap = await db.collection('appointments')
      .where('date', '==', todayStr)
      .get();
      
    // Group active appointments by professional
    const proAppointments: Record<string, any[]> = {};
    for (const doc of snap.docs) {
      const appt = doc.data();
      if (appt.status === 'cancelled' || appt.status === 'rejected') continue;
      if (!appt.professionalId) continue;
      
      if (!proAppointments[appt.professionalId]) {
        proAppointments[appt.professionalId] = [];
      }
      proAppointments[appt.professionalId].push(appt);
    }
    
    let sentCount = 0;
    const appUrl = PUBLIC_APP_URL;

    // Send digest for each professional
    for (const [proId, appts] of Object.entries(proAppointments)) {
      const proSnap = await db.collection('users').doc(proId).get();
      if (!proSnap.exists) continue;
      const pro = proSnap.data();
      
      if (!pro?.email) continue;
      
      const eventKey = `dailyDigest_${todayStr}`;
      // Just check if we already flagged in a daily log to avoid fetching all the daily metrics again
      // We can use a general check but let's use a config doc per professional: users/{proId}/emailLogs/dailyDigest
      const logRef = db.collection('users').doc(proId).collection('emailLogs').doc(eventKey);
      const logSnap = await logRef.get();
      if (logSnap.exists) continue;

      let confirmedCount = 0;
      let pendingCount = 0;
      let earliestTime = '23:59';
      
      for (const appt of appts) {
        if (appt.status === 'confirmed' || appt.status === 'completed') confirmedCount++;
        else if (appt.status === 'pending' || appt.status === 'pending_confirmation') pendingCount++;
        
        if (appt.time && appt.time < earliestTime) {
          earliestTime = appt.time;
        }
      }
      
      if (earliestTime === '23:59') earliestTime = '';

      const result = await sendDailyDigestEmail({
        professionalEmail: pro.email,
        professionalName: pro.name || 'Profissional',
        confirmedCount,
        pendingCount,
        firstAppointmentTime: earliestTime,
        totalAppointments: appts.length,
        agendaUrl: `${appUrl}/dashboard`
      });

      if (result.success) {
        await logRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp() });
        sentCount++;
      }
    }

    res.json({ success: true, activeProsFound: Object.keys(proAppointments).length, sent: sentCount });

  } catch (err: any) {
    logger.error("CRON", "Error on daily digest", { error: err });
    res.status(500).json({ error: String(err) });
  }
});

export default router;
