import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

export function buildReviewReceivedEmail(data: {
  professionalName: string;
  clientName: string;
  rating: number;
  comment: string;
  dashboardUrl: string;
}) {
  const { professionalName, clientName, rating, comment, dashboardUrl } = data;
  
  const starsString = Array(rating).fill('★').join('') + Array(5 - rating).fill('☆').join('');
  
  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Bom dia, ${professionalName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">
      O seu trabalho e dedicação estão sendo reconhecidos. A cliente <strong>${clientName}</strong> acabou de deixar uma avaliação sobre o seu atendimento.
    </p>
    
    <div style="background-color: ${COLORS.parchment}; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid ${COLORS.mist};">
      <div style="color: ${COLORS.ink}; font-size: 24px; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">
        ${starsString}
      </div>
      ${comment ? `<p style="font-family: ${FONTS.serif}; font-style: italic; color: ${COLORS.stone}; text-align: center; margin: 0; line-height: 1.6;">"${comment}"</p>` : `<p style="font-family: ${FONTS.serif}; font-style: italic; color: ${COLORS.stone}; text-align: center; margin: 0;">Avaliação deixada sem comentário extra.</p>`}
    </div>
    
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">
      Acesse seu painel para aprovar e publicar ela no seu perfil.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Nova Avaliação',
    heroVariant: 'terracotta',
    heroLabel: 'Feedback',
    heroTitle: 'Parabéns!',
    heroTitleItalic: 'Nova Estrela 🌟',
    bodyHtml,
    ctaText: 'Acessar Meu Painel',
    ctaUrl: dashboardUrl
  } as any);
}
