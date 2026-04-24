
import { Resend } from 'resend';
import { buildBookingPendingEmail } from './templates/bookingPending';

// Lazy initialization of Resend client
let _resendClient: Resend | null = null;

function getResendClient() {
  if (!_resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EMAIL_PENDING_ERROR] RESEND_API_KEY is missing.');
    }
    _resendClient = new Resend(apiKey);
  }
  return _resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Nera <agendamento@usenera.eu.cc>";

export interface PendingEmailPayload {
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
}

/**
 * Sends an instant pending notification to the client.
 */
export async function sendBookingPendingEmail(data: PendingEmailPayload) {
  const { clientEmail, clientName, professionalName, professionalWhatsapp, serviceName, date, time, price, reservationCode, manageUrl } = data;

  if (!clientEmail) {
    console.log('[EMAIL_PENDING_SKIP] No client email provided.');
    return { success: false, error: 'Missing email' };
  }

  // Format date for display
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Prepare WhatsApp link
  const whatsappMsg = encodeURIComponent(`Olá ${professionalName}, acabei de solicitar meu horário no Nera 💛`);
  const whatsappUrl = `https://wa.me/${professionalWhatsapp.replace(/\D/g, '')}?text=${whatsappMsg}`;

  const html = buildBookingPendingEmail({
    professionalName,
    serviceName,
    formattedDate,
    time,
    price,
    reservationCode,
    manageUrl,
    whatsappUrl,
    clientName
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Seu pedido foi recebido ✨ | ${professionalName}`,
      html,
    });

    if (error) {
      console.error('[EMAIL_PENDING_ERROR] Resend failure:', error);
      return { success: false, error };
    }

    console.log(`[EMAIL_PENDING_SUCCESS] Sent to ${clientEmail}. ID: ${resendData?.id}`);
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    console.error('[EMAIL_PENDING_ERROR] Fatal error:', err.message || err);
    return { success: false, error: err.message };
  }
}
