import { getDb } from "../firebaseAdmin.js";
import { shouldSendEmail, markEmailSent, PUBLIC_APP_URL, buildPublicBookingUrl, sendWhatsAppMeta } from "../utils.js";
import {
  sendBookingPendingEmail,
  sendProfessionalNewBookingEmail,
  sendBookingConfirmedEmail,
  sendBookingRescheduledEmail,
  sendWaitlistInviteEmail,
} from "../emails/sendEmail.js";
import { 
  buildNewBookingMessageForPro,
  buildBookingConfirmedMessageForClient,
  buildRescheduledByProMessageForClient,
  buildWaitlistInviteMessage
} from "./whatsappMessages.js";
import { sendWhatsApp } from "./whatsappService.js";
import { logger, maskEmail, maskPhone } from "../utils/logger.js";

// Types
export interface BookingPendingClientPayload {
  clientEmail: string;
  clientName: string;
  professionalName: string;
  professionalWhatsapp: string;
  serviceName: string;
  date: string;
  time: string;
  price: string;
  travelFee?: number;
  totalPrice?: number;
  reservationCode: string;
  manageUrl: string;
  appointmentId: string;
  paymentMethods?: string[];
  clientWhatsapp?: string;
}

export interface NewBookingRequestPayload {
  professionalId: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  totalPrice?: number;
  travelFee?: number;
  price?: number;
  appointmentId: string;
  token: string;
  paymentMethods?: string[];
  locationDetail?: string;
  neighborhood?: string;
  clientWhatsapp?: string;
  clientEmail?: string;
}

export const sendBookingPendingClientNotification = async (
  payload: BookingPendingClientPayload,
  baseUrl: string,
) => {
  const db = getDb();
  const eventKey = "bookingPendingClient";

  try {
    if (await shouldSendEmail(payload.appointmentId, eventKey)) {
      const travelStr = payload.travelFee
        ? `<br/><span style="font-size: 11px; color: #6b7280; font-weight: normal;">Inclui R$ ${payload.travelFee.toFixed(2).replace(".", ",")} deslocamento</span>`
        : "";
      const priceDisplay = payload.totalPrice
        ? `R$ ${payload.totalPrice.toFixed(2).replace(".", ",")} ${travelStr}`
        : payload.price;

      const result = await sendBookingPendingEmail({
        clientEmail: payload.clientEmail,
        clientName: payload.clientName,
        professionalName: payload.professionalName,
        professionalWhatsapp: payload.professionalWhatsapp,
        serviceName: payload.serviceName,
        date: payload.date,
        time: payload.time,
        price: priceDisplay,
        reservationCode: payload.reservationCode,
        manageUrl: payload.manageUrl,
        appointmentId: payload.appointmentId,
        paymentMethods: payload.paymentMethods,
      });
      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
      return result;
    }
    return { success: true, skipped: "duplicate" };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send BOOKING_PENDING_CLIENT", {
      appointmentId: payload.appointmentId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
};

export interface BookingConfirmedClientPayload {
  appointmentId: string;
}

export const sendBookingConfirmedClientNotification = async (
  payload: BookingConfirmedClientPayload,
  baseUrl: string,
) => {
  const db = getDb();
  const eventKey = "bookingConfirmedClient";

  try {
    const apptDoc = await db
      .collection("appointments")
      .doc(payload.appointmentId)
      .get();
    if (!apptDoc.exists)
      return { success: false, error: "Appointment not found" };
    const apptData = apptDoc.data() as any;

    const proSnap = await db
      .collection("users")
      .doc(apptData.professionalId)
      .get();
    const pro = proSnap.exists ? (proSnap.data() as any) : null;

    const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, "") : "";
    const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;
    const token =
      apptData.manageSlug || apptData.token || apptData.manageToken;

    const isStudio =
      apptData.locationType === "studio" ||
      apptData.locationType === "estudio" ||
      !apptData.locationType;
    const isHome =
      apptData.locationType === "home" ||
      apptData.locationType === "domicilio";

    let addressData = undefined;
    if (isStudio && pro?.studioAddress) {
      addressData = {
        street: pro.studioAddress.street,
        number: pro.studioAddress.number,
        complement: pro.studioAddress.complement,
        neighborhood: pro.studioAddress.neighborhood,
        city: pro.studioAddress.city,
        state: pro.studioAddress.state,
      };
    }

    if (!apptData.clientEmail) {
      logger.warn(
        "NOTIFICATION",
        "Skipped confirmation email: client has no email",
        { appointmentId: payload.appointmentId },
      );
    } else if (await shouldSendEmail(payload.appointmentId, eventKey)) {
      const result = await sendBookingConfirmedEmail({
        clientName: apptData.clientName,
        serviceName: apptData.serviceName,
        date: apptData.date,
        time: apptData.time,
        location: isHome
          ? `Domicílio (${apptData.neighborhood || "Bairro omitido"})`
          : "Estúdio / Local Fixo",
        clientEmail: apptData.clientEmail,
        professionalName: pro?.name || "Sua Profissional",
        professionalEmail: pro?.email || "",
        bookingId: payload.appointmentId,
        token: token,
        prepInstructions: apptData.prepInstructions,
        whatsappUrl,
        manageUrl: token ? buildPublicBookingUrl(token) : undefined,
        address: addressData,
        locationType: apptData.locationType,
      });

      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
    }

    // Envia WhatsApp para a cliente
    if (apptData.clientWhatsapp) {
      let fullAddressStr = "Estúdio";
      if (isHome) {
        if (apptData.address && typeof apptData.address === "object") {
          const a = apptData.address;
          const comp = a.complement ? `\n${a.complement}` : "";
          const ref = a.reference ? `\nReferência: ${a.reference}` : "";
          fullAddressStr = `Em domicílio - ${a.street || ""}, ${a.number || "S/N"}${comp}\n${a.neighborhood || ""}\n${a.city || ""} - ${a.state || ""}${ref}`.trim();
        } else if (typeof apptData.address === "string") {
          fullAddressStr = `Em domicílio - ${apptData.address}`;
        } else {
          fullAddressStr = `Em domicílio - ${apptData.neighborhood || "Bairro não informado"}`;
        }
      } else {
        if (pro?.studioAddress) {
          const a = pro.studioAddress;
          const comp = a.complement ? `\n${a.complement}` : "";
          const ref = a.reference ? `\nReferência: ${a.reference}` : "";
          fullAddressStr = `Estúdio - ${a.street || ""}, ${a.number || "S/N"}${comp}\n${a.neighborhood || ""}\n${a.city || ""} - ${a.state || ""}${ref}`.trim();
        } else if (pro?.address && typeof pro.address === "string") {
          fullAddressStr = `Estúdio - ${pro.address}`;
        } else {
          fullAddressStr = `Estúdio`;
        }
      }

      const formattedDate = apptData.date.split('-').reverse().join('/');
      const waMsg = buildBookingConfirmedMessageForClient({
        serviceName: apptData.serviceName,
        date: formattedDate,
        time: apptData.time,
        professionalName: pro?.name || "Profissional",
        local: fullAddressStr,
        linkManage: buildPublicBookingUrl(token || payload.appointmentId)
      });
      await sendWhatsApp(db, apptData.clientWhatsapp, waMsg, {
        appointmentId: payload.appointmentId,
        userId: apptData.professionalId,
        type: 'booking_confirmed_client',
        clientName: apptData.clientName,
        clientWhatsapp: apptData.clientWhatsapp
      });
    }

    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send BOOKING_CONFIRMED_CLIENT", {
      appointmentId: payload.appointmentId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
};

export const sendNewBookingRequestNotification = async (
  payload: NewBookingRequestPayload,
  baseUrl: string,
) => {
  const db = getDb();
  const eventKey = "professionalNewBooking";

  try {
    const userDoc = await db
      .collection("users")
      .doc(payload.professionalId)
      .get();
    if (!userDoc.exists)
      throw new Error(`Professional ${payload.professionalId} not found`);
    const pro = userDoc.data();
    const proEmail = pro?.email;
    const proPhone = pro?.whatsapp || pro?.phone;

    if (proEmail && (await shouldSendEmail(payload.appointmentId, eventKey))) {
      const cleanPhone = payload.clientWhatsapp
        ? payload.clientWhatsapp.replace(/\D/g, "")
        : "";
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : undefined;

      logger.info(
        "NOTIFICATION",
        `Dispatched professional email for booking ${payload.appointmentId}`,
        {
          recipient: maskEmail(proEmail),
          eventKey,
        },
      );

      const result = await sendProfessionalNewBookingEmail({
        professionalEmail: proEmail,
        professionalName: pro?.name || "Profissional",
        clientName: payload.clientName,
        serviceName: payload.serviceName,
        date: payload.date,
        time: payload.time,
        price: payload.totalPrice
          ? `R$ ${payload.totalPrice.toFixed(2).replace(".", ",")} ${payload.travelFee ? `<br/><span style="font-size: 11px; color: #6b7280; font-weight: normal;">Inclui R$ ${payload.travelFee.toFixed(2).replace(".", ",")} deslocamento</span>` : ""}`
          : `R$ ${(payload.price || 0).toFixed(2).replace(".", ",")}`,
        location: payload.locationDetail || payload.neighborhood || "Estúdio",
        agendaUrl: `${baseUrl}/pedidos`,
        appointmentId: payload.appointmentId,
        paymentMethods: payload.paymentMethods,
        clientWhatsapp: payload.clientWhatsapp || "Não informado",
        whatsappUrl: waUrl,
      });
      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
    } else if (!proEmail) {
      logger.warn(
        "NOTIFICATION",
        "Skipped professional email: professional has no email in profile",
        {
          professionalId: payload.professionalId,
          appointmentId: payload.appointmentId,
        },
      );
    }

    if (proPhone) {
      const plan = pro?.plan || "free";
      let isExpired = false;
      const expiresAt = pro?.planExpiresAt;
      if (expiresAt) {
        if (typeof expiresAt.toMillis === "function") {
          isExpired = expiresAt.toMillis() < Date.now();
        } else {
          isExpired = new Date(expiresAt).getTime() < Date.now();
        }
      }
      const activePlan = isExpired ? "free" : plan;

      const startNotifyAt = Date.now();
      logger.info(
        "NOTIFICATION",
        "[PRO_NOTIFY_PROFESSIONAL_START]",
        {
          professionalId: payload.professionalId,
          appointmentId: payload.appointmentId,
          source: process.env.NODE_ENV === "production" ? "production" : "dev",
          hasWhatsappToken: !!(process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN),
          hasProfessionalPhone: !!proPhone,
          planAllowsWhatsapp: activePlan === "pro",
          plan: activePlan,
          createdAt: new Date(startNotifyAt).toISOString()
        }
      );

      if (activePlan === "pro") {
        const formattedDate = payload.date ? payload.date.split("-").reverse().join("/") : "";
        const msg = buildNewBookingMessageForPro({
          profissionalNome: pro?.name || "Profissional",
          servicoNome: payload.serviceName,
          data: formattedDate,
          horario: payload.time,
          clienteNome: payload.clientName,
          clienteWhatsApp: payload.clientWhatsapp || "Não informado",
          local: payload.locationDetail || payload.neighborhood || "Estúdio",
          linkManage: `${baseUrl}/pedidos?appointmentId=${payload.appointmentId}`,
        });

        const attemptAtMs = Date.now();
        logger.info("NOTIFICATION", "[WHATSAPP_PROFESSIONAL_SEND_ATTEMPT]", {
            professionalId: payload.professionalId,
            appointmentId: payload.appointmentId,
            maskedPhone: maskPhone(proPhone),
            attemptAt: new Date(attemptAtMs).toISOString()
        });

        try {
          const waResult = await sendWhatsApp(db, proPhone, msg, {
            appointmentId: payload.appointmentId,
            userId: payload.professionalId,
            type: "professional_new_booking",
            clientName: payload.clientName,
            clientWhatsapp: payload.clientWhatsapp || "",
          });
          
          const zapiResponseAtMs = Date.now();
          const durationMs = zapiResponseAtMs - attemptAtMs;

          if (waResult.success) {
            logger.info("NOTIFICATION", "[PRO_NOTIFY_PROFESSIONAL_SUCCESS] [WHATSAPP_PROFESSIONAL_SEND_SUCCESS]", { 
              appointmentId: payload.appointmentId,
              professionalId: payload.professionalId,
              zapiResponseAt: new Date(zapiResponseAtMs).toISOString(),
              durationMs,
              zapiMessageId: waResult.logId || "unknown"
            });
          } else {
            logger.error("NOTIFICATION", "[PRO_NOTIFY_PROFESSIONAL_ERROR] [WHATSAPP_PROFESSIONAL_SEND_ERROR]", { 
              appointmentId: payload.appointmentId,
              professionalId: payload.professionalId,
              error: waResult.error,
              zapiResponseAt: new Date(zapiResponseAtMs).toISOString(),
              durationMs
            });
          }
        } catch (waErr: any) {
          const zapiResponseAtMs = Date.now();
          const durationMs = zapiResponseAtMs - attemptAtMs;
          logger.error("NOTIFICATION", "[PRO_NOTIFY_PROFESSIONAL_ERROR] [WHATSAPP_PROFESSIONAL_SEND_ERROR]", { 
            appointmentId: payload.appointmentId,
            professionalId: payload.professionalId,
            error: waErr?.message || "Unknown error",
            zapiResponseAt: new Date(zapiResponseAtMs).toISOString(),
            durationMs
          });
        }
      } else {
         logger.info(
          "NOTIFICATION",
          "[PRO_NOTIFY_PROFESSIONAL_SKIP] User does not have a Pro plan",
          { professionalId: payload.professionalId, appointmentId: payload.appointmentId, plan: activePlan }
        );
      }
    } else {
      logger.info(
        "NOTIFICATION",
        "[PRO_NOTIFY_PROFESSIONAL_SKIP] Skipped - No professional phone",
        { professionalId: payload.professionalId, appointmentId: payload.appointmentId }
      );
    }

    // Add UI Alert
    await db.collection("alerts").add({
      professionalId: payload.professionalId,
      type: "reserva",
      title: "Nova Solicitação",
      message: `${payload.clientName} quer agendar ${payload.serviceName} para ${payload.date.split("-").reverse().join("/")} às ${payload.time}.`,
      isRead: false,
      appointmentId: payload.appointmentId,
      createdAt: new Date(),
      actionUrl: `/pedidos`,
    });

    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send NEW_BOOKING_REQUEST", {
      appointmentId: payload.appointmentId,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
};

const checkIdempotency = async (db: any, key: string) => {
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

export const sendWaitlistAcceptedProfessionalNotification = async (
  payload: { professionalId: string; clientName: string; date: string; time: string; waitlistEntryId: string },
) => {
  const db = getDb();
  try {
    const proSnap = await db.collection("users").doc(payload.professionalId).get();
    const pro = proSnap.exists ? proSnap.data() : null;
    if (!pro) return { success: false, error: "Professional not found" };

    if (pro.whatsapp) {
      const idempotencyKey = `WAITLIST_ACCEPTED_PROFESSIONAL:${payload.waitlistEntryId}:${payload.date}:${payload.time}`;
      if (!(await checkIdempotency(db, idempotencyKey))) {
        const formattedDate = payload.date.split('-').reverse().join('/');
        const msg = `Ótima notícia!\n\n${payload.clientName} aceitou o horário liberado para ${formattedDate} às ${payload.time}.\n\nO agendamento já foi confirmado e entrou automaticamente na sua agenda.`;
        
        await sendWhatsAppMeta(pro.whatsapp, msg, {
          userId: payload.professionalId,
          type: 'waitlist_accepted_professional',
          appointmentId: payload.waitlistEntryId,
          clientName: payload.clientName,
          idempotencyKey
        });
      }
    }
    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send WAITLIST_ACCEPTED_PROFESSIONAL helper", { error: err.message });
    return { success: false, error: err.message };
  }
};

export const sendBookingRescheduledNotification = async (
  payload: {
    appointmentId: string;
    previousDate: string;
    previousTime: string;
    updatedData: any;
    rescheduledBy: "client" | "professional";
  },
  baseUrl: string,
) => {
  const db = getDb();
  try {
    const apptDoc = await db.collection("appointments").doc(payload.appointmentId).get();
    if (!apptDoc.exists) return { success: false, error: "Appointment not found" };
    const apptData = apptDoc.data() || {};

    const proSnap = await db.collection("users").doc(apptData.professionalId).get();
    const pro = proSnap.exists ? proSnap.data() : null;
    if (!pro) return { success: false, error: "Professional not found" };

    const appointmentId = payload.appointmentId;
    const professionalId = apptData.professionalId;
    const clientName = apptData.clientName || 'Cliente';
    const clientEmail = apptData.clientEmail || '';
    const previousDate = payload.previousDate;
    const previousTime = payload.previousTime;
    const date = apptData.date || '';
    const time = apptData.time || '';
    const serviceName = apptData.serviceName || 'Serviço';
    const rescheduledBy = payload.rescheduledBy;

    const proPhone = pro.whatsapp;
    
    // Notify professional via WhatsApp ONLY if CLIENT rescheduled
    if (proPhone && rescheduledBy === 'client') {
      const idempotencyKeyPro = `BOOKING_RESCHEDULED_PRO:${appointmentId}:${date}:${time}`;
      if (!(await checkIdempotency(db, idempotencyKeyPro))) {
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
          clientWhatsapp: apptData.clientWhatsapp || '',
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
    if (apptData.clientWhatsapp && rescheduledBy === 'professional') {
      const idempotencyKeyClient = `BOOKING_RESCHEDULED_CLIENT:${appointmentId}:${date}:${time}`;
      if (!(await checkIdempotency(db, idempotencyKeyClient))) {
        const newFormatted = date.split('-').reverse().join('/');
        const msg = buildRescheduledByProMessageForClient({
          clientName,
          date: newFormatted,
          time,
          serviceName,
          professionalName: pro.name || 'Sua Profissional',
          oldDate: previousDate ? previousDate.split('-').reverse().join('/') : undefined,
          oldTime: previousTime,
          manageBookingUrl: buildPublicBookingUrl(apptData.manageSlug || appointmentId)
        });
        const result = await sendWhatsApp(db, apptData.clientWhatsapp, msg, {
          userId: professionalId,
          appointmentId,
          clientName,
          clientWhatsapp: apptData.clientWhatsapp,
          type: 'booking_rescheduled_client',
          idempotencyKey: idempotencyKeyClient
        });
        if (!result.success) logger.error("WHATSAPP", "Failed to send reschedule WhatsApp", { result });
      }
    }
    
    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send BOOKING_RESCHEDULED helper", { error: err.message });
    return { success: false, error: err.message };
  }
};

export const sendWaitlistInvitationNotification = async (
  payload: {
    waitlistEntryId: string;
    assignedTime: string;
  },
  baseUrl: string,
) => {
  const db = getDb();
  try {
    const waitlistDoc = await db.collection("waitlist").doc(payload.waitlistEntryId).get();
    if (!waitlistDoc.exists) return { success: false, error: "Waitlist entry not found" };
    const waitlistData = waitlistDoc.data() || {};

    const proSnap = await db.collection("users").doc(waitlistData.professionalId).get();
    const pro = proSnap.exists ? proSnap.data() : null;
    if (!pro) return { success: false, error: "Professional not found" };

    const waitlistEntryId = payload.waitlistEntryId;
    const clientWhatsapp = waitlistData.clientWhatsapp;
    const clientEmail = waitlistData.clientEmail;
    const clientName = waitlistData.clientName || 'Cliente';
    const date = waitlistData.requestedDate || '';
    const time = payload.assignedTime || waitlistData.assignedTime || waitlistData.preferredTime || '';
    const serviceName = waitlistData.serviceName || 'Serviço';
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
      if (!(await checkIdempotency(db, idempotencyKey))) {
        const msg = buildWaitlistInviteMessage({
          serviceName: serviceName || 'serviço',
          date: formattedDate,
          time,
          professionalName,
          waitlistInviteUrl
        });
        
        await sendWhatsAppMeta(clientWhatsapp, msg, {
          userId: waitlistData.professionalId, 
          appointmentId: waitlistEntryId,
          clientName,
          clientWhatsapp,
          type: 'waitlist_invitation',
          idempotencyKey
        });
      }
    }
    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send WAITLIST_INVITATION helper", { error: err.message });
    return { success: false, error: err.message };
  }
};

export const sendWaitlistSlotOpenedNotification = async (
  payload: {
    waitlistEntryId: string;
    date: string;
    time: string;
  },
  baseUrl: string,
) => {
  const db = getDb();
  try {
    const waitlistDoc = await db.collection("waitlist").doc(payload.waitlistEntryId).get();
    if (!waitlistDoc.exists) return { success: false, error: "Waitlist entry not found" };
    const waitlistData = waitlistDoc.data() || {};

    const proSnap = await db.collection("users").doc(waitlistData.professionalId).get();
    const pro = proSnap.exists ? proSnap.data() : null;
    if (!pro) return { success: false, error: "Professional not found" };

    const waitlistEntryId = payload.waitlistEntryId;
    const professionalId = waitlistData.professionalId;
    const date = payload.date;
    const time = payload.time;
    const candidateName = waitlistData.clientName || 'Cliente';

    if (pro.whatsapp) {
      const idempotencyKey = `WAITLIST_SLOT_OPENED:${waitlistEntryId}:${date}:${time}`;
      if (!(await checkIdempotency(db, idempotencyKey))) {
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
    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send WAITLIST_SLOT_OPENED helper", { error: err.message });
    return { success: false, error: err.message };
  }
};
