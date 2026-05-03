import express from "express";
import admin from "firebase-admin";
import { getDb } from "../firebaseAdmin.js";
import { 
  sendProfessionalNewBookingEmail,
  sendBookingPendingEmail,
  sendBookingConfirmedEmail,
  sendBookingCancelledEmail,
  sendBookingRescheduledEmail,
  sendBookingReminder24hEmail,
  sendReviewRequestEmail,
  sendConfirmationRequest24hEmail,
  sendRetentionEmail
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
      console.log(`[PUSH] No subscriptions found for professional ${professionalId}`);
      return;
    }

    const notificationPayload = JSON.stringify(payload);

    const promises = subscriptionsSnap.docs.map(doc => {
      const subscription = doc.data().subscription;
      return webpush.sendNotification(subscription, notificationPayload).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PUSH] Subscription expired or removed for ${doc.id}`);
          return doc.ref.delete();
        }
        console.error(`[PUSH] Error sending to ${doc.id}:`, err);
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error(`[PUSH] Error in sendPushToUser:`, error);
  }
}

/**
 * Creates an internal alert for last-minute cancellations (less than 2 hours).
 */
async function createLastMinuteAlert(payload: any): Promise<boolean> {
  const db = getDb();
  const { professionalId, clientName, serviceName, date, time, appointmentId } = payload;
  const apptId = appointmentId || payload.id;

  if (!professionalId || !date || !time || !apptId) {
    console.log('[ALERT] Missing data for last-minute check:', { professionalId, date, time, apptId });
    return false;
  }

  try {
    // Determine time difference
    // Note: This assumes server time and appointment time are in the same relative timezone
    const apptDate = new Date(`${date}T${time}`);
    const now = new Date();
    const diffMs = apptDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    console.log(`[ALERT] Cancellation check: ${diffHours.toFixed(2)}h until appointment ${apptId}`);

    // If cancellation is within 2 hours of the appointment
    if (diffHours > 0 && diffHours <= 2) {
      const alertId = `last_minute_${apptId}`;
      const alertRef = db.collection('alerts').doc(alertId);
      
      const alertSnap = await alertRef.get();
      if (alertSnap.exists) {
        console.log(`[ALERT] Alert already exists for ${apptId}`);
        return true;
      }

      // 1. Create Firestore alert
      try {
        await alertRef.set({
          professionalId,
          appointmentId: apptId,
          type: 'last_minute_cancellation',
          clientName: clientName || 'Cliente',
          serviceName: serviceName || 'Serviço',
          scheduledAt: `${date} ${time}`,
          hoursUntil: Math.round(diffHours * 10) / 10,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[ALERT] SUCCESS: Last-minute cancellation alert created for ${apptId}`);
      } catch (err) {
        console.error('[ALERT] Error creating Firestore alert:', err);
      }

      // 2. Fetch professional data for remaining notifications
      let proData: any = null;
      try {
        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          proData = proDoc.data();
        }
      } catch (err) {
        console.error('[ALERT] Error fetching professional data:', err);
      }

      // 3. Send WhatsApp notification
      if (proData?.whatsapp) {
        try {
          const msg = buildLastMinuteCancellationMessage({
            clienteNome: clientName || 'Cliente',
            servicoNome: serviceName || 'Serviço',
            horario: time,
            hoursUntil: Math.round(diffHours * 10) / 10
          });

          await sendWhatsApp(db, proData.whatsapp, msg, {
            appointmentId: apptId,
            userId: professionalId,
            type: 'last_minute_cancellation_pro'
          });
          console.log(`[ALERT] WhatsApp sent to professional for last-minute cancellation.`);
        } catch (err) {
          console.error('[ALERT] Error sending WhatsApp alert:', err);
        }
      }

      // 4. Send push notification
      try {
        await sendPushToUser(professionalId, {
          title: "🚨 Cancelamento de última hora!",
          body: `${clientName} cancelou ${serviceName} com menos de 2h de antecedência.`,
          icon: "/icon-192.png",
          data: { url: "/dashboard" }
        });
        console.log(`[ALERT] Push notification sent for last-minute cancellation.`);
      } catch (err) {
        console.error('[ALERT] Error sending push notification alert:', err);
      }

      return true;
    }
  } catch (err) {
    console.error('[ALERT] Error in createLastMinuteAlert process:', err);
  }
  return false;
}

import { 
  buildNewBookingMessageForPro, 
  buildBookingConfirmedMessageForClient, 
  buildReminderMessage24h, 
  buildWaitlistInviteMessage, 
  buildCancellationMessage, 
  buildLastMinuteCancellationMessage,
  buildReviewRequestMessage 
} from "../services/whatsappMessages.js";
import { shouldSendEmail, markEmailSent, sendWhatsAppMeta } from "../utils.js";
import { checkPlanFeature } from "../middleware/planMiddleware.js";

const router = express.Router();

router.get("/debug-email", async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Nera <agenda@usenera.com>";
  const appUrl = process.env.APP_URL;
  
  res.json({
    resendKeyPresent: !!apiKey,
    resendKeyPrefix: apiKey ? `${apiKey.substring(0, 5)}...` : 'N/A',
    from,
    appUrl: appUrl || `${req.protocol}://${req.get('host')}`,
    nodeEnv: process.env.NODE_ENV
  });
});

router.get("/test-email", async (req, res) => {
  console.log('[EMAIL] starting send (Test Endpoint)');
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
    console.error('[EMAIL] failed error (Test Endpoint):', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Mock for sendRawEmail which was deprecated in original server.ts
function sendRawEmailDraft(...args: any[]) { console.warn("sendRawEmail is deprecated"); return { success: false }; }

router.get("/test-email-real", async (req, res) => {
  const target = "matilefaco@hotmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Teste Nera funcionando",
    "Seu sistema de emails está ativo com domínio verificado."
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-email-gmail", async (req, res) => {
  const target = "matilefaco1@gmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Teste Nera GMAIL",
    "Teste de envio oficial para GMAIL através do sistema Nera."
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-email-hotmail-clean", async (req, res) => {
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

router.get("/test-email-hotmail-plain", async (req, res) => {
  const target = "matilefaco@hotmail.com";
  const result = await sendRawEmailDraft(
    target,
    "Confirmação Nera",
    "Seu agendamento no Nera foi confirmado com sucesso.",
    { isHtml: false }
  );
  res.status(result.success ? 200 : 500).json(result);
});

router.get("/test-whatsapp", async (req, res) => {
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
    reviewUrl: "https://nera.app/review/test"
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
        msg = `Seu agendamento foi cancelado.\nSe desejar, reagende facilmente:\nhttps://nera.app/p/${mockData.professionalSlug}`;
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
  const db = getDb();
  const payload = req.body;
  console.log("[Z-API Webhook] Received payload:", JSON.stringify(payload));

  if (payload.type === 'on-message-received' || (payload.phone && payload.text)) {
    const phone = payload.phone;
    const message = payload.text?.message || payload.text || "";
    
    if (phone && message) {
      handleInboundMessage(db, phone, message, payload).catch(err => {
        console.error("[Z-API Webhook] Error processing message:", err);
      });
    }
  }
  res.status(200).send("OK");
});

router.get("/debug-whatsapp", async (req, res) => {
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

  console.log("[PUSH SUBSCRIBE] START");
  console.log("[PUSH SUBSCRIBE] uid body:", userId);

  if (!subscription || !userId) {
    console.error("[PUSH SUBSCRIBE] Missing subscription or userId");
    return res.status(400).json({ error: "Missing subscription or userId" });
  }

  // Security check: Validate Firebase ID Token
  let verifiedUid = "";
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      verifiedUid = decodedToken.uid;
      console.log("[PUSH SUBSCRIBE] Token verified for UID:", verifiedUid);
    } catch (err) {
      console.error("[PUSH SUBSCRIBE] Token verification failed:", err);
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  } else {
    console.error("[PUSH SUBSCRIBE] Missing Authorization header");
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  // Ensure body userId matches token UID
  if (userId !== verifiedUid) {
    console.error(`[PUSH SUBSCRIBE] UID mismatch. Body: ${userId}, Token: ${verifiedUid}`);
    return res.status(403).json({ error: "Forbidden: UID mismatch" });
  }

  const endpoint = subscription.endpoint;
  const keys = subscription.keys;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    console.error("[PUSH SUBSCRIBE] Invalid subscription structure:", JSON.stringify(subscription));
    return res.status(400).json({ error: "Invalid subscription structure: missing endpoint or keys (p256dh/auth)" });
  }

  try {
    const subscriptionId = Buffer.from(endpoint).toString('base64').substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
    console.log("[PUSH SUBSCRIBE] Derived SubscriptionId:", subscriptionId);
    console.log("[PUSH SUBSCRIBE] saving at:", `users/${userId}/push_subscriptions/${subscriptionId}`);

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
      console.error("[PUSH SUBSCRIBE] Verification failed: Document was not saved in users collection");
      throw new Error("Subscription não foi salva no Firestore (users collection)");
    }

    // DEBUG COLLECTION: Save to a root level collection for easier debugging
    console.log("[PUSH SUBSCRIBE] saving to debug collection at:", `push_subscriptions_debug/${subscriptionId}`);
    await db.collection('push_subscriptions_debug').doc(subscriptionId).set({
      ...dataToSave,
      userId,
      verified: true
    }, { merge: true });

    console.log("[PUSH SUBSCRIBE] SAVED OK for user", userId);
    res.status(201).json({ 
      success: true, 
      subscriptionId,
      path: `users/${userId}/push_subscriptions/${subscriptionId}`
    });
  } catch (error: any) {
    console.error("[PUSH SUBSCRIBE] CRITICAL ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/notify", checkPlanFeature('whatsappNotifications'), async (req, res) => {
  const db = getDb();
  const { type, payload } = req.body;
  const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  
  console.log(`[BOOKING FLOW] Processing notification ${type}...`);
  console.log(`[BOOKING FLOW] Debug Payload for ${type}:`, JSON.stringify(payload, null, 2));

  try {
    if (type === 'BOOKING_PENDING_CLIENT') {
      const { clientEmail, clientName, professionalName, professionalWhatsapp, serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods } = payload;
      const eventKey = 'bookingPendingClient';

      if (await shouldSendEmail(appointmentId, eventKey)) {
        const result = await sendBookingPendingEmail({
          clientEmail, clientName, professionalName, professionalWhatsapp,
          serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods
        });
        if (result.success) await markEmailSent(appointmentId, eventKey);
        return res.json(result);
      }
      return res.json({ success: true, skipped: 'duplicate' });
    }

    if (type === 'NEW_BOOKING_REQUEST') {
      const { professionalId, clientName, serviceName, date, time, totalPrice, appointmentId, token, paymentMethods, clientWhatsapp } = payload;
      const eventKey = 'professionalNewBooking';

      const userDoc = await db.collection('users').doc(professionalId).get();
      if (!userDoc.exists) throw new Error(`Professional ${professionalId} not found`);
      const pro = userDoc.data();
      const proEmail = pro?.email;
      const proPhone = pro?.whatsapp;

      if (proEmail && await shouldSendEmail(appointmentId, eventKey)) {
        const cleanPhone = clientWhatsapp ? clientWhatsapp.replace(/\D/g, '') : '';
        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : undefined;

        const result = await sendProfessionalNewBookingEmail({
          professionalEmail: proEmail,
          professionalName: pro?.name || 'Profissional',
          clientName, serviceName, date, time,
          price: `R$ ${(totalPrice || payload.price || 0).toFixed(2).replace('.', ',')}`,
          location: payload.locationDetail || payload.neighborhood || 'Estúdio',
          agendaUrl: `${baseUrl}/pedidos`,
          appointmentId,
          paymentMethods,
          clientWhatsapp: clientWhatsapp || 'Não informado',
          whatsappUrl: waUrl
        });
        if (result.success) await markEmailSent(appointmentId, eventKey);
      }

      if (proPhone) {
        const formattedDate = date.split('-').reverse().join('/');
        const msg = buildNewBookingMessageForPro({
          profissionalNome: pro?.name || 'Profissional',
          servicoNome: serviceName,
          data: formattedDate,
          horario: time,
          clienteNome: clientName,
          clienteWhatsApp: payload.clientWhatsapp || 'Não informado',
          local: payload.locationDetail || payload.neighborhood || 'Estúdio',
          linkManage: `${baseUrl}/pedidos?id=${appointmentId}&token=${token}`
        });

        await sendWhatsApp(db, proPhone, msg, {
          appointmentId,
          userId: professionalId,
          type: 'professional_new_booking',
          clientName,
          clientWhatsapp
        });
      }

      // Trigger Web Push Notification
      await sendPushToUser(professionalId, {
        title: "Nova reserva!",
        body: `${clientName} quer ${serviceName} em ${date} às ${time}`,
        icon: "/icon-192.png",
        data: {
          url: "/pedidos"
        }
      });

      return res.json({ success: true });
    }

    if (type === 'BOOKING_REJECTED') {
      const { professionalId, clientName, clientWhatsapp, serviceName, date, time, professionalSlug } = payload;
      
      if (clientWhatsapp) {
        let slug = professionalSlug;
        if (!slug) {
          const proDocSnap = await db.collection('users').doc(professionalId).get();
          slug = proDocSnap.data()?.slug;
        }

        const profileLink = `${baseUrl}/p/${slug || 'app'}`;
        const msg = `Olá ${clientName}, infelizmente esse horário não está disponível. Você pode escolher outro horário no link:\n${profileLink}`;
        
        await sendWhatsApp(db, clientWhatsapp, msg, {
          userId: professionalId,
          type: 'booking_rejected',
          clientName,
          clientWhatsapp
        });
      }
      return res.json({ success: true });
    }

    if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_CANCELLED_BY_CLIENT') {
      const { professionalId, clientName, clientEmail, clientWhatsapp, serviceName, date, time, appointmentId, professionalSlug } = payload;
      
      // CREATE LAST MINUTE ALERT IF APPLICABLE
      const isLastMinute = await createLastMinuteAlert(payload);

      const eventKeyPro = 'bookingCancelledProfessional';
      const eventKeyClient = 'bookingCancelledClient';

      const proDoc = await db.collection('users').doc(professionalId).get();
      if (proDoc.exists) {
        const pro = proDoc.data();
        const proPhone = pro?.whatsapp;
        
        // Fetch waitlist count for the professional and date
        const waitlistSnap = await db.collection('waitlist')
          .where('professionalId', '==', professionalId)
          .where('requestedDate', '==', date)
          .where('status', '==', 'waiting')
          .get();
        const waitlistCount = waitlistSnap.size;
        const profileUrl = pro?.slug ? `${baseUrl}/p/${pro.slug}` : undefined;

        if (proPhone && !isLastMinute) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Horário liberado! 🗓️\n\nA reserva de ${clientName} em ${formattedDate} às ${time} foi CANCELADA. Seu horário ficou disponível novamente.`;
          await sendWhatsApp(db, proPhone, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_cancelled_pro',
            clientName,
            clientWhatsapp
          });
        }

        if (pro?.email && await shouldSendEmail(appointmentId, eventKeyPro)) {
          const result = await sendBookingCancelledEmail({
            clientName, serviceName, date, time, 
            location: '', professionalEmail: pro.email,
            professionalName: pro.name, bookingId: appointmentId || '',
            cancellationReason: payload.reason,
            waitlistCount,
            profileUrl
          });
          if (result.success) await markEmailSent(appointmentId, eventKeyPro);
        }

        if (clientWhatsapp) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = buildCancellationMessage({
            clienteNome: clientName,
            servicoNome: serviceName,
            data: formattedDate,
            horario: time,
            motivoCancelamento: payload.reason
          });
          await sendWhatsApp(db, clientWhatsapp, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_cancelled_client',
            clientName,
            clientWhatsapp
          });
        }

        if (clientEmail && await shouldSendEmail(appointmentId, eventKeyClient)) {
           const result = await sendBookingCancelledEmail({
              clientName, serviceName, date, time,
              location: '', professionalEmail: clientEmail, 
              professionalName: pro?.name || 'Sua Profissional', bookingId: appointmentId || ''
           });
           if (result.success) await markEmailSent(appointmentId, eventKeyClient);
        }
      }
      return res.json({ success: true });
    }

    if (type === 'BOOKING_CONFIRMED') {
      const { professionalId, clientName, clientWhatsapp, serviceName, date, time, appointmentId } = payload;
      
      const proDocSnap = await db.collection('users').doc(professionalId).get();
      const pro = proDocSnap.exists ? proDocSnap.data() : null;
      const proName = pro?.name || 'Sua Profissional';

      if (clientWhatsapp) {
        const formattedDate = date.split('-').reverse().join('/');
        const msg = buildBookingConfirmedMessageForClient({
          clienteNome: clientName,
          servicoNome: serviceName,
          profissionalNome: proName,
          data: formattedDate,
          horario: time,
          local: payload.locationDetail || payload.neighborhood || 'Estúdio',
          linkManage: `${baseUrl}/manage/${appointmentId}`
        });
        
        await sendWhatsApp(db, clientWhatsapp, msg, {
          appointmentId,
          userId: professionalId,
          type: 'booking_confirmed_client',
          clientName,
          clientWhatsapp
        });
      }

      return res.json({ success: true, emailTriggered: 'background' });
    }

    if (type === 'BOOKING_RESCHEDULED_BY_CLIENT' || type === 'BOOKING_RESCHEDULED') {
      const { 
        professionalId, 
        clientName, 
        clientEmail, 
        previousDate, 
        previousTime, 
        date, 
        time, 
        appointmentId, 
        serviceName,
        rescheduledBy: payloadRescheduledBy 
      } = payload;
      
      const rescheduledBy = payloadRescheduledBy || (type === 'BOOKING_RESCHEDULED_BY_CLIENT' ? 'client' : 'professional');
      const proDoc = await db.collection('users').doc(professionalId).get();
      
      if (proDoc.exists) {
        const pro = proDoc.data();
        const proPhone = pro?.whatsapp;
        
        // Notify professional via WhatsApp ONLY if CLIENT rescheduled
        if (proPhone && rescheduledBy === 'client') {
          const oldFormatted = previousDate.split('-').reverse().join('/');
          const newFormatted = date.split('-').reverse().join('/');
          
          const msg = `🚨 *Alteração de Horário!* \n\n${clientName} REAGENDOU o atendimento:\n\n` +
                      `De: ${oldFormatted} às ${previousTime}\n` +
                      `Para: *${newFormatted} às ${time}*\n\n` +
                      `O horário antigo foi liberado automaticamente. Confira no Dashboard: \n${baseUrl}/dashboard`;

          await sendWhatsAppMeta(proPhone, msg, {
            userId: professionalId,
            clientName,
            clientWhatsapp: payload.clientWhatsapp || '',
            type: 'booking_rescheduled_pro'
          });
        }

        if (clientEmail) {
          const eventKey = 'bookingRescheduledClient';
          if (await shouldSendEmail(appointmentId, eventKey)) {
            const result = await sendBookingRescheduledEmail({
              clientEmail, 
              clientName, 
              professionalName: pro?.name || 'Sua Profissional',
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
      }
      return res.json({ success: true });
    }

    if (type === 'WAITLIST_INVITATION') {
      const { clientWhatsapp, clientName, requestedDate, assignedTime, professionalName, serviceName, expiresInHours, bookingId } = payload;
      
      if (clientWhatsapp) {
        const formattedDate = requestedDate.split('-').reverse().join('/');
        const msg = buildWaitlistInviteMessage({
          clienteNome: clientName,
          profissionalNome: professionalName,
          data: formattedDate,
          horario: assignedTime,
          servicoNome: serviceName || 'serviço',
          tempoExpira: expiresInHours || 2,
          linkAgendar: `${baseUrl}/p/exemplo?waitlist_invite=true&booking_id=${bookingId}`
        });
        
        await sendWhatsAppMeta(clientWhatsapp, msg, {
          userId: payload.professionalId, 
          appointmentId: bookingId,
          clientName,
          clientWhatsapp,
          type: 'waitlist_invitation'
        });
      }
      return res.json({ success: true });
    }

    if (type === 'WAITLIST_SLOT_OPENED') {
      const { professionalId, date, time, candidateName } = payload;
      
      const proDoc = await db.collection('users').doc(professionalId).get();
      if (proDoc.exists) {
        const pro = proDoc.data();
        if (pro?.whatsapp) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Vaga na lista de espera! 🗓️\n\nO horário de ${time} (${formattedDate}) ficou disponível e ${candidateName} está aguardando.\n\nConfira no seu Dashboard: \n${baseUrl}/dashboard`;
          
          await sendWhatsAppMeta(pro.whatsapp, msg, {
            userId: professionalId,
            clientName: candidateName,
            type: 'waitlist_slot_opened'
          });
        }
      }
      return res.json({ success: true });
    }

    res.json({ success: true, message: "Type processed or ignored." });

  } catch (error: any) {
    console.error(`[Notification Service] ERROR:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/cron/reminders24h', async (req, res) => {
  const db = getDb();
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`[Cron] Starting 24h reminders for appointments on ${tomorrowStr}...`);

    const snap = await db.collection('appointments')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'confirmed')
      .where('reminder24hSentAt', '==', null)
      .get();
    
    let emailSent = 0;
    let whatsappSent = 0;
    let noChannelCount = 0;
    let errorsCount = 0;
    
    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      
      if (!appt.professionalId) continue;
      
      try {
        const proSnap = await db.collection('users').doc(appt.professionalId).get();
        if (!proSnap.exists) continue;
        
        const pro = proSnap.data();
        let sentSuccessfully = false;
        let deliveryChannel = '';

        const clientPhone = appt.clientWhatsapp;
        const baseUrl = process.env.APP_URL || 'https://usenera.com';
        if (clientPhone) {
          const formattedDate = tomorrowStr.split('-').reverse().join('/');
          const msg = buildReminderMessage24h({
            clienteNome: appt.clientName,
            diaSemana: 'Amanhã', // Ideally derive this, but 'Amanhã' works for 24h cron
            data: formattedDate,
            horario: appt.time,
            servicoNome: appt.serviceName,
            profissionalNome: pro?.name || 'sua profissional',
            local: appt.locationDetail || appt.neighborhood || 'Estúdio',
            linkConfirmar: `${baseUrl}/manage/${apptId}?action=confirm-presence`,
            linkManage: `${baseUrl}/manage/${apptId}`
          });
          
          const result = await sendWhatsApp(db, clientPhone, msg, {
            appointmentId: apptId,
            userId: appt.professionalId,
            type: 'reminder_24h_client',
            clientName: appt.clientName,
            clientWhatsapp: clientPhone
          });

          if (result.success) {
            sentSuccessfully = true;
            deliveryChannel = 'whatsapp_client';
            whatsappSent++;
          }
        }

        const proPhone = pro?.whatsapp;
        if (proPhone) {
          const formattedDate = tomorrowStr.split('-').reverse().join('/');
          const msg = `Lembrete Nera! 🔔\n\nAmanhã, ${formattedDate}, você tem um atendimento com ${appt.clientName} às ${appt.time} (${appt.serviceName}).`;
          
          await sendWhatsApp(db, proPhone, msg, {
            appointmentId: apptId,
            userId: appt.professionalId,
            type: 'reminder_24h_pro',
            clientName: appt.clientName,
            clientWhatsapp: clientPhone
          });
        }

        if (!sentSuccessfully && process.env.RESEND_API_KEY && appt.clientEmail) {
          try {
            const result = await sendBookingReminder24hEmail({
              clientName: appt.clientName,
              serviceName: appt.serviceName,
              date: appt.date,
              time: appt.time,
              duration: appt.duration || 60,
              location: appt.locationDetail || appt.address || 'Local não informado',
              professionalName: pro?.name || 'Profissional',
              clientEmail: appt.clientEmail,
              appointmentId: apptId,
              bookingId: apptId
            });
            if (result.success) {
              sentSuccessfully = true;
              deliveryChannel = 'email_client';
              emailSent++;
            }
          } catch (emailErr) {
            console.error(`[Cron] Email delivery failed for ${apptId}:`, emailErr);
          }
        }

        if (sentSuccessfully || proPhone) {
          await docSnap.ref.update({ 
            reminder24hSentAt: admin.firestore.FieldValue.serverTimestamp(),
            deliveryChannel: deliveryChannel || 'whatsapp_pro'
          });
        } else {
          noChannelCount++;
        }

      } catch (innerErr: any) {
        errorsCount++;
      }
    }
    
    res.json({ 
      success: true, 
      date: tomorrowStr,
      totalFound: snap.docs.length,
      sentEmail: emailSent, 
      sentWhatsApp: whatsappSent,
      noChannel: noChannelCount,
      errors: errorsCount
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/cron/reminders2h', async (req, res) => {
  const db = getDb();
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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

    res.json({ success: true, sent: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cron/review-requests', async (req, res) => {
  const db = getDb();
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      const clientPhone = appt.clientWhatsapp;

      if (clientPhone) {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const reviewUrl = `${baseUrl}/review/${token}`;
        
        await db.collection('review_requests').add({
          professionalId: appt.professionalId,
          bookingId: apptId,
          token,
          status: 'pending',
          clientDisplayName: appt.clientName,
          clientNeighborhood: appt.neighborhood || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const proName = appt.professionalName || 'sua profissional';
        const msg = buildReviewRequestMessage({
          clienteNome: appt.clientName,
          profissionalNome: proName,
          servicoNome: appt.serviceName,
          linkReview: reviewUrl
        });
        const result = await sendWhatsApp(db, clientPhone, msg, {
          appointmentId: apptId,
          userId: appt.professionalId,
          type: 'review_request',
          clientName: appt.clientName,
          clientWhatsapp: clientPhone
        });
        
        let sent = result.success;

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
            if (result.success) await markEmailSent(apptId, eventKey);
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

router.get('/cron/anti-no-show', async (req, res) => {
  const db = getDb();
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const snap = await db.collection('appointments')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'confirmed')
      .where('clientConfirmed24h', '!=', true)
      .get();
    
    let sentCount = 0;
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://nera.app';

    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const apptId = docSnap.id;
      
      const proSnap = await db.collection('users').doc(appt.professionalId).get();
      if (!proSnap.exists) continue;
      const pro = proSnap.data();
      
      if (pro?.antiNoShowEnabled) {
        if (appt.clientEmail) {
          const eventKey = 'confirmationRequest24h';
          if (await shouldSendEmail(apptId, eventKey)) {
            const result = await sendConfirmationRequest24hEmail({
              clientEmail: appt.clientEmail,
              clientName: appt.clientName,
              professionalName: pro.name || 'Profissional',
              serviceName: appt.serviceName,
              date: appt.date,
              time: appt.time,
              confirmUrl: `${appUrl}/manage/${apptId}?action=confirm-presence`,
              rescheduleUrl: `${appUrl}/manage/${apptId}?action=reschedule`,
              cancelUrl: `${appUrl}/manage/${apptId}?action=cancel`,
              appointmentId: apptId
            });
            
            if (result.success) {
              await markEmailSent(apptId, eventKey);
              await docSnap.ref.update({
                status: 'pending_confirmation',
                antiNoShowSentAt: admin.firestore.FieldValue.serverTimestamp()
              });
              sentCount++;
            }
          }
        }
      }
    }

    res.json({ success: true, processed: snap.size, sent: sentCount });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/cron/retention', async (req, res) => {
  const db = getDb();
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://nera.app';

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

export default router;
