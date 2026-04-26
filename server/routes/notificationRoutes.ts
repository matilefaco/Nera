import express from "express";
import admin from "firebase-admin";
import { db } from "../firebaseAdmin.ts";
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
} from "../emails/sendEmail.ts";
import { sendWhatsApp, handleInboundMessage } from "../services/whatsappService.ts";
import { 
  buildNewBookingMessageForPro, 
  buildBookingConfirmedMessageForClient, 
  buildReminderMessage24h, 
  buildWaitlistInviteMessage, 
  buildCancellationMessage, 
  buildReviewRequestMessage 
} from "../services/whatsappMessages.ts";
import { shouldSendEmail, markEmailSent, sendWhatsAppMeta } from "../utils.ts";
import { checkPlanFeature } from "../middleware/planMiddleware.ts";

const router = express.Router();

router.get("/debug-email", async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Nera <agenda@usenera.com>";
  const appUrl = process.env.APP_URL;
  
  res.json({
    resendKeyPresent: !!apiKey,
    resendKeyPrefix: apiKey ? `${apiKey.substring(0, 5)}...` : 'N/A',
    from,
    appUrl: appUrl || 'http://localhost:3000 (fallback)',
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
      type: `simulated_${eventType}`,
      metadata: { isSimulation: true }
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/zapi/webhook", async (req, res) => {
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
    phoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID
  });
});

router.post("/notify", checkPlanFeature('whatsappNotifications'), async (req, res) => {
  const { type, payload } = req.body;
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  
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
          type: 'professional_new_booking'
        });
      }

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
          type: 'booking_rejected'
        });
      }
      return res.json({ success: true });
    }

    if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_CANCELLED_BY_CLIENT') {
      const { professionalId, clientName, clientEmail, clientWhatsapp, serviceName, date, time, appointmentId, professionalSlug } = payload;
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

        if (proPhone) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Horário liberado! 🗓️\n\nA reserva de ${clientName} em ${formattedDate} às ${time} foi CANCELADA. Seu horário ficou disponível novamente.`;
          await sendWhatsApp(db, proPhone, msg, {
            appointmentId,
            userId: professionalId,
            type: 'booking_cancelled_pro'
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
            type: 'booking_cancelled_client'
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
          type: 'booking_confirmed_client'
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

          await sendWhatsAppMeta(proPhone, msg);
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
        
        await sendWhatsAppMeta(clientWhatsapp, msg);
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
          
          await sendWhatsAppMeta(pro.whatsapp, msg);
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
            type: 'reminder_24h_client'
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
            type: 'reminder_24h_pro'
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
            type: 'reminder_2h'
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
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

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
          type: 'review_request'
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
