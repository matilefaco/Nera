import { buildEmailBase, COLORS, FONTS } from '../../../src/services/emailBuilder.js';

interface PasswordResetData {
  resetUrl: string;
  expiresInMinutes?: number;
  requestedAt?: string;
}

export function buildPasswordResetEmail(data: PasswordResetData): string {
  const { resetUrl, expiresInMinutes = 60, requestedAt } = data;

  const requestedAtBox = requestedAt ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="${COLORS.linen}" style="border: 1px solid ${COLORS.mist}; margin: 25px 0;">
      <tr>
        <td style="padding: 20px; font-family: ${FONTS.sans};">
          <p style="margin: 0; font-size: 13px; color: ${COLORS.stone};">Pedido feito em: <strong>${requestedAt}</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: ${COLORS.stone};">Se não foi você, ignore este e-mail &mdash; sua conta continua segura.</p>
        </td>
      </tr>
    </table>
  ` : '';

  const bodyHtml = `
    <p style="margin: 0 0 20px 0;">Recebemos um pedido para redefinir a senha da sua conta Nera.</p>
    ${requestedAtBox}
    <p style="margin: 20px 0 0 0;">
      Para criar uma nova senha, clique no botão abaixo.<br>
      O link é válido por <strong>${expiresInMinutes} minutos</strong>.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Segurança',
    heroVariant: 'ink',
    heroLabel: 'Recuperação de conta',
    heroTitle: 'Redefinição',
    heroTitleItalic: 'de senha',
    badgeText: 'Ação Necessária',
    badgeVariant: 'alert',
    bodyHtml,
    ctaText: 'Redefinir Senha',
    ctaUrl: resetUrl,
    ctaSubtext: 'Por segurança, não compartilhe este link com ninguém.<br>O Nera nunca pede sua senha por e-mail ou WhatsApp.'
  });
}
