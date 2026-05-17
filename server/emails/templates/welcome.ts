import { buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';

interface WelcomeData {
  name: string; // Primeiro nome
  slug: string;
  onboardingUrl: string;
}

export function buildWelcomeEmail(data: WelcomeData): string {
  const { name, slug, onboardingUrl } = data;
  const firstName = name.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 24px; line-height: 1.6;">
      É um prazer receber você na Nera. Acreditamos que a excelência profissional começa com uma presença digital impecável e uma agenda que trabalha a seu favor.
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 32px; line-height: 1.7;">
      Sua vitrine profissional exclusiva já foi reservada. Agora, basta adicionar seus serviços e horários para começar a receber agendamentos com toda a sofisticação que o seu trabalho merece.
    </p>

    ${buildEmailCard([
      { label: "Seu link exclusivo", value: `usenera.com/p/${slug}`, valueUrl: `https://usenera.com/p/${slug}` },
      { label: "Sua conta", value: "Premium Access" }
    ])}

    <p style="font-family: Arial, sans-serif; font-size: 13px; color: #8A7060; margin-top: 40px; margin-bottom: 20px; line-height: 1.6; text-align: center; font-style: italic;">
      "A Nera foi criada para profissionais que entendem que cada detalhe comunica o valor do seu tempo."
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Seja bem-vinda',
    heroVariant: 'ink',
    heroLabel: 'Boas-vindas',
    heroTitle: `${firstName},`,
    heroTitleItalic: 'sua jornada começa aqui ✨',
    badgeText: '✓ Conta Ativada',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Criar Minha Vitrine',
    ctaUrl: onboardingUrl
  });
}
