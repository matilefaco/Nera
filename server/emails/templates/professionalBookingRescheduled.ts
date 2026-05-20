import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ProfessionalBookingRescheduledData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  oldFormatDate: string;
  oldTime: string;
  newFormatDate: string;
  newTime: string;
  agendaUrl?: string;
}

export function buildProfessionalBookingRescheduledEmail(data: ProfessionalBookingRescheduledData): string {
  const { professionalName, clientName, serviceName, oldFormatDate, oldTime, newFormatDate, newTime, agendaUrl } = data;

  const cardItems = [
    { label: 'Cliente', value: clientName },
    { label: 'Serviço', value: serviceName },
    { label: 'Horário Cancelado', value: `${oldFormatDate} às ${oldTime}` },
    { label: 'Novo Horário', value: `${newFormatDate} às ${newTime}` }
  ];

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}.
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Uma cliente solicitou remarcação. Acesse seu painel para confirmar ou acompanhar a alteração.
    </p>

    ${buildEmailCard(cardItems)}
  `;

  return buildEmailBase({
    topbarText: 'Reagendamento',
    heroVariant: 'sand',
    heroLabel: 'Aviso',
    heroTitle: 'Horário',
    heroTitleItalic: 'Alterado 📅',
    badgeText: 'Remarcação',
    badgeVariant: 'warning',
    bodyHtml,
    ctaText: 'Acessar Agenda',
    ctaUrl: agendaUrl || '#',
  });
}
