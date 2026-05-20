import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingRescheduledData {
  clientName: string;
  serviceName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  professionalName: string;
  manageUrl: string;
  rescheduledBy: 'professional' | 'client' | 'system';
  cancelUrl?: string;
}

export function buildBookingRescheduledEmail(data: BookingRescheduledData): string {
  const { 
    clientName, 
    serviceName, 
    oldDate, 
    oldTime, 
    newDate, 
    newTime, 
    professionalName, 
    manageUrl,
    rescheduledBy,
    cancelUrl
  } = data;

  const headerMessage = rescheduledBy === 'professional' 
    ? `<p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;"><strong>${professionalName}</strong> precisou ajustar o horário.</p>
       <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px;">Confira o novo horário do seu agendamento abaixo.</p>`
    : `<p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;">Você reagendou seu horário com sucesso.</p>
       <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px;">Confira a sua nova reserva abaixo.</p>`;

  const bodyHtml = `
    ${headerMessage}
    
    <div style="margin: 25px 0; border-left: 2px solid ${COLORS.mist}; padding-left: 15px;">
      <font style="display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; margin-bottom: 5px; font-family: ${FONTS.sans};">Horário anterior</font>
      <p style="margin: 0; color: ${COLORS.stone}; font-size: 14px; text-decoration: line-through; font-family: ${FONTS.sans};">${oldDate} às ${oldTime}</p>
    </div>

    <div style="margin: 25px 0; padding: 20px; background-color: ${COLORS.parchment}; border-left: 2px solid ${COLORS.terracotta};">
        <font style="display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.terracotta}; margin-bottom: 10px; font-family: ${FONTS.sans};">Novo horário</font>
        <p style="margin: 0; color: ${COLORS.ink}; font-size: 16px; font-weight: bold; font-family: ${FONTS.sans};">${newDate} às ${newTime}</p>
        <p style="margin: 5px 0 0 0; color: ${COLORS.stone}; font-size: 13px; font-family: ${FONTS.sans};">${serviceName}</p>
    </div>

    ${rescheduledBy === 'professional' ? `
      <p style="font-family: ${FONTS.sans}; font-size: 13px; color: ${COLORS.stone}; text-align: center; margin-top: 30px; margin-bottom: 20px;">
        Se o novo horário não for ideal, acesse o painel para sugerir outro horário ou cancelar.
      </p>
    ` : ''}
  `;

  return buildEmailBase({
    topbarText: 'Reagendamento',
    heroVariant: 'parchment',
    heroLabel: 'Houve uma alteração',
    heroTitle: 'O seu horário foi',
    heroTitleItalic: 'reagendado ✨',
    bodyHtml,
    ctaText: 'Ver Detalhes do Horário',
    ctaUrl: manageUrl
  });
}
