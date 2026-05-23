import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingDeclinedClientData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  profileUrl?: string;
}

export function buildBookingDeclinedClientEmail(data: BookingDeclinedClientData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    profileUrl
  } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px; line-height: 1.6;">
      A disponibilidade de <strong>${professionalName}</strong> precisou ser atualizada e infelizmente não foi possível confirmar este horário.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Horário solicitado', value: `${formattedDate} às ${time}` }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-top: 25px; margin-bottom: 10px; line-height: 1.6;">
      Mas não se preocupe, a vitrine foi atualizada com novos horários para você escolher.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Atualização na agenda',
    heroVariant: 'parchment',
    heroLabel: 'Agendamento não confirmado',
    heroTitle: 'A agenda foi',
    heroTitleItalic: 'atualizada',
    bodyHtml,
    ctaText: 'Ver horários disponíveis',
    ctaUrl: profileUrl
  });
}
