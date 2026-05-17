import { getDb } from "../firebaseAdmin.js";
import { 
  shouldSendEmail, markEmailSent
} from "../utils.js";
import { sendBookingPendingEmail, sendProfessionalNewBookingEmail, sendBookingConfirmedEmail } from "../emails/sendEmail.js";
import { buildNewBookingMessageForPro } from "./whatsappMessages.js";
import { sendWhatsApp } from "./whatsappService.js";
import { logger, maskEmail } from "../utils/logger.js";

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
  price?: number;
  appointmentId: string;
  token: string;
  paymentMethods?: string[];
  locationDetail?: string;
  neighborhood?: string;
  clientWhatsapp?: string;
  clientEmail?: string;
}

export const sendBookingPendingClientNotification = async (payload: BookingPendingClientPayload, baseUrl: string) => {
  const db = getDb();
  const eventKey = 'bookingPendingClient';

  try {
    if (await shouldSendEmail(payload.appointmentId, eventKey)) {
      const result = await sendBookingPendingEmail({
        clientEmail: payload.clientEmail,
        clientName: payload.clientName,
        professionalName: payload.professionalName,
        professionalWhatsapp: payload.professionalWhatsapp,
        serviceName: payload.serviceName,
        date: payload.date,
        time: payload.time,
        price: payload.price,
        reservationCode: payload.reservationCode,
        manageUrl: payload.manageUrl,
        appointmentId: payload.appointmentId,
        paymentMethods: payload.paymentMethods
      });
      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
      return result;
    }
    return { success: true, skipped: 'duplicate' };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send BOOKING_PENDING_CLIENT", { appointmentId: payload.appointmentId, error: err.message });
    return { success: false, error: err.message };
  }
};

export interface BookingConfirmedClientPayload {
  appointmentId: string;
}

export const sendBookingConfirmedClientNotification = async (payload: BookingConfirmedClientPayload, baseUrl: string) => {
  const db = getDb();
  const eventKey = 'bookingConfirmedClient';

  try {
    const apptDoc = await db.collection('appointments').doc(payload.appointmentId).get();
    if (!apptDoc.exists) return { success: false, error: 'Appointment not found' };
    const apptData = apptDoc.data() as any;

    if (!apptData.clientEmail) {
      logger.warn("NOTIFICATION", "Skipped confirmation email: client has no email", { appointmentId: payload.appointmentId });
      return { success: true, skipped: 'no_email' };
    }

    if (await shouldSendEmail(payload.appointmentId, eventKey)) {
      const proSnap = await db.collection('users').doc(apptData.professionalId).get();
      const pro = proSnap.exists ? proSnap.data() as any : null;

      const waPhone = pro?.whatsapp ? pro.whatsapp.replace(/\D/g, '') : '';
      const whatsappUrl = waPhone ? `https://wa.me/${waPhone}` : undefined;
      const token = apptData.manageSlug || apptData.token || apptData.manageToken;

      const isStudio = apptData.locationType === 'studio' || apptData.locationType === 'estudio' || !apptData.locationType;
      const isHome = apptData.locationType === 'home' || apptData.locationType === 'domicilio';

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
          ? `Domicílio (${apptData.neighborhood || 'Bairro omitido'})` 
          : 'Estúdio / Local Fixo',
        clientEmail: apptData.clientEmail,
        professionalName: pro?.name || 'Sua Profissional',
        professionalEmail: pro?.email || '',
        bookingId: payload.appointmentId,
        token: token,
        prepInstructions: apptData.prepInstructions,
        whatsappUrl,
        manageUrl: token ? `${baseUrl}/r/${token}` : undefined,
        address: addressData,
        locationType: apptData.locationType
      });

      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
      return result;
    }
    return { success: true, skipped: 'duplicate' };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send BOOKING_CONFIRMED_CLIENT", { appointmentId: payload.appointmentId, error: err.message });
    return { success: false, error: err.message };
  }
};

export const sendNewBookingRequestNotification = async (payload: NewBookingRequestPayload, baseUrl: string) => {
  const db = getDb();
  const eventKey = 'professionalNewBooking';

  try {
    const userDoc = await db.collection('users').doc(payload.professionalId).get();
    if (!userDoc.exists) throw new Error(`Professional ${payload.professionalId} not found`);
    const pro = userDoc.data();
    const proEmail = pro?.email;
    const proPhone = pro?.whatsapp;

    if (proEmail && await shouldSendEmail(payload.appointmentId, eventKey)) {
      const cleanPhone = payload.clientWhatsapp ? payload.clientWhatsapp.replace(/\D/g, '') : '';
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : undefined;

      logger.info("NOTIFICATION", `Dispatched professional email for booking ${payload.appointmentId}`, { 
        recipient: maskEmail(proEmail), 
        eventKey 
      });

      const result = await sendProfessionalNewBookingEmail({
        professionalEmail: proEmail,
        professionalName: pro?.name || 'Profissional',
        clientName: payload.clientName,
        serviceName: payload.serviceName,
        date: payload.date,
        time: payload.time,
        price: `R$ ${(payload.totalPrice || payload.price || 0).toFixed(2).replace('.', ',')}`,
        location: payload.locationDetail || payload.neighborhood || 'Estúdio',
        agendaUrl: `${baseUrl}/pedidos`,
        appointmentId: payload.appointmentId,
        paymentMethods: payload.paymentMethods,
        clientWhatsapp: payload.clientWhatsapp || 'Não informado',
        whatsappUrl: waUrl
      });
      if (result.success) await markEmailSent(payload.appointmentId, eventKey);
    } else if (!proEmail) {
      logger.warn("NOTIFICATION", "Skipped professional email: professional has no email in profile", { 
        professionalId: payload.professionalId,
        appointmentId: payload.appointmentId
      });
    }

    if (proPhone) {
      const formattedDate = payload.date.split('-').reverse().join('/');
      const msg = buildNewBookingMessageForPro({
        profissionalNome: pro?.name || 'Profissional',
        servicoNome: payload.serviceName,
        data: formattedDate,
        horario: payload.time,
        clienteNome: payload.clientName,
        clienteWhatsApp: payload.clientWhatsapp || 'Não informado',
        local: payload.locationDetail || payload.neighborhood || 'Estúdio',
        linkManage: `${baseUrl}/pedidos?id=${payload.appointmentId}&token=${payload.token}`
      });

      await sendWhatsApp(db, proPhone, msg, {
        appointmentId: payload.appointmentId,
        userId: payload.professionalId,
        type: 'professional_new_booking',
        clientName: payload.clientName,
        clientWhatsapp: payload.clientWhatsapp || ''
      });
    }

    // Add UI Alert
    await db.collection('alerts').add({
      professionalId: payload.professionalId,
      type: 'reserva',
      title: 'Nova Solicitação',
      message: `${payload.clientName} quer agendar ${payload.serviceName} para ${payload.date.split('-').reverse().join('/')} às ${payload.time}.`,
      isRead: false,
      appointmentId: payload.appointmentId,
      createdAt: new Date(),
      actionUrl: `/pedidos`
    });

    return { success: true };
  } catch (err: any) {
    logger.error("NOTIFICATION", "Failed to send NEW_BOOKING_REQUEST", { appointmentId: payload.appointmentId, error: err.message });
    return { success: false, error: err.message };
  }
};
