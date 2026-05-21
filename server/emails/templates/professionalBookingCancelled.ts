import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ProfessionalBookingCancelledData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  reason?: string;
  agendaUrl?: string;
}

export function buildProfessionalBookingCancelledEmail(data: ProfessionalBookingCancelledData): string {
  const { professionalName, clientName, serviceName, formattedDate, time, reason, agendaUrl } = data;

  const cardItems = [
    { label: 'Cliente', value: clientName },
    { label: 'Serviço', value: serviceName },
    { label: 'Horário Liberado', value: `${formattedDate} às ${time}` }
  ];

  if (reason) {
    cardItems.push({ label: 'Motivo', value: reason });
  }

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}.
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      <strong>${clientName}</strong> cancelou um agendamento e o horário foi liberado em sua agenda.
    </p>

    ${buildEmailCard(cardItems)}
  `;

  return buildEmailBase({
    topbarText: 'Cancelamento',
    heroVariant: 'clay',
    heroLabel: 'Aviso',
    heroTitle: 'Horário',
    heroTitleItalic: 'Liberado 🕒',
    badgeText: 'Cancelado',
    badgeVariant: 'warning',
    bodyHtml,
    ctaText: 'Acessar Agenda',
    ctaUrl: agendaUrl || '#',
  });
}
