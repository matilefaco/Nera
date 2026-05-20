import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingCancelledClientData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  profileUrl?: string;
  cancellationReason?: string;
}

export function buildBookingCancelledClientEmail(data: BookingCancelledClientData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    profileUrl,
    cancellationReason
  } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px; line-height: 1.6;">
      Seu agendamento com <strong>${professionalName}</strong> infelizmente precisou ser cancelado.
    </p>
    
    ${cancellationReason ? `
      <div style="background-color: ${COLORS.parchment}; padding: 20px; border-left: 2px solid ${COLORS.stone}; margin-bottom: 30px;">
        <font style="display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; margin-bottom: 8px; font-family: ${FONTS.sans};">Motivo do cancelamento</font>
        <p style="font-size: 14px; color: ${COLORS.ink}; margin: 0; font-family: ${FONTS.sans}; line-height: 1.5;">${cancellationReason}</p>
      </div>
    ` : ''}

    ${buildEmailCard([
      { label: 'Serviço cancelado', value: serviceName },
      { label: 'O horário era', value: `${formattedDate} às ${time}` }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-top: 25px; margin-bottom: 10px; line-height: 1.6;">
      Sentimos muito pelo inconveniente. Você pode verificar um novo horário pelo link abaixo.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Aviso importante',
    heroVariant: 'parchment',
    heroLabel: 'Agendamento cancelado',
    heroTitle: 'Reserva',
    heroTitleItalic: 'cancelada',
    bodyHtml,
    ctaText: 'Ver Novos Horários',
    ctaUrl: profileUrl
  });
}
