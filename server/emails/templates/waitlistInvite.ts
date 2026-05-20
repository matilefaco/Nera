import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface WaitlistInviteData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  servicePrice?: string;
  formattedDate: string;
  time: string;
  bookingUrl: string;
  expiresInHours: number; // horas até o convite expirar
  isExclusive?: boolean;  // true = só ela foi convidada
}

export function buildWaitlistInviteEmail(data: WaitlistInviteData): string {
  const { 
    clientName, 
    professionalName, 
    serviceName, 
    servicePrice, 
    formattedDate, 
    time, 
    bookingUrl, 
    expiresInHours, 
    isExclusive 
  } = data;

  const badgeText = isExclusive ? "Convite exclusivo" : `Expira em ${expiresInHours} horas`;
  const badgeVariant = isExclusive ? 'success' : 'alert';

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px; line-height: 1.6;">
      ${isExclusive 
        ? "Uma vaga surgiu na agenda e este convite é especial para você. Garanta seu horário antes que seja liberado."
        : "Avisamos as clientes na lista de espera. A vaga será de quem confirmar primeiro, não perca tempo!"
      }
    </p>

    ${buildEmailCard([
      { label: 'Profissional', value: professionalName },
      { label: 'Serviço', value: serviceName },
      ...(servicePrice ? [{ label: 'Valor', value: servicePrice }] : []),
      { label: 'Data', value: formattedDate },
      { label: 'Horário disponível', value: time }
    ])}
  `;

  return buildEmailBase({
    topbarText: 'Oportunidade',
    heroVariant: 'terracotta',
    heroLabel: 'Vaga disponível',
    heroTitle: 'Abriu um',
    heroTitleItalic: 'horário para você ✨',
    badgeText,
    badgeVariant,
    bodyHtml,
    ctaText: 'Garantir meu horário',
    ctaUrl: bookingUrl
  });
}
