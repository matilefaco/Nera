import { getDb } from "../firebaseAdmin.js";
import { shouldSendEmail, markEmailSent } from "../utils.js";
import {
  sendBookingPendingEmail,
  sendProfessionalNewBookingEmail,
  sendBookingConfirmedEmail,
} from "../emails/sendEmail.js";
import { 
  buildNewBookingMessageForPro,
  buildBookingConfirmedMessageForClient
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

    if (!apptData.clientEmail) {
      logger.warn(
        "NOTIFICATION",
        "Skipped confirmation email: client has no email",
        { appointmentId: payload.appointmentId },
      );
      return { success: true, skipped: "no_email" };
    }

    if (await shouldSendEmail(payload.appointmentId, eventKey)) {
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
        manageUrl: token ? `${baseUrl}/r/${token}` : undefined,
        address: addressData,
        locationType: apptData.locationType,
      });

      if (result.success) await markEmailSent(payload.appointmentId, eventKey);

      // Envia WhatsApp para a cliente
      if (apptData.clientWhatsapp) {
        const formattedDate = apptData.date.split('-').reverse().join('/');
        const waMsg = buildBookingConfirmedMessageForClient({
          serviceName: apptData.serviceName,
          date: formattedDate,
          time: apptData.time,
          professionalName: pro?.name || "Profissional",
          local: apptData.locationDetail || apptData.neighborhood || 'Estúdio',
          linkManage: `${baseUrl}/manage/${token || payload.appointmentId}`
        });
        await sendWhatsApp(db, apptData.clientWhatsapp, waMsg, {
          appointmentId: payload.appointmentId,
          userId: apptData.professionalId,
          type: 'booking_confirmed_client',
          clientName: apptData.clientName,
          clientWhatsapp: apptData.clientWhatsapp
        });
      }

      return result;
    }
    return { success: true, skipped: "duplicate" };
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
          planAllowsWhatsapp: activePlan === "pro" || activePlan === "essencial",
          plan: activePlan,
          createdAt: new Date(startNotifyAt).toISOString()
        }
      );

      if (activePlan === "pro" || activePlan === "essencial") {
        const formattedDate = payload.date ? payload.date.split("-").reverse().join("/") : "";
        const msg = buildNewBookingMessageForPro({
          profissionalNome: pro?.name || "Profissional",
          servicoNome: payload.serviceName,
          data: formattedDate,
          horario: payload.time,
          clienteNome: payload.clientName,
          clienteWhatsApp: payload.clientWhatsapp || "Não informado",
          local: payload.locationDetail || payload.neighborhood || "Estúdio",
          linkManage: `${baseUrl}/pedidos`,
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
