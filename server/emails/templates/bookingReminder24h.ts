import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface BookingReminderData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  professionalName: string;
  location: string;
  manageUrl: string;
  whatsappUrl: string;
}

export function buildBookingReminder24hEmail(data: BookingReminderData): string {
  const { 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    professionalName, 
    location, 
    manageUrl,
    whatsappUrl
  } = data;

  const bodyHtml = `
    <p>Olá, ${clientName}!</p>
    <p>Passando para lembrar do seu momento de autocuidado com <strong>${professionalName || 'sua profissional'}</strong> amanhã.</p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time },
      { label: 'Local', value: location }
    ])}
    
    <p style="margin-top: 30px; font-size: 14px; line-height: 1.6; color: #18120E;">
      Caso precise falar com a profissional ou ajustar algo, utilize os botões abaixo.
    </p>

    <div style="margin-top: 30px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <a href="${manageUrl}" style="background-color: #18120E; color: #ffffff; padding: 15px 35px; border-radius: 9999px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; display: inline-block; font-family: Arial, sans-serif;">
              Gerenciar Reserva
            </a>
          </td>
        </tr>
        <tr>
          <td align="center">
            <a href="${whatsappUrl}" style="background-color: #ffffff; color: #8A7060; padding: 12px 30px; border-radius: 9999px; border: 1px solid #E5DDD6; text-decoration: none; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; display: inline-block; font-family: Arial, sans-serif;">
              Falar no WhatsApp
            </a>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-size: 12px; color: #8A7060; font-style: italic; text-align: center; margin-top: 40px; border-top: 1px solid #E5DDD6; padding-top: 20px;">
      Mal podemos esperar para te ver amanhã! ✨
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Lembrete',
    heroVariant: 'terracotta',
    heroLabel: 'Seu horário é amanhã',
    heroTitle: 'Te vemos em',
    heroTitleItalic: 'menos de 24 horas ⏰',
    bodyHtml,
    ctaText: 'Ver Detalhes da Reserva',
    ctaUrl: manageUrl
  });
}
