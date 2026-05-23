
import { Resend } from 'resend';
import { buildBookingPendingEmail } from './templates/bookingPending.js';
import { buildProfessionalNewBookingEmail } from './templates/professionalNewBooking.js';
import { buildConfirmationRequest24hEmail } from './templates/confirmationRequest24h.js';
import { buildRetentionEmail } from './templates/retention.js';
import { buildBookingConfirmedEmail } from './templates/bookingConfirmed.js';
import { buildBookingCancelledEmail } from './templates/bookingCancelled.js';
import { buildBookingCancelledClientEmail } from './templates/bookingCancelledClient.js';
import { buildReviewRequestEmail } from './templates/reviewRequest.js';
import { buildWelcomeEmail } from './templates/welcome.js';
import { buildPasswordResetEmail } from './templates/passwordReset.js';
import { buildWaitlistInviteEmail } from './templates/waitlistInvite.js';
import { buildBookingReminder24hEmail } from './templates/bookingReminder24h.js';
import { buildBookingRescheduledEmail } from './templates/bookingRescheduled.js';
import { buildDigitalReceiptEmail } from './templates/digitalReceipt.js';
import { buildReferralRewardEmail } from './templates/referralReward.js';
import { buildTrialWillEndEmail } from './templates/trialWillEnd.js';
import { buildVerificationEmail } from './templates/verificationEmail.js';
import { buildProfessionalBookingRescheduledEmail } from './templates/professionalBookingRescheduled.js';
import { buildReviewReceivedEmail } from './templates/reviewReceived.js';
import { buildDailyDigestEmail } from './templates/dailyDigest.js';
import { buildReviewMilestoneEmail } from './templates/reviewMilestone.js';
import { buildRescheduleRequestedEmail } from './templates/rescheduleRequested.js';
import { logger, maskEmail, maskToken } from '../utils/logger.js';
import { PUBLIC_APP_URL } from '../utils.js';

// Lazy initialization of Resend client
let _resendClient: Resend | null = null;

function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.includes('@');
}

function getResendClient() {
  if (!_resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn("EMAIL", "RESEND_API_KEY is missing in environment");
    }
    _resendClient = new Resend(apiKey);
  }
  return _resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Nera <ola@usenera.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "contato@usenera.com";
const APP_URL = PUBLIC_APP_URL;

/**
 * Standard Logging Helper
 */
function logEmail(stage: 'START' | 'SUCCESS' | 'ERROR' | 'SKIP_DUPLICATE', event: string, details: any) {
  const meta: any = { event };
  if (details.appointmentId) meta.appointmentId = details.appointmentId;
  if (details.professionalId) meta.professionalId = details.professionalId;
  if (details.resendId) meta.resendId = maskToken(details.resendId);
  if (details.error) meta.error = typeof details.error === 'string' ? details.error : details.error?.message || JSON.stringify(details.error);
  
  const ctx = {
    meta,
    recipient: details.to ? maskEmail(details.to) : 'not_provided'
  };

  if (stage === 'ERROR') {
    const errorStr = (meta.error || '').toString();
    if (errorStr.includes('testing emails') || errorStr.includes('verify a domain')) {
      logger.warn("EMAIL", `Email dispatch skipped (Sandbox restriction)`, ctx);
    } else {
      logger.error("EMAIL", `Email dispatch failed: ${meta.error}`, ctx);
    }
  } else if (stage === 'SUCCESS') {
    logger.info("EMAIL", `Email verified delivery`, ctx);
  } else if (stage === 'SKIP_DUPLICATE') {
    logger.info("EMAIL", `Email skipped duplicate`, ctx);
  } else {
    logger.info("EMAIL", `Email dispatch started`, ctx);
  }
}

/**
 * Date Formatter Guard
 */
function formatDateSafely(dateStr: string | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return 'Data não informada';
  try {
    // Expected format YYYY-MM-DD
    const dateObj = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    if (isNaN(dateObj.getTime())) return dateStr;
    return dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
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
  clientWhatsapp: string;
  whatsappUrl?: string;
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
  prepInstructions?: string;
  whatsappUrl?: string;
  cancellationReason?: string;
  waitlistCount?: number;
  profileUrl?: string;
  locationType?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

// --- EMAIL FUNCTIONS ---

/**
 * EVENT: booking_created_client
 */
export async function sendBookingPendingEmail(data: PendingEmailPayload) {
  const { clientEmail, clientName, professionalName, professionalWhatsapp, serviceName, date, time, price, reservationCode, manageUrl, appointmentId, paymentMethods } = data;

  logEmail('START', 'booking_created_client', { to: clientEmail, appointmentId });

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'booking_created_client', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  if (!professionalName || !serviceName) {
    logEmail('ERROR', 'booking_created_client', { error: 'Missing critical data (pro name or service)', appointmentId });
    return { success: false, error: 'Missing critical data' };
  }

  const formattedDate = formatDateSafely(date);
  const whatsappMsg = encodeURIComponent(`Olá ${professionalName}, acabei de solicitar meu horário na Nera 💛`);
  const whatsappUrl = `https://wa.me/${(professionalWhatsapp || '').replace(/\D/g, '')}?text=${whatsappMsg}`;

  const html = buildBookingPendingEmail({
    professionalName, serviceName, formattedDate, time, price: price || 'A definir', reservationCode, manageUrl: manageUrl || APP_URL, whatsappUrl, clientName: clientName || 'Cliente', paymentMethods
  });

  try {
    const resend = getResendClient();
    logger.info("EMAIL", `Sending email from: ${FROM_EMAIL}`, { to: maskEmail(clientEmail), event: 'booking_created_client' });
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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
  const { professionalEmail, professionalName, clientName, appointmentId, paymentMethods, clientWhatsapp } = data;

  logEmail('START', 'booking_created_professional', { to: professionalEmail, appointmentId });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'booking_created_professional', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);

  const html = buildProfessionalNewBookingEmail({
    ...data,
    professionalName: professionalName || 'Profissional',
    clientName: clientName || 'Cliente',
    formattedDate,
    paymentMethods: paymentMethods || [],
    clientWhatsapp: clientWhatsapp || 'Não informado'
  });

  try {
    const resend = getResendClient();
    logger.info("EMAIL", `Sending email from: ${FROM_EMAIL}`, { to: maskEmail(professionalEmail), event: 'booking_created_professional' });
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
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

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'booking_confirmed_client', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);
  const calendarUrl = data.manageUrl || `${APP_URL}/manage/${bookingId}`;
  const manageUrl = data.manageUrl || `${APP_URL}/manage/${bookingId}`;

  const html = buildBookingConfirmedEmail({
    ...data,
    clientName: data.clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional',
    formattedDate,
    calendarUrl,
    manageUrl
  } as any);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'booking_cancelled_professional', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);
  const waitlistUrl = `${APP_URL}/agenda`;

  const html = buildBookingCancelledEmail({
    ...data,
    clientName: clientName || 'Cliente',
    formattedDate,
    waitlistUrl,
    professionalName: data.professionalName || 'Profissional'
  } as any);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `Aviso de cancelamento: ${clientName}`,
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
 * EVENT: booking_cancelled_client
 */
export async function sendBookingCancelledClientEmail(data: BookingEmailData) {
  const { clientEmail, professionalName, bookingId } = data;

  logEmail('START', 'booking_cancelled_client', { to: clientEmail, appointmentId: bookingId });

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'booking_cancelled_client', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);

  const html = buildBookingCancelledClientEmail({
    professionalName: professionalName || 'Sua profissional',
    clientName: data.clientName || 'Cliente',
    serviceName: data.serviceName || 'Serviço',
    formattedDate,
    time: data.time || '',
    profileUrl: data.profileUrl || APP_URL,
    cancellationReason: data.cancellationReason
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail!],
      replyTo: REPLY_TO,
      subject: `Agendamento cancelado: ${professionalName || 'Nera'}`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'booking_cancelled_client', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_cancelled_client', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_cancelled_client', { error: err.message });
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
      replyTo: REPLY_TO,
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

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'booking_reminder_24h', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);

  const html = buildBookingReminder24hEmail({
    ...data,
    clientName: clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional',
    duration: data.duration || 60,
    confirmUrl: manageUrl || `${APP_URL}/manage/${appointmentId}`,
    formattedDate,
    whatsappUrl: whatsappUrl || '#',
    manageUrl: manageUrl || `${APP_URL}/manage/${appointmentId}`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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
  const { clientEmail, clientName, professionalName, appointmentId, manageUrl, rescheduledBy, cancelUrl } = data;

  logEmail('START', 'booking_rescheduled_client', { to: clientEmail, appointmentId });

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'booking_rescheduled_client', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const oldDateFormatted = formatDateSafely(data.oldDate);
  const newDateFormatted = formatDateSafely(data.newDate);

  const html = buildBookingRescheduledEmail({
    ...data,
    clientName: clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional',
    rescheduledBy: rescheduledBy || 'professional',
    cancelUrl: cancelUrl || `${APP_URL}/manage/${appointmentId}/cancel`,
    oldDate: oldDateFormatted,
    newDate: newDateFormatted,
    manageUrl: manageUrl || `${APP_URL}/manage/${appointmentId}`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
      subject: `Seu horário foi reagendado • ${professionalName}`,
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

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'confirmation_request_24h', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(data.date);

  const html = buildConfirmationRequest24hEmail({
    ...data,
    clientName: clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional',
    formattedDate
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'retention_30d', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildRetentionEmail({
    ...data,
    clientName: data.clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional'
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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
export async function sendWaitlistInviteEmail(data: { 
  clientName: string, 
  clientEmail: string, 
  professionalName: string, 
  date: string, 
  time: string, 
  bookingUrl: string, 
  serviceName: string,
  servicePrice?: string,
  expiresInHours: number,
  isExclusive?: boolean,
  appointmentId?: string 
}) {
  const { 
    clientName, 
    clientEmail, 
    professionalName, 
    date, 
    time, 
    bookingUrl, 
    serviceName,
    servicePrice,
    expiresInHours,
    isExclusive,
    appointmentId 
  } = data;
  
  logEmail('START', 'waitlist_invite', { to: clientEmail, appointmentId });

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'waitlist_invite', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(date);

  const html = buildWaitlistInviteEmail({
    clientName: clientName || 'Cliente', 
    professionalName: professionalName || 'Sua profissional', 
    serviceName: serviceName || 'Atendimento',
    servicePrice,
    formattedDate, 
    time: time || '', 
    bookingUrl: bookingUrl || APP_URL,
    expiresInHours: expiresInHours || 2,
    isExclusive
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
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
export async function sendWelcomeEmail(data: { name: string, email: string, slug?: string }) {
  logEmail('START', 'welcome_professional', { to: data.email });

  if (!isValidEmail(data.email)) {
    logEmail('ERROR', 'welcome_professional', { error: 'Invalid email', to: data.email });
    return { success: false, error: 'Invalid email' };
  }

  const onboardingUrl = `${APP_URL}/onboarding`;
  const slug = data.slug || 'profissional';
  
  const html = buildWelcomeEmail({ 
    name: data.name || 'Profissional', 
    slug, 
    onboardingUrl 
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      replyTo: REPLY_TO,
      subject: `Boas-vindas à Nera, ${data.name} ✨`,
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

  if (!isValidEmail(data.email)) {
    logEmail('ERROR', 'password_reset', { error: 'Invalid email', to: data.email });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildPasswordResetEmail(data);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      replyTo: REPLY_TO,
      subject: 'Instruções para redefinir sua senha • Nera',
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

/**
 * EVENT: email_verification
 */
export async function sendVerificationEmail(data: { email: string, verificationUrl: string }) {
  logEmail('START', 'email_verification', { to: data.email });

  if (!isValidEmail(data.email)) {
    logEmail('ERROR', 'email_verification', { error: 'Invalid email', to: data.email });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildVerificationEmail(data);

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      replyTo: REPLY_TO,
      subject: 'Confirme sua conta na Nera ✨',
      html,
    });
    if (error) {
      logEmail('ERROR', 'email_verification', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'email_verification', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'email_verification', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: referral_reward
 */
export async function sendReferralRewardEmail(data: { referrerEmail: string, referrerName: string, refereeName: string, amount: number }) {
  const { referrerEmail, referrerName, refereeName, amount } = data;
  logEmail('START', 'referral_reward', { to: referrerEmail });

  if (!isValidEmail(referrerEmail)) {
    logEmail('ERROR', 'referral_reward', { error: 'Invalid referrer email', to: referrerEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildReferralRewardEmail({
    referrerName: referrerName || 'Profissional',
    refereeName: refereeName || 'Sua indicação',
    amount: amount || 0
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [referrerEmail],
      replyTo: REPLY_TO,
      subject: `Sua indicação rendeu R$${amount} em créditos ✨`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'referral_reward', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'referral_reward', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'referral_reward', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: trial_will_end
 */
export async function sendTrialWillEndEmail(data: { email: string, name: string, trialEndAt: string }) {
  const { email, name, trialEndAt } = data;
  logEmail('START', 'trial_will_end', { to: email });

  if (!isValidEmail(email)) {
    logEmail('ERROR', 'trial_will_end', { error: 'Invalid user email', to: email });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(trialEndAt);

  const html = buildTrialWillEndEmail({
    name: name || 'Profissional',
    formattedDate,
    dashboardUrl: `${APP_URL}/dashboard`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      replyTo: REPLY_TO,
      subject: `Aviso: seu período de teste está chegando ao fim • Nera`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'trial_will_end', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'trial_will_end', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'trial_will_end', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * EVENT: digital_receipt (Sent upon appointment completion)
 */
export async function sendDigitalReceiptEmail(data: any) {
  const { clientEmail, clientName, professionalName, appointmentId, serviceName, date, time, totalPrice, price, bookingUrl, reviewUrl } = data;

  logEmail('START', 'digital_receipt', { to: clientEmail, appointmentId });

  if (!isValidEmail(clientEmail)) {
    logEmail('ERROR', 'digital_receipt', { error: 'Invalid client email', to: clientEmail });
    return { success: false, error: 'Invalid email' };
  }

  const formattedDate = formatDateSafely(date);

  const finalPrice = totalPrice || price || 0;
  const numPrice = Number(finalPrice);
  const formattedPrice = `R$ ${(isNaN(numPrice) ? 0 : numPrice).toFixed(2).replace('.', ',')}`;
  
  // Use slug to build bookingUrl if available and not explicitly provided
  const finalBookingUrl = bookingUrl || (data.slug ? `${APP_URL}/p/${data.slug}` : APP_URL);

  const html = buildDigitalReceiptEmail({
    clientName: clientName || 'Cliente',
    professionalName: professionalName || 'Sua profissional',
    serviceName: serviceName || 'Atendimento',
    formattedDate,
    time: time || '',
    price: formattedPrice,
    bookingUrl: finalBookingUrl,
    reviewUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: REPLY_TO,
      subject: `Resumo do seu atendimento com ${professionalName || 'sua profissional'} ✨`,
      html,
    });

    if (error) {
      logEmail('ERROR', 'digital_receipt', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'digital_receipt', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'digital_receipt', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function sendProfessionalBookingRescheduledEmail(data: any) {
  const { professionalEmail, professionalName, clientName, serviceName, oldFormatDate, oldTime, newFormatDate, newTime, agendaUrl } = data;

  logEmail('START', 'booking_rescheduled_professional', { to: professionalEmail });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'booking_rescheduled_professional', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildProfessionalBookingRescheduledEmail({
    professionalName, clientName, serviceName, oldFormatDate, oldTime, newFormatDate, newTime, agendaUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL, // Utilizando o remetente verificado central
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `Horário reagendado • ${clientName}`,
      html,
    });
    if (error) {
      logEmail('ERROR', 'booking_rescheduled_professional', { error });
      return { success: false, error };
    }
    logEmail('SUCCESS', 'booking_rescheduled_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'booking_rescheduled_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function sendReviewReceivedEmail(data: {
  professionalEmail: string;
  professionalName: string;
  clientName: string;
  rating: number;
  comment: string;
  dashboardUrl?: string;
  reviewId?: string;
}) {
  const { professionalEmail, professionalName, clientName, rating, comment, dashboardUrl, reviewId } = data;

  logEmail('START', 'review_received_professional', { to: professionalEmail });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'review_received_professional', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildReviewReceivedEmail({
    professionalName: professionalName || 'Profissional',
    clientName: clientName || 'Cliente anônimo',
    rating: rating || 5,
    comment: comment || '',
    dashboardUrl: dashboardUrl || `${APP_URL}/dashboard`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `✨ Você recebeu uma nova avaliação de ${clientName}`,
      html,
    });
    
    if (error) {
      logEmail('ERROR', 'review_received_professional', { error });
      return { success: false, error };
    }
    
    logEmail('SUCCESS', 'review_received_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'review_received_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function sendDailyDigestEmail(data: {
  professionalEmail: string;
  professionalName: string;
  confirmedCount: number;
  pendingCount: number;
  firstAppointmentTime?: string;
  totalAppointments: number;
  agendaUrl?: string;
}) {
  const { professionalEmail, professionalName, confirmedCount, pendingCount, firstAppointmentTime, totalAppointments, agendaUrl } = data;

  logEmail('START', 'daily_digest_professional', { to: professionalEmail });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'daily_digest_professional', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildDailyDigestEmail({
    professionalName: professionalName || 'Profissional',
    confirmedCount: confirmedCount || 0,
    pendingCount: pendingCount || 0,
    firstAppointmentTime,
    totalAppointments: totalAppointments || 0,
    agendaUrl: agendaUrl || `${APP_URL}/dashboard`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `Resumo do dia • Nera ✨`,
      html,
    });
    
    if (error) {
      logEmail('ERROR', 'daily_digest_professional', { error });
      return { success: false, error };
    }
    
    logEmail('SUCCESS', 'daily_digest_professional', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'daily_digest_professional', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function sendReviewMilestoneEmail(data: {
  professionalEmail: string;
  professionalName: string;
  milestoneTitle: string;
  milestoneMessage: string;
  profileUrl: string;
}) {
  const { professionalEmail, professionalName, milestoneTitle, milestoneMessage, profileUrl } = data;

  logEmail('START', 'review_milestone', { to: professionalEmail });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'review_milestone', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildReviewMilestoneEmail({
    professionalName: professionalName || 'Profissional',
    milestoneTitle,
    milestoneMessage,
    dashboardUrl: profileUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `✨ ${milestoneTitle} • Nera`,
      html,
    });
    
    if (error) {
      logEmail('ERROR', 'review_milestone', { error });
      return { success: false, error };
    }
    
    logEmail('SUCCESS', 'review_milestone', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'review_milestone', { error: err.message });
    return { success: false, error: err.message };
  }
}

export async function sendRescheduleRequestedEmail(data: {
  professionalEmail: string;
  professionalName: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  dashboardUrl?: string;
}) {
  const { professionalEmail, professionalName, clientName, serviceName, date, time, dashboardUrl } = data;

  logEmail('START', 'reschedule_requested', { to: professionalEmail });

  if (!isValidEmail(professionalEmail)) {
    logEmail('ERROR', 'reschedule_requested', { error: 'Invalid pro email', to: professionalEmail });
    return { success: false, error: 'Invalid email' };
  }

  const html = buildRescheduleRequestedEmail({
    professionalName: professionalName || 'Profissional',
    clientName: clientName || 'Cliente',
    serviceName: serviceName || 'Serviço',
    date: date || '',
    time: time || '',
    dashboardUrl: dashboardUrl || `${APP_URL}/dashboard`
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: REPLY_TO,
      subject: `Mudança de planos • ${clientName}`,
      html,
    });
    
    if (error) {
      logEmail('ERROR', 'reschedule_requested', { error });
      return { success: false, error };
    }
    
    logEmail('SUCCESS', 'reschedule_requested', { resendId: resendData?.id });
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    logEmail('ERROR', 'reschedule_requested', { error: err.message });
    return { success: false, error: err.message };
  }
}
