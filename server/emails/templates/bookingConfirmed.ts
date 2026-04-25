import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface BookingConfirmedData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  professionalName: string;
  location: string;
  calendarUrl: string;
}

export function buildBookingConfirmedEmail(data: BookingConfirmedData): string {
  const { 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    professionalName, 
    location, 
    calendarUrl 
  } = data;

  const bodyHtml = `
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
  `;

  return buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'terracotta',
    heroLabel: 'Sua reserva',
    heroTitle: 'Está confirmada.',
    heroTitleItalic: 'Seu momento chegou.',
    badgeText: 'Reserva Confirmada',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Adicionar ao Calendário',
    ctaUrl: calendarUrl
  });
}
