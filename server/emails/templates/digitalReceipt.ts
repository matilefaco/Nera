import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface DigitalReceiptData {
  clientName?: string;
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price: string;
  bookingUrl: string;
  reviewUrl?: string;
}

export function buildDigitalReceiptEmail(data: DigitalReceiptData): string {
  const { 
    clientName, 
    professionalName, 
    serviceName, 
    formattedDate, 
    time, 
    price, 
    bookingUrl,
    reviewUrl
  } = data;

  const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px; font-weight: 500;">
      Olá, ${firstName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Seu atendimento com ${professionalName} foi finalizado. ${reviewUrl ? 'Se puder, conte como foi sua experiência — sua avaliação ajuda outras clientes a escolherem com mais confiança.' : 'Abaixo você encontra o registro do serviço. Esperamos ver você novamente em breve.'}
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Profissional', value: professionalName },
      { label: 'Valor', value: price }
    ])}
  `;

  return buildEmailBase({
    topbarText: 'Recibo',
    heroVariant: 'parchment',
    heroLabel: 'Recibo Digital',
    heroTitle: 'Atendimento',
    heroTitleItalic: 'finalizado ✨',
    badgeText: '✓ Finalizado',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: reviewUrl ? 'Avaliar atendimento' : 'Agendar Novamente',
    ctaUrl: reviewUrl || bookingUrl
  });
}

