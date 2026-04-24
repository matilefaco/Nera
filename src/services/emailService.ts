import { Resend } from 'resend';
import { buildEmailBase, buildEmailCard } from './emailBuilder';

// Lazy initialization of Resend client to ensure process.env is populated
let _resendClient: Resend | null = null;

function getResendClient() {
  if (!_resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    console.log(`[EMAIL] Initializing Resend client. API Key present: ${!!apiKey}`);
    if (!apiKey) {
      console.error('[EMAIL] CRITICAL: RESEND_API_KEY is missing in runtime environment.');
    }
    _resendClient = new Resend(apiKey);
  }
  return _resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Nera <agendamento@usenera.eu.cc>";

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
  token?: string; // Standardized unique token for URLs
  clientEmail?: string;
  manageUrl?: string; // Link for client to manage booking
  reviewUrl?: string; // Link for client to review
  whatsappUrl?: string;
}

/**
 * Sends a notification email to the professional about a new booking request.
 */
export async function sendNewBookingEmail(data: BookingEmailData) {
  const { 
    clientName, 
    serviceName, 
    date, 
    time, 
    location, 
    totalPrice, 
    professionalEmail,
    professionalName,
    bookingId
  } = data;

  console.log(`[EMAIL] starting send (New Booking) to ${professionalEmail}`);

  if (!professionalEmail) {
    console.error('[EMAIL FLOW] FAILED: professionalEmail is empty');
    return { success: false, error: 'Email missing' };
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const agendaUrl = `${process.env.APP_URL || 'http://localhost:3000'}/agenda?appointment=${bookingId}`;

  const html = buildEmailBase({
    topbarText: 'Nova Reserva',
    heroVariant: 'ink',
    heroLabel: 'Sua agenda',
    heroTitle: 'Nova solicitação',
    heroTitleItalic: 'de agendamento',
    badgeText: 'Aguardando confirmação',
    badgeVariant: 'pending',
    bodyHtml: `
      <p>Olá, ${professionalName || 'Profissional'}!</p>
      <p>Você recebeu um novo pedido de agendamento no Nera. Alguém deseja um momento com você.</p>
      
      ${buildEmailCard([
        { label: 'Cliente', value: clientName },
        { label: 'Serviço', value: serviceName },
        { label: 'Data', value: `${formattedDate} às ${time}` },
        { label: 'Local', value: location }
      ])}
      
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#18120E" style="border: 1px solid #A85C3A; margin-bottom: 30px;">
        <tr>
          <td align="center" style="padding: 25px;">
            <font style="color: #8A7060; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; font-family: Arial, sans-serif; display: block; margin-bottom: 5px;">Investimento Total</font>
            <font style="color: #A85C3A; font-family: Georgia, serif; font-size: 28px; display: block;">${totalPrice || 'Sob consulta'}</font>
          </td>
        </tr>
      </table>
      
      <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center;">
        Dica: Ao confirmar, o horário será removido da sua disponibilidade pública. Você também pode recusar se houver algum conflito.
      </p>
    `,
    ctaText: 'Confirmar Reserva',
    ctaUrl: agendaUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Novo pedido de agendamento: ${clientName}`,
      html,
      headers: {
        'X-Entity-Ref-ID': bookingId,
      },
      tags: [
        { name: 'category', value: 'booking_request' }
      ]
    });

    if (error) {
       console.error('[NEW BOOKING EMAIL] Resend error:', error);
       return { success: false, error: error.message || JSON.stringify(error) };
    }
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    console.error('[NEW BOOKING EMAIL] failed because:', err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends a confirmation email to the client when the professional confirms the booking.
 */
export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  const { 
    clientName, 
    serviceName, 
    date, 
    time, 
    location, 
    clientEmail,
    professionalName,
    manageUrl,
    bookingId,
    token
  } = data;

  if (!clientEmail) {
    console.error('[EMAIL FLOW] FAILED: clientEmail is empty for confirmation');
    return { success: false, error: 'Email missing' };
  }

  console.log(`[EMAIL FLOW] sending client email to ${clientEmail}`);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Prefer Token for official /r/ link, fallback to ID if no token (which shouldn't happen)
  const identifier = token || bookingId;
  const calendarUrl = manageUrl || `${process.env.APP_URL || 'http://localhost:3000'}/r/${identifier}`;

  const html = buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'terracotta',
    heroLabel: 'Sua reserva',
    heroTitle: 'Está confirmada.',
    heroTitleItalic: 'Seu momento chegou.',
    badgeText: 'Reserva Confirmada',
    badgeVariant: 'success',
    bodyHtml: `
      <p>Olá, ${clientName}!</p>
      <p>Boas notícias: seu agendamento com <strong>${professionalName || 'sua profissional'}</strong> foi confirmado com sucesso.</p>
      
      ${buildEmailCard([
        { label: 'Serviço', value: serviceName },
        { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
        { label: 'Profissional', value: professionalName || 'Sua profissional' },
        { label: 'Local', value: location }
      ])}
      
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FDFAF7" style="border: 1px dashed #E5DDD6; margin: 30px 0;">
        <tr>
          <td style="padding: 25px;">
            <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: #8A7060; margin-bottom: 10px; font-family: Arial, sans-serif;">Gestão da Reserva</font>
            <p style="font-size: 13px; color: #18120E; margin: 0 0 15px 0; font-family: Arial, sans-serif;">Você pode gerenciar sua reserva, adicionar ao calendário ou reagendar através do link abaixo.</p>
            <a href="${calendarUrl}" style="color: #A85C3A; font-size: 13px; font-weight: bold; text-decoration: underline; font-family: Arial, sans-serif;">Acessar Painel da Reserva →</a>
          </td>
        </tr>
      </table>
    `,
    ctaText: 'Adicionar ao Calendário',
    ctaUrl: calendarUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Reserva Confirmada: ${professionalName}`,
      html,
      tags: [
        { name: 'category', value: 'booking_confirmation' }
      ]
    });

    if (error) {
      console.error('[CONFIRM EMAIL] Resend error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }
    return { success: true, id: resendData?.id };
  } catch (err: any) {
    console.error('[CONFIRM EMAIL] failed because:', err.message || err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends a 24h reminder email to the professional.
 */
export async function send24hReminderEmail(data: BookingEmailData) {
  const { 
    clientName, 
    serviceName, 
    date, 
    time, 
    location, 
    professionalEmail,
    professionalName,
    bookingId
  } = data;

  console.log(`[EMAIL] starting send (Reminder) to ${professionalEmail}`);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const agendaUrl = `${process.env.APP_URL || 'http://localhost:3000'}/agenda?appointment=${bookingId}`;

  const html = buildEmailBase({
    topbarText: 'Lembrete',
    heroVariant: 'ink',
    heroLabel: 'Amanhã na sua agenda',
    heroTitle: 'Lembrete de',
    heroTitleItalic: 'atendimento',
    badgeText: 'Amanhã',
    badgeVariant: 'alert',
    bodyHtml: `
      <p>Olá, ${professionalName || 'Profissional'}!</p>
      <p>Passando para lembrar que você tem um atendimento programado para amanhã.</p>
      
      ${buildEmailCard([
        { label: 'Cliente', value: clientName },
        { label: 'Serviço', value: serviceName },
        { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
        { label: 'Local', value: location }
      ])}
      
      <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center;">
        Dica: Enviar uma mensagem de confirmação para a cliente no WhatsApp hoje ajuda a reduzir no-shows.
      </p>
    `,
    ctaText: 'Ver na minha Agenda',
    ctaUrl: agendaUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Lembrete: Atendimento amanhã (${clientName})`,
      html,
      tags: [
        { name: 'category', value: 'booking_reminder' }
      ]
    });

    if (error) throw error;
    return { success: true, id: resendData?.id };
  } catch (err) {
    console.error('[EMAIL] error (Reminder):', err);
    throw err;
  }
}

/**
 * Sends a cancellation email to the professional.
 */
export async function sendBookingCancellationEmail(data: BookingEmailData) {
  const { 
    clientName, 
    serviceName, 
    date, 
    time, 
    professionalEmail,
    professionalName
  } = data;

  console.log(`[EMAIL] starting send (Cancellation) to ${professionalEmail}`);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const waitlistUrl = `${process.env.APP_URL || 'http://localhost:3000'}/agenda`;

  const html = buildEmailBase({
    topbarText: 'Cancelamento',
    heroVariant: 'ink',
    heroLabel: 'Horário liberado',
    heroTitle: 'Reserva',
    heroTitleItalic: 'cancelada',
    badgeText: 'Reserva Cancelada',
    badgeVariant: 'pending',
    bodyHtml: `
      <p>Olá, ${professionalName || 'Profissional'}!</p>
      <p>Informamos que o agendamento de <strong>${clientName}</strong> foi cancelado.</p>
      
      ${buildEmailCard([
        { label: 'Cliente', value: clientName },
        { label: 'Serviço', value: serviceName },
        { label: 'Data Original', value: `${formattedDate} às ${time}` }
      ])}
      
      <p>O horário foi liberado instantaneamente na sua agenda e está disponível para novas reservas.</p>
      
      <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center;">
        Dica: Você pode verificar sua Lista de Espera para encaixar outra cliente interessada neste período.
      </p>
    `,
    ctaText: 'Ver Lista de Espera',
    ctaUrl: waitlistUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [professionalEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Agendamento Cancelado: ${clientName}`,
      html,
      tags: [
        { name: 'category', value: 'booking_cancellation' }
      ]
    });

    if (error) throw error;
    return { success: true, id: resendData?.id };
  } catch (err) {
    console.error('[EMAIL] error (Cancellation):', err);
    throw err;
  }
}

/**
 * Sends a review request email to the client after the service is completed.
 */
export async function sendReviewRequestEmail(data: BookingEmailData) {
  const { 
    clientName, 
    serviceName, 
    date, 
    clientEmail,
    professionalName,
    reviewUrl
  } = data;

  if (!clientEmail || !reviewUrl) return;

  console.log(`[EMAIL] starting send (Review Request) to ${clientEmail}`);

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long'
  });

  const html = buildEmailBase({
    topbarText: 'Avaliação',
    heroVariant: 'parchment',
    heroLabel: 'Experiência concluída',
    heroTitle: 'Como foi seu',
    heroTitleItalic: 'atendimento?',
    badgeText: 'Avalie sua experiência',
    badgeVariant: 'info',
    bodyHtml: `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
        <tr>
          <td align="center">
            <font style="font-size: 24px;">⭐⭐⭐⭐⭐</font>
          </td>
        </tr>
      </table>
      <p>Olá, ${clientName}!</p>
      <p>O seu atendimento de <strong>${serviceName}</strong> com <strong>${professionalName || 'sua profissional'}</strong> foi concluído.</p>
      <p>Sua opinião é fundamental para mantermos o padrão de excelência e ajudar outras clientes a conhecerem o trabalho da profissional.</p>
      
      ${buildEmailCard([
        { label: 'Profissional', value: professionalName || 'Sua profissional' },
        { label: 'Data', value: formattedDate }
      ])}
      
      <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center; margin-top: 30px;">
        Sua avaliação leva menos de 1 minuto. ✨
      </p>
    `,
    ctaText: 'Avaliar meu Atendimento',
    ctaUrl: reviewUrl
  });

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [clientEmail],
      replyTo: "oi@usenera.eu.cc",
      subject: `Como foi seu atendimento com ${professionalName || 'sua profissional'}?`,
      html,
      tags: [
        { name: 'category', value: 'review_request' }
      ]
    });

    if (error) throw error;
    return { success: true, id: resendData?.id };
  } catch (err) {
    console.error('[EMAIL] error (Review Request):', err);
    throw err;
  }
}

/**
 * Generic function to send a raw email using the official system.
 */
export async function sendRawEmail(to: string, subject: string, body: string, options?: { isHtml?: boolean, customHtml?: string, replyTo?: string }) {
  const from = FROM_EMAIL;
  console.log(`[EMAIL TEST] starting send to ${to}`);
  
  try {
    const resend = getResendClient();
    
    // If it's a test or simple notification, we wrap it in basic premium shell if no customHtml
    const htmlToUse = options?.customHtml || buildEmailBase({
      topbarText: 'Notificação',
      heroVariant: 'ink',
      heroLabel: 'Aviso do Sistema',
      heroTitle: 'Informação',
      heroTitleItalic: 'importante',
      bodyHtml: `<p>${body.replace(/\n/g, '<br>')}</p>`,
    });

    const result = await resend.emails.send({
      from,
      to: [to],
      replyTo: options?.replyTo || "oi@usenera.eu.cc",
      subject,
      text: body,
      html: htmlToUse,
      tags: [
        { name: 'category', value: 'transactional_test' }
      ]
    });

    if (result.error) throw result.error;
    return { success: true, id: result.data?.id };
  } catch (err: any) {
    console.error('[EMAIL TEST] error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends an invitation to a client in the waitlist when a spot opens up.
 */
export async function sendWaitlistInviteEmail(data: { clientName: string, clientEmail: string, professionalName: string, date: string, time: string, bookingUrl: string }) {
  const { clientName, clientEmail, professionalName, date, time, bookingUrl } = data;
  
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long'
  });

  const html = buildEmailBase({
    topbarText: 'Oportunidade',
    heroVariant: 'terracotta',
    heroLabel: 'Lista de espera',
    heroTitle: 'Um horário',
    heroTitleItalic: 'ficou disponível',
    badgeText: 'Vaga Liberada',
    badgeVariant: 'success',
    bodyHtml: `
      <p>Olá, ${clientName}!</p>
      <p>Temos ótimas notícias: um horário abriu na agenda de <strong>${professionalName}</strong> exatamente no período que você desejava.</p>
      
      ${buildEmailCard([
        { label: 'Data', value: formattedDate },
        { label: 'Horário', value: time },
        { label: 'Profissional', value: professionalName }
      ])}
      
      <p>Este convite é exclusivo para você, mas corra: outras clientes na lista também foram notificadas e a vaga será preenchida por quem confirmar primeiro.</p>
    `,
    ctaText: 'Reservar Agora',
    ctaUrl: bookingUrl
  });

  const resend = getResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to: [clientEmail],
    subject: `Vaga liberada! Agende com ${professionalName}`,
    html,
    tags: [{ name: 'category', value: 'waitlist_invite' }]
  });
}

/**
 * Sends a welcome email to new professionals.
 */
export async function sendWelcomeEmail(data: { name: string, email: string }) {
  const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;
  
  const html = buildEmailBase({
    topbarText: 'Bem-vinda',
    heroVariant: 'ink',
    heroLabel: 'Comece agora',
    heroTitle: 'Seja bem-vinda',
    heroTitleItalic: 'ao Universo Nera',
    bodyHtml: `
      <p>Olá, ${data.name}!</p>
      <p>É um prazer ter você conosco. O Nera foi criado para profissionais que buscam excelência na gestão e uma experiência premium para suas clientes.</p>
      <p>Sua jornada para uma agenda mais inteligente e lucrativa começa aqui.</p>
      
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FDFAF7" style="border: 1px solid #E5DDD6; margin: 30px 0;">
        <tr>
          <td style="padding: 25px;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #18120E; font-family: Arial, sans-serif;">Próximos passos:</p>
            <ul style="margin: 0; padding-left: 20px; color: #8A7060; font-size: 14px; font-family: Arial, sans-serif;">
              <li style="margin-bottom: 8px;">Configure seus serviços e valores</li>
              <li style="margin-bottom: 8px;">Defina seus horários de atendimento</li>
              <li>Compartilhe seu link exclusivo com suas clientes</li>
            </ul>
          </td>
        </tr>
      </table>
    `,
    ctaText: 'Acessar meu Painel',
    ctaUrl: loginUrl
  });

  const resend = getResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to: [data.email],
    subject: `Bem-vinda ao Nera, ${data.name}!`,
    html,
    tags: [{ name: 'category', value: 'welcome' }]
  });
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordResetEmail(data: { email: string, resetUrl: string }) {
  const html = buildEmailBase({
    topbarText: 'Segurança',
    heroVariant: 'ink',
    heroLabel: 'Recuperação de conta',
    heroTitle: 'Redefinição',
    heroTitleItalic: 'de senha',
    badgeText: 'Ação Necessária',
    badgeVariant: 'alert',
    bodyHtml: `
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no Nera.</p>
      <p>Se você não solicitou essa alteração, pode ignorar este email com segurança. Seus dados continuam protegidos.</p>
      <p>Para criar uma nova senha, clique no botão abaixo:</p>
    `,
    ctaText: 'Redefinir Senha',
    ctaUrl: data.resetUrl
  });

  const resend = getResendClient();
  return resend.emails.send({
    from: FROM_EMAIL,
    to: [data.email],
    subject: 'Redefinição de senha • Nera',
    html,
    tags: [{ name: 'category', value: 'password_reset' }]
  });
}
