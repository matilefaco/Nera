import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface ConfirmationRequest24hData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  confirmUrl: string;
  rescheduleUrl: string;
  cancelUrl: string;
}

export function buildConfirmationRequest24hEmail(data: ConfirmationRequest24hData): string {
  const { clientName, professionalName, serviceName, formattedDate, time, confirmUrl, rescheduleUrl, cancelUrl } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px; font-weight: 500;">
      Olá, ${clientName}. Seu atendimento está chegando.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Confirme sua presença pelo botão abaixo.
    </p>

    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Profissional', value: professionalName },
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time }
    ])}

    <div style="margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid ${COLORS.mist};">
      <p style="font-family: ${FONTS.sans}; font-size: 13px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 12px;">
        Você também pode usar o mesmo link para remarcar ou cancelar, se precisar.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'parchment',
    heroLabel: 'Seu horário é amanhã',
    heroTitle: 'Te esperamos',
    heroTitleItalic: 'em breve ✨',
    badgeText: 'Amanhã',
    badgeVariant: 'info',
    bodyHtml,
    ctaText: 'Confirmar Presença',
    ctaUrl: confirmUrl,
  });
}
