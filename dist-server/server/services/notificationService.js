import { getDb } from "../firebaseAdmin.js";
import { shouldSendEmail, markEmailSent } from "../utils.js";
import { sendBookingPendingEmail, sendProfessionalNewBookingEmail } from "../emails/sendEmail.js";
import { buildNewBookingMessageForPro } from "./whatsappMessages.js";
import { sendWhatsApp } from "./whatsappService.js";
import { logger } from "../utils/logger.js";
export const sendBookingPendingClientNotification = async (payload, baseUrl) => {
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
            if (result.success)
                await markEmailSent(payload.appointmentId, eventKey);
            return result;
        }
        return { success: true, skipped: 'duplicate' };
    }
    catch (err) {
        logger.error("NOTIFICATION", "Failed to send BOOKING_PENDING_CLIENT", { appointmentId: payload.appointmentId, error: err.message });
        return { success: false, error: err.message };
    }
};
export const sendNewBookingRequestNotification = async (payload, baseUrl) => {
    const db = getDb();
    const eventKey = 'professionalNewBooking';
    try {
        const userDoc = await db.collection('users').doc(payload.professionalId).get();
        if (!userDoc.exists)
            throw new Error(`Professional ${payload.professionalId} not found`);
        const pro = userDoc.data();
        const proEmail = pro?.email;
        const proPhone = pro?.whatsapp;
        if (proEmail && await shouldSendEmail(payload.appointmentId, eventKey)) {
            const cleanPhone = payload.clientWhatsapp ? payload.clientWhatsapp.replace(/\D/g, '') : '';
            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : undefined;
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
            if (result.success)
                await markEmailSent(payload.appointmentId, eventKey);
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
    }
    catch (err) {
        logger.error("NOTIFICATION", "Failed to send NEW_BOOKING_REQUEST", { appointmentId: payload.appointmentId, error: err.message });
        return { success: false, error: err.message };
    }
};
