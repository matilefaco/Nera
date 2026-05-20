import { buildEmailBase, COLORS, FONTS } from '../../services/emailBuilder.js';

interface VerificationEmailData {
  verificationUrl: string;
}

export function buildVerificationEmail(data: VerificationEmailData): string {
  const { verificationUrl } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Sua conta está quase pronta.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Confirme seu e-mail para ativar sua agenda e sua vitrine profissional na Nera.
    </p>

    <div style="margin-top: 35px; text-align: center; border-top: 1px solid ${COLORS.mist}; padding-top: 24px;">
      <p style="font-family: ${FONTS.sans}; font-size: 12px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 12px;">
        Se o botão não funcionar, acesse manualmente:
      </p>
      <a href="${verificationUrl}" style="color: ${COLORS.ink}; font-family: ${FONTS.sans}; font-size: 12px; text-decoration: underline; font-weight: bold; word-break: break-all;">
        ${verificationUrl}
      </a>
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
    bodyHtml,
    ctaText: 'Confirmar Meu E-mail',
    ctaUrl: verificationUrl
  });
}
