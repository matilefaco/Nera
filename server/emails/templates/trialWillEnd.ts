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
      Passando para avisar que seu período de teste gratuito de 15 dias do Nera Pro está chegando ao fim. Esperamos que tenha sido uma experiência produtiva até aqui.
    </p>
    
    ${buildEmailCard([
      { label: 'O trial encerra em', value: formattedDate },
      { label: 'O que acontece agora?', value: 'Sua assinatura será renovada automaticamente no plano Pro.' }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; line-height: 1.6;">
      Se desejar fazer qualquer alteração no seu plano ou verificar o método de pagamento, você pode acessar seu painel a qualquer momento.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Aviso de Assinatura',
    heroVariant: 'ink',
    heroLabel: 'Período de teste',
    heroTitle: 'Fim do trial',
    heroTitleItalic: 'proximamente.',
    bodyHtml,
    ctaText: 'Ir para o Dashboard',
    ctaUrl: dashboardUrl
  });
}
