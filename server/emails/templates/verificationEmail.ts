import { buildEmailBase, COLORS } from '../../services/emailBuilder.js';

interface VerificationEmailData {
  verificationUrl: string;
}

export function buildVerificationEmail(data: VerificationEmailData): string {
  const { verificationUrl } = data;

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Sua conta está quase pronta.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #5C4A3D; margin-bottom: 30px; line-height: 1.6;">
      Confirme seu e-mail para ativar sua agenda e sua vitrine profissional na Nera.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px; margin-bottom: 40px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${verificationUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                  Confirmar meu e-mail
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-top: 35px; text-align: center;">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #5C4A3D; line-height: 1.6;">
        Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:<br/>
        <a href="${verificationUrl}" style="color: #18120E; word-break: break-all;">${verificationUrl}</a>
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Verificação',
    heroVariant: 'linen',
    heroLabel: 'Quase lá',
    heroTitle: 'Confirme seu',
    heroTitleItalic: 'e-mail ✨',
    badgeText: '✓ Conta Criada',
    badgeVariant: 'success',
    bodyHtml
  });
}
