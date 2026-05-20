import { buildEmailBase, COLORS, FONTS } from '../../services/emailBuilder.js';

interface PasswordResetData {
  resetUrl: string;
  expiresInMinutes?: number;
  requestedAt?: string;
}

export function buildPasswordResetEmail(data: PasswordResetData): string {
  const { resetUrl, expiresInMinutes = 60, requestedAt } = data;

  const requestedAtBox = requestedAt ? `
    <div style="background-color: ${COLORS.parchment}; padding: 20px; border-left: 2px solid ${COLORS.stone}; margin-bottom: 30px; font-family: ${FONTS.sans};">
      <p style="margin: 0; font-size: 13px; color: ${COLORS.ink};">Pedido recebido em: <strong>${requestedAt}</strong></p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: ${COLORS.stone};">Se não foi você, basta ignorar este e-mail &mdash; sua conta segue segura.</p>
    </div>
  ` : '';

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin: 0 0 25px 0;">
      Recebemos um pedido para alterar a senha da sua conta Nera.
    </p>
    ${requestedAtBox}
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin: 20px 0 0 0; line-height: 1.6;">
      Para definir uma nova senha, clique no botão abaixo. Este link expira em <strong>${expiresInMinutes} minutos</strong>.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Segurança',
    heroVariant: 'ink',
    heroLabel: 'Recuperação',
    heroTitle: 'Redefinição',
    heroTitleItalic: 'de senha',
    badgeText: 'Ação Necessária',
    badgeVariant: 'alert',
    bodyHtml,
    ctaText: 'Definir Nova Senha',
    ctaUrl: resetUrl,
    ctaSubtext: 'Por segurança, não compartilhe este link. A Nera nunca pede sua senha por e-mail ou mensagem.'
  });
}
