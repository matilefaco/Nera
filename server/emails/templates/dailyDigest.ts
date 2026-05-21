import { buildEmailBase, COLORS, FONTS } from '../../services/emailBuilder.js';

export function buildDailyDigestEmail(data: {
  professionalName: string;
  confirmedCount: number;
  pendingCount: number;
  firstAppointmentTime?: string;
  totalAppointments: number;
  agendaUrl: string;
}) {
  const { professionalName, confirmedCount, pendingCount, firstAppointmentTime, totalAppointments, agendaUrl } = data;
  
  let highlights = '';
  if (totalAppointments > 0) {
    let details = [];
    if (confirmedCount > 0) details.push(`<strong>${confirmedCount}</strong> confirmados`);
    if (pendingCount > 0) details.push(`<strong>${pendingCount}</strong> pendentes`);
    
    highlights = `
      <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">Você tem um total de <strong>${totalAppointments} agendamentos</strong> para hoje (${details.join(' e ')}).</p>
      ${firstAppointmentTime ? `<p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">Seu primeiro horário começa às <strong>${firstAppointmentTime}</strong>.</p>` : ''}
    `;
  } else {
    highlights = `<p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">Você não tem agendamentos marcados para o dia de hoje. Aproveite para organizar sua semana ou abrir novos horários.</p>`;
  }

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Bom dia, ${professionalName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.ink}; line-height: 1.6; margin-bottom: 25px;">
      Aqui está o resumo da sua agenda para o dia de hoje:
    </p>
    
    ${highlights}
  `;

  return buildEmailBase({
    topbarText: 'Seu dia na Nera',
    heroVariant: 'canvas',
    heroLabel: 'Resumo Diário',
    heroTitle: 'Agenda',
    heroTitleItalic: 'de hoje',
    bodyHtml,
    ctaText: 'Ver Agenda Completa',
    ctaUrl: agendaUrl
  });
}
