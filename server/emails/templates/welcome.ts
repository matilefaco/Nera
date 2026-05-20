import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface WelcomeData {
  name: string; // Primeiro nome
  slug: string;
  onboardingUrl: string;
}

export function buildWelcomeEmail(data: WelcomeData): string {
  const { name, slug, onboardingUrl } = data;
  const firstName = name.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${firstName}.
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Sua vitrine profissional exclusiva já foi reservada. Agora, basta configurar os seus horários e serviços para começar a divulgar sua agenda online.
    </p>

    ${buildEmailCard([
      { label: "Seu link", value: `usenera.com/p/${slug}`, valueUrl: `https://usenera.com/p/${slug}` },
      { label: "Plano", value: "Premium" }
    ])}
  `;

  return buildEmailBase({
    topbarText: 'Bem-vinda à Nera',
    heroVariant: 'ink',
    heroLabel: 'Sua conta foi ativada',
    heroTitle: `${firstName},`,
    heroTitleItalic: 'bem-vinda ✨',
    badgeText: '✓ Conta Pronta',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Acessar o meu painel',
    ctaUrl: onboardingUrl
  });
}
