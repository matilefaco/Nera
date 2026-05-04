import { buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';
export function buildWelcomeEmail(data) {
    const { name, slug, onboardingUrl } = data;
    const firstName = name.split(' ')[0];
    const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 15px; color: #18120E; margin-bottom: 24px;">
      Em menos de 5 minutos, você vai receber seus primeiros agendamentos.
    </p>

    ${buildEmailCard([
        { label: "Seu plano atual", value: "Gratuito — até 15 agendamentos por mês" },
        { label: "Seu link exclusivo", value: `usenera.com/p/${slug}`, valueUrl: `https://usenera.com/p/${slug}` }
    ])}

    <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #18120E; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px;">
      3 passos para começar
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="padding-bottom: 12px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="24" valign="top" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #A85C3A;">1.</td>
              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060;">
                <a href="https://usenera.com/servicos" style="color: #18120E; text-decoration: underline;">Adicione seus serviços e preços</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom: 12px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="24" valign="top" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #A85C3A;">2.</td>
              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060;">
                <a href="https://usenera.com/perfil" style="color: #18120E; text-decoration: underline;">Configure seus horários</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="24" valign="top" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #A85C3A;">3.</td>
              <td style="font-family: Arial, sans-serif; font-size: 14px; color: #18120E;">
                Compartilhe seu link com suas clientes
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
    return buildEmailBase({
        topbarText: 'Bem-vinda',
        heroVariant: 'ink',
        heroLabel: 'Sua agenda começa agora',
        heroTitle: `${firstName},`,
        heroTitleItalic: 'sua vitrine está pronta.',
        badgeText: '✓ Conta criada com sucesso',
        badgeVariant: 'success',
        bodyHtml,
        ctaText: 'Completar Meu Perfil',
        ctaUrl: onboardingUrl
    });
}
