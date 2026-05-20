import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ProfessionalNewBookingData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price?: string;
  location: string;
  agendaUrl?: string;
  paymentMethods?: string[];
  clientWhatsapp: string;
  whatsappUrl?: string;
}

export function buildProfessionalNewBookingEmail(data: ProfessionalNewBookingData): string {
  const { professionalName, clientName, serviceName, formattedDate, time, price, location, agendaUrl, paymentMethods, clientWhatsapp, whatsappUrl } = data;

  const cardItems = [
    { label: 'Cliente', value: clientName },
    { label: 'WhatsApp da cliente', value: clientWhatsapp, valueUrl: whatsappUrl },
    { label: 'Serviço', value: serviceName },
    { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
    { label: 'Local', value: location },
    { label: 'Valor', value: price || 'Sob consulta' }
  ];

  if (paymentMethods && paymentMethods.length > 0) {
    cardItems.push({ label: 'Forma de Pagamento', value: paymentMethods.join(', ') });
  } else {
    cardItems.push({ label: 'Pagamento', value: 'Combinado diretamente com você' });
  }

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}.
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      <strong>${clientName}</strong> deseja reservar um horário com você. O agendamento só será definitivo após a sua confirmação.
    </p>

    ${buildEmailCard(cardItems)}

    <div style="margin-top: 30px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <a href="${agendaUrl || '#'}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 13px; color: ${COLORS.stone}; text-decoration: underline;">
              Se necessário, você pode recusar ou sugerir outro horário pelo painel.
            </a>
          </td>
        </tr>
      </table>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Nova Solicitação',
    heroVariant: 'terracotta',
    heroLabel: 'Nova Reserva',
    heroTitle: 'Chegou!',
    heroTitleItalic: 'Uma nova cliente quer te ver ✨',
    badgeText: 'Ação necessária',
    badgeVariant: 'info',
    bodyHtml,
    ctaText: 'Acessar Agenda',
    ctaUrl: agendaUrl || '#',
  });
}
