
import { Resend } from 'resend';
import { buildBookingPendingEmail } from './templates/bookingPending';
import { buildProfessionalNewBookingEmail } from './templates/professionalNewBooking';
import { buildConfirmationRequest24hEmail } from './templates/confirmationRequest24h';
import { buildRetentionEmail } from './templates/retention';
import { buildBookingConfirmedEmail } from './templates/bookingConfirmed';
import { buildBookingCancelledEmail } from './templates/bookingCancelled';
import { buildReviewRequestEmail } from './templates/reviewRequest';
import { buildWelcomeEmail } from './templates/welcome';
import { buildPasswordResetEmail } from './templates/passwordReset';
import { buildWaitlistInviteEmail } from './templates/waitlistInvite';
import { buildBookingReminder24hEmail } from './templates/bookingReminder24h';
import { buildBookingRescheduledEmail } from './templates/bookingRescheduled';

// Lazy initialization of Resend client
let _resendClient: Resend | null = null;

function getResendClient() {
  if (!_resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[EMAIL_UNIFIED_ERROR] RESEND_API_KEY is missing.');
    }
    _resendClient = new Resend(apiKey);
  }
  return _resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Nera <agenda@usenera.com>";
const FALLBACK_FROM_EMAIL = "Nera <noreply@usenera.com>";
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || "https://nera.app";

/**
 * Standard Logging Helper
 */
function logEmail(stage: 'START' | 'SUCCESS' | 'ERROR' | 'SKIP_DUPLICATE', event: string, details: any) {
  console.log(`[EMAIL_SEND_${stage}]`, { event, ...details });
}

/**
 * Duplicate Protection Guard
 * This should be used in the caller (e.g. server.ts) using the Appointment's emailEvents field.
 */

// --- PAYLOADS ---

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
  appointmentId?: string;
  paymentMethods?: string[];
}

export interface ProfessionalNotificationPayload {
  professionalEmail: string;
  professionalName: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  price?: string;
  location: string;
  agendaUrl?: string;
  appointmentId?: string;
  bookingId?: string;
  totalPrice?: string | number;
  paymentMethods?: string[];
}

export interface BookingEmailData {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  location: string;
  totalPrice?: string;
  professionalEmail: string;
  professionalName?: string;
  bookingId: string;
  clientEmail?: string;
  manageUrl?: string;
  reviewUrl?: string;
  token?: string;
}

// --- EMAIL FUNCTIONS ---

/**
 * EVENT: booking_created_client
 */
export async function sendBookingPendingEmail(data: PendingEmailPayload) {
  const { clientEmail, clientName, professionalName, professionalWhatsapp, serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods } = data;

  logEmail('START', 'booking_created_client', { to: clientEmail, appointmentId });

  if (!clientEmail) {
    logEmail('ERROR', 'booking_created_client', { error: 'Missing client email' });
    return { success: false, error: 'Missing email' };
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const whatsappMsg = encodeURIComponent(`Olá ${professionalName}, acabei de solicitar meu horário no Nera 💛`);
  const whatsappUrl = `https://wa.me/${professionalWhatsapp.replace(/\D/g, '')}?text=${whatsappMsg}`;

  const html = buildBookingPendingEmail({
    professionalName, serviceName, formattedDate, time, price, reservationCode, manageUrl, whatsappUrl, clientName, paymentMethods
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.com",
      subject: `Seu pedido foi recebido ✨ | ${professionalName}`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'booking_created_client', { error });
      return { success: false, error };
    }

    logEmail('SUCCESS', 'booking_created_client', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_created_client', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: booking_created_professional
 */
export async function sendProfessionalNewBookingEmail(data: ProfessionalNotificationPayload) {
  const { professionalEmail, professionalName, clientName, appointmentId, paymentMethods } = data;

  logEmail('START', 'booking_created_professional', { to: professionalEmail, appointmentId });

  if (!professionalEmail) {
    logEmail('ERROR', 'booking_created_professional', { error: 'Missing pro email' });
    return { success: false, error: 'Missing email' };
  }

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const html = buildProfessionalNewBookingEmail({
    ...data,
    formattedDate,
    paymentMethods
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      subject: `Nova reserva: ${clientName} quer ${data.serviceName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'booking_created_professional', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_created_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_created_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: booking_confirmed_client
 */
export async function sendBookingConfirmedEmail(data: BookingEmailData) {
  const { clientEmail, professionalName, bookingId } = data;

  logEmail('START', 'booking_confirmed_client', { to: clientEmail, appointmentId: bookingId });

  if (!clientEmail) {
    logEmail('ERROR', 'booking_confirmed_client', { error: 'Missing client email' });
    return { success: false, error: 'Email missing' };
  }

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const calendarUrl = data.manageUrl || `${APP_URL}/manage/${bookingId}`;

  const html = buildBookingConfirmedEmail({
    ...data,
    professionalName: professionalName || 'Sua profissional',
    formattedDate,
    calendarUrl
  } as any);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.com",
      subject: `Reserva Confirmada: ${professionalName}`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'booking_confirmed_client', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_confirmed_client', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_confirmed_client', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: booking_cancelled_professional
 */
export async function sendBookingCancelledEmail(data: BookingEmailData) {
  const { professionalEmail, clientName, bookingId } = data;

  logEmail('START', 'booking_cancelled_professional', { to: professionalEmail, appointmentId: bookingId });

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const waitlistUrl = `${APP_URL}/agenda`;

  const html = buildBookingCancelledEmail({
    ...data,
    formattedDate,
    waitlistUrl,
    professionalName: data.professionalName || 'Profissional'
  } as any);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: "oi@usenera.com",
      subject: `Agendamento Cancelado: ${clientName}`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'booking_cancelled_professional', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_cancelled_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_cancelled_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: review_request_client
 */
export async function sendReviewRequestEmail(data: BookingEmailData) {
  const { clientEmail, bookingId, professionalName } = data;

  logEmail('START', 'review_request_client', { to: clientEmail, appointmentId: bookingId });

  if (!clientEmail || !data.reviewUrl) return { success: false, error: 'Email or URL missing' };

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long'
  });

  const html = buildReviewRequestEmail({
    ...data,
    formattedDate,
    professionalName: professionalName || 'sua profissional',
    reviewUrl: data.reviewUrl
  } as any);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.com",
      subject: `Como foi seu atendimento com ${professionalName || 'sua profissional'}?`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'review_request_client', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'review_request_client', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'review_request_client', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: confirmation_request_24h (Unified Function for Reminder/Confirmation)
 */
export async function sendBookingReminder24hEmail(data: any) {
  const { clientEmail, clientName, professionalName, appointmentId, whatsappUrl, manageUrl } = data;

  logEmail('START', 'booking_reminder_24h', { to: clientEmail, appointmentId });

  if (!clientEmail) return { success: false, error: 'Missing email' };

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const html = buildBookingReminder24hEmail({
    ...data,
    formattedDate,
    whatsappUrl: whatsappUrl || '#',
    manageUrl: manageUrl || `${APP_URL}/manage/${appointmentId}`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Lembrete: seu horário amanhã com ${professionalName} ⏰`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'booking_reminder_24h', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_reminder_24h', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_reminder_24h', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: booking_rescheduled_client
 */
export async function sendBookingRescheduledEmail(data: any) {
  const { clientEmail, clientName, professionalName, appointmentId, manageUrl } = data;

  logEmail('START', 'booking_rescheduled_client', { to: clientEmail, appointmentId });

  if (!clientEmail) return { success: false, error: 'Missing email' };

  const oldDateFormatted = new Date(data.oldDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long'
  });

  const newDateFormatted = new Date(data.newDate + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long'
  });

  const html = buildBookingRescheduledEmail({
    ...data,
    oldDate: oldDateFormatted,
    newDate: newDateFormatted,
    manageUrl: manageUrl || `${APP_URL}/manage/${appointmentId}`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Horário reagendado: ${professionalName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'booking_rescheduled_client', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_rescheduled_client', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_rescheduled_client', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: confirmation_request_24h
 */
export async function sendConfirmationRequest24hEmail(data: any) {
  const { clientEmail, clientName, professionalName, appointmentId } = data;

  logEmail('START', 'confirmation_request_24h', { to: clientEmail, appointmentId });

  if (!clientEmail) return { success: false, error: 'Missing email' };

  const formattedDate = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  const html = buildConfirmationRequest24hEmail({
    ...data,
    formattedDate
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Confirmar presença: seu horário amanhã com ${professionalName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'confirmation_request_24h', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'confirmation_request_24h', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'confirmation_request_24h', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: retention_30d
 */
export async function sendRetentionEmail(data: any) {
  const { clientEmail, professionalName, appointmentId } = data;

  logEmail('START', 'retention_30d', { to: clientEmail, appointmentId });

  if (!clientEmail) return { success: false, error: 'Missing email' };

  const html = buildRetentionEmail(data);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Hora de renovar: seu horário com ${professionalName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'retention_30d', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'retention_30d', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'retention_30d', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: waitlist_invite
 */
export async function sendWaitlistInviteEmail(data: { clientName: string, clientEmail: string, professionalName: string, date: string, time: string, bookingUrl: string, appointmentId?: string }) {
  const { clientName, clientEmail, professionalName, date, time, bookingUrl, appointmentId } = data;
  
  logEmail('START', 'waitlist_invite', { to: clientEmail, appointmentId });

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long'
  });

  const html = buildWaitlistInviteEmail({
    clientName, professionalName, formattedDate, time, bookingUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      subject: `Vaga liberada! Agende com ${professionalName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'waitlist_invite', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'waitlist_invite', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'waitlist_invite', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: welcome_professional
 */
export async function sendWelcomeEmail(data: { name: string, email: string }) {
  logEmail('START', 'welcome_professional', { to: data.email });
  const loginUrl = `${APP_URL}/login`;
  
  const html = buildWelcomeEmail({ name: data.name, loginUrl });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: `Bem-vinda ao Nera, ${data.name}!`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'welcome_professional', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'welcome_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'welcome_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: password_reset
 */
export async function sendPasswordResetEmail(data: { email: string, resetUrl: string }) {
  logEmail('START', 'password_reset', { to: data.email });
  const html = buildPasswordResetEmail(data);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: 'Redefinição de senha • Nera',
      html,
    });
    if (error) {
      logEmail('ERROR', 'password_reset', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'password_reset', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'password_reset', { error: err.message });
    return { success: false, error: err.message };
  }
}

