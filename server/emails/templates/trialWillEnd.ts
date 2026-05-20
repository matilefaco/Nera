import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface TrialWillEndData {
  name: string;
  formattedDate: string;
  dashboardUrl: string;
}

export function buildTrialWillEndEmail(data: TrialWillEndData): string {
  const { name, formattedDate, dashboardUrl } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${name}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.ink}; line-height: 1.6; margin-bottom: 25px;">
      Passando para avisar que seu período de teste da Nera está chegando ao fim. Esperamos que tenha sido uma ótima experiência até aqui.
    </p>
    
    ${buildEmailCard([
      { label: 'O período encerra em', value: formattedDate },
      { label: 'O que acontece agora', value: 'Sua assinatura será renovada automaticamente no plano escolhido.' }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; line-height: 1.6;">
      Se desejar fazer qualquer alteração no seu plano, acesse o painel.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Plano e Assinatura',
    heroVariant: 'ink',
    heroLabel: 'Período gratuito',
    heroTitle: 'Fim do teste',
    heroTitleItalic: 'em breve ✨',
    bodyHtml,
    ctaText: 'Acessar meu painel',
    ctaUrl: dashboardUrl
  });
}
