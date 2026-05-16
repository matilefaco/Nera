import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ReferralRewardData {
  referrerName: string;
  refereeName: string;
  amount: number;
}

export function buildReferralRewardEmail(data: ReferralRewardData): string {
  const { referrerName, refereeName, amount } = data;
  const formattedAmount = `R$ ${amount.toFixed(2).replace('.', ',')}`;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${referrerName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.ink}; line-height: 1.6; margin-bottom: 25px;">
      Boas notícias: sua indicação <strong>${refereeName}</strong> acaba de se tornar assinante do Nera Pro!
    </p>
    
    ${buildEmailCard([
      { label: 'Recompensa Recebida', value: `${formattedAmount} em créditos` },
      { label: 'Indicação', value: refereeName }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; line-height: 1.6;">
      O valor já foi adicionado à sua conta e será descontado automaticamente na sua próxima mensalidade. Obrigado por ajudar a crescer nossa comunidade de profissionais excelentes.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Recompensa de indicação',
    heroVariant: 'terracotta',
    heroLabel: 'Comunidade Nera',
    heroTitle: 'Indicação convertida',
    heroTitleItalic: 'créditos adicionados.',
    badgeText: 'Crédito disponível',
    badgeVariant: 'success',
    bodyHtml,
  });
}
