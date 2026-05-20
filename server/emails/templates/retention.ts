import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface RetentionEmailData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  bookingUrl: string;
  lastServiceDate: string;  
  daysSince: number;        
}

export function buildRetentionEmail(data: RetentionEmailData): string {
  const { clientName, professionalName, serviceName, bookingUrl, lastServiceDate, daysSince } = data;
  const firstName = clientName.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${firstName}.
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Você esteve com <strong>${professionalName}</strong> para <strong>${serviceName}</strong> no dia ${lastServiceDate}.
      <br><br>
      Sua rotina de cuidados não pode parar. Garanta seu próximo horário agora mesmo com facilidade e rapidez.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Seu momento',
    heroVariant: 'terracotta',
    heroLabel: `Saudades de você`,
    heroTitle: 'Hora de se',
    heroTitleItalic: 'cuidar novamente ✨',
    badgeText: `Faz ${daysSince} dias desde a sua última visita`,
    badgeVariant: 'info',
    bodyHtml,
    ctaText: 'Reservar Novo Horário',
    ctaUrl: bookingUrl
  });
}
