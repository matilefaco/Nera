import { Resend } from 'resend';

// Initialize Resend with API Key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface BookingEmailData {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  location: string;
  totalPrice?: string;
  professionalEmail: string;
  bookingId: string;
  clientEmail?: string;
  professionalName?: string;
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
    bookingId
  } = data;

  console.log(`[EmailService] Preparing payload for ${professionalEmail}...`);

  // Format date for better readability (assuming YYYY-MM-DD)
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const agendaUrl = `${process.env.APP_URL || 'http://localhost:3000'}/agenda?appointment=${bookingId}`;

  try {
    console.log(`[EmailService] Sending with Resend to ${professionalEmail}...`);
    
    const { data: resendData, error } = await resend.emails.send({
      from: 'Nera <agendamentos@nerabeauty.com.br>',
      to: [professionalEmail],
      subject: `Novo pedido de agendamento: ${clientName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="color: #2D2424; font-size: 24px; margin-bottom: 24px;">Novo pedido de agendamento</h1>
          
          <p>Olá! Você recebeu um novo pedido de agendamento no Nera 💅.</p>
          
          <div style="background-color: #F9F7F5; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0;"><strong>Cliente:</strong> ${clientName}</p>
            <p style="margin: 0 0 12px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 0 0 12px 0;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 12px 0;"><strong>Horário:</strong> ${time}</p>
            <p style="margin: 0 0 12px 0;"><strong>Local:</strong> ${location}</p>
            <p style="margin: 0; font-size: 18px; color: #8B4513;"><strong>Valor Total:</strong> ${totalPrice}</p>
          </div>
          
          <p style="margin-bottom: 32px;">Para garantir o atendimento e remover o bloqueio temporário do seu horário, clique em confirmar abaixo:</p>
          
          <a href="${agendaUrl}" style="background-color: #2D2424; color: #ffffff; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: bold; display: inline-block;">
            Confirmar Agendamento
          </a>
          
          <p style="margin-top: 48px; font-size: 12px; color: #999;">
            Este é um e-mail automático enviado pelo sistema Nera.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[EmailService] Resend Error:', error);
      throw error;
    }

    console.log('[EmailService] Send success:', resendData?.id);
    return { success: true, id: resendData?.id };
  } catch (err) {
    console.error('[EmailService] Send failed:', err);
    throw err;
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
    professionalName
  } = data;

  if (!clientEmail) return;

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  try {
    const { data: resendData, error } = await resend.emails.send({
      from: 'Nera <agendamentos@nerabeauty.com.br>',
      to: [clientEmail],
      subject: `Agendamento Confirmado: ${professionalName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="color: #2D2424; font-size: 24px; margin-bottom: 24px;">Seu agendamento está confirmado! ✨</h1>
          
          <p>Olá, ${clientName}! Boas notícias: o seu horário com <strong>${professionalName}</strong> foi confirmado.</p>
          
          <div style="background-color: #F9F7F5; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 0 0 12px 0;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 12px 0;"><strong>Horário:</strong> ${time}</p>
            <p style="margin: 0 0 12px 0;"><strong>Local:</strong> ${location}</p>
          </div>
          
          <p style="margin-bottom: 32px;">Tudo pronto para o seu momento de beleza. Caso precise cancelar ou remarcar, entre em contato diretamente com a profissional.</p>
          
          <p style="margin-top: 48px; font-size: 12px; color: #999;">
            Este é um e-mail automático enviado pelo sistema Nera.
          </p>
        </div>
      `,
    });

    if (error) throw error;
    return { success: true, id: resendData?.id };
  } catch (err) {
    console.error('[EmailService] Confirmation send failed:', err);
    throw err;
  }
}
