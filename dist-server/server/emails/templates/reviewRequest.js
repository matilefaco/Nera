import { buildEmailBase } from '../../services/emailBuilder.js';
export function buildReviewRequestEmail(data) {
    const { clientName, serviceName, professionalName, reviewUrl } = data;
    const firstName = clientName.split(' ')[0];
    const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Você esteve com <strong>${professionalName}</strong> para <strong>${serviceName}</strong>.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Conta pra gente como foi — sua avaliação ajuda <strong>${professionalName}</strong> a receber mais clientes como você.
    </p>

    <!-- Interactive Stars -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              ${[1, 2, 3, 4, 5].map(rating => `
                <td style="padding: 0 8px;">
                  <a href="${reviewUrl}?rating=${rating}" target="_blank" style="font-size: 32px; color: #A85C3A; text-decoration: none; font-family: Arial, sans-serif;">
                    ☆
                  </a>
                </td>
              `).join('')}
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 8px;">
          <font style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060;">Toque para avaliar</font>
        </td>
      </tr>
    </table>

    <div style="margin: 40px 0; text-align: center;">
      <a href="${reviewUrl}" target="_blank" style="font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; color: #18120E; text-decoration: underline;">
        Escrever uma avaliação completa →
      </a>
    </div>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5DDD6;">
      <p style="font-family: Arial, sans-serif; font-size: 11px; color: #8A7060; font-style: italic; text-align: center;">
        Sua avaliação é publicada anonimamente, a não ser que você escolha o contrário.
      </p>
    </div>
  `;
    return buildEmailBase({
        topbarText: 'Avaliação',
        heroVariant: 'parchment',
        heroLabel: 'Seu atendimento foi concluído',
        heroTitle: 'Como foi,',
        heroTitleItalic: `${firstName}?`,
        bodyHtml
    });
}
