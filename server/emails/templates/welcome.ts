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
      Sua vitrine profissional exclusiva já foi reservada. Agora, basta configurar seus serviços e horários para começar a receber seus primeiros agendamentos.
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 32px; line-height: 1.7;">
      Construímos a Nera para ser a ferramenta que valoriza seu talento e simplifica sua gestão.
    </p>

    ${buildEmailCard([
      { label: "Seu link exclusivo", value: `usenera.com/p/${slug}`, valueUrl: `https://usenera.com/p/${slug}` },
      { label: "Acesso", value: "Ativo" }
    ])}

    <div style="margin-top: 40px;">
      &nbsp;
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Boas-vindas',
    heroVariant: 'ink',
    heroLabel: 'Conta Ativada',
    heroTitle: `${firstName},`,
    heroTitleItalic: 'sua agenda está pronta ✨',
    badgeText: '✓ Ativa',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Acessar Painel',
    ctaUrl: onboardingUrl
  });
}
