import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

export function buildReviewMilestoneEmail(data: {
  professionalName: string;
  milestoneTitle: string;
  milestoneMessage: string;
  dashboardUrl: string;
}) {
  const { professionalName, milestoneTitle, milestoneMessage, dashboardUrl } = data;
  
  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Parabéns, ${professionalName}! ✨
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">
      Sua dedicação está dando resultados e suas clientes estão percebendo. É um orgulho ter você na Nera.
    </p>
    
    <div style="background-color: ${COLORS.parchment}; padding: 24px; border-radius: 16px; margin: 24px 0; border: 1px solid ${COLORS.mist}; text-align: center;">
      <h3 style="font-family: ${FONTS.serif}; font-size: 20px; color: ${COLORS.ink}; margin: 0 0 10px 0;">
        ${milestoneTitle}
      </h3>
      <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin: 0;">
        ${milestoneMessage}
      </p>
    </div>
    
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">
      Continue oferecendo sempre a melhor experiência possível. Suas clientes agradecem!
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Conquista Desbloqueada',
    heroVariant: 'canvas',
    heroLabel: 'Marcos e Conquistas',
    heroTitle: 'Seu perfil',
    heroTitleItalic: 'está crescendo',
    bodyHtml,
    ctaText: 'Ver Perfil Público',
    ctaUrl: dashboardUrl
  });
}
