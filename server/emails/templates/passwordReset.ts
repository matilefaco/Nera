import { buildEmailBase } from '../../../src/services/emailBuilder';

interface PasswordResetData {
  resetUrl: string;
}

export function buildPasswordResetEmail(data: PasswordResetData): string {
  const { resetUrl } = data;

  const bodyHtml = `
    <p>Recebemos uma solicitação para redefinir a senha da sua conta no Nera.</p>
    <p>Se você não solicitou essa alteração, pode ignorar este email com segurança. Seus dados continuam protegidos.</p>
    <p>Para criar uma nova senha, clique no botão abaixo:</p>
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
    ctaUrl: resetUrl
  });
}
