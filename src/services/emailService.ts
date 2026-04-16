import { Resend } from 'resend';

// Initialize Resend with API Key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

export interface BookingEmailData {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  location: string;
  totalPrice: string;
  professionalEmail: string;
  bookingId: string;
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

  const dashboardUrl = `${process.env.APP_URL || 'http://localhost:3000'}/admin/bookings/${bookingId}`;

  try {
    console.log(`[EmailService] Sending with Resend to ${professionalEmail}...`);
    
    const { data: resendData, error } = await resend.emails.send({
      from: 'Nera <agendamentos@nerabeauty.com.br>', // In production, this must be a verified domain
      to: [professionalEmail],
      subject: `Novo pedido de agendamento: ${clientName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="color: #2D2424; font-size: 24px; margin-bottom: 24px;">Novo pedido de agendamento</h1>
          
          <p>Olá! Você recebeu um novo pedido de agendamento através do Nera.</p>
          
          <div style="background-color: #F9F7F5; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0;"><strong>Cliente:</strong> ${clientName}</p>
            <p style="margin: 0 0 12px 0;"><strong>Serviço:</strong> ${serviceName}</p>
            <p style="margin: 0 0 12px 0;"><strong>Data:</strong> ${formattedDate}</p>
            <p style="margin: 0 0 12px 0;"><strong>Horário:</strong> ${time}</p>
            <p style="margin: 0 0 12px 0;"><strong>Local:</strong> ${location}</p>
            <p style="margin: 0; font-size: 18px; color: #8B4513;"><strong>Valor Total:</strong> ${totalPrice}</p>
          </div>
          
          <p style="margin-bottom: 32px;">Por favor, revise o pedido e responda à cliente o quanto antes para garantir a reserva.</p>
          
          <a href="${dashboardUrl}" style="background-color: #2D2424; color: #ffffff; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: bold; display: inline-block;">
            Ver e Responder Pedido
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
