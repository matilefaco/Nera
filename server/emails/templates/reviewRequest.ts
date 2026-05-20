import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ReviewRequestData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  professionalName: string;
  reviewUrl: string;
}

export function buildReviewRequestEmail(data: ReviewRequestData): string {
  const { 
    clientName, 
    serviceName, 
    professionalName, 
    reviewUrl 
  } = data;

  const firstName = clientName.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${firstName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Você realizou recentemente o serviço de <strong>${serviceName}</strong> com <strong>${professionalName}</strong>. Conta pra gente como foi — sua avaliação faz toda a diferença.
    </p>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid ${COLORS.mist};">
      <p style="font-family: ${FONTS.sans}; font-size: 11px; color: ${COLORS.stone}; font-style: italic; text-align: center;">
        Sua avaliação será enviada para a profissional e ajuda a melhorar os serviços oferecidos.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Avaliação de Atendimento',
    heroVariant: 'parchment',
    heroLabel: 'Atendimento concluído',
    heroTitle: 'Como foi a',
    heroTitleItalic: 'sua experiência?',
    bodyHtml,
    ctaText: 'Avaliar Atendimento',
    ctaUrl: reviewUrl
  });
}
