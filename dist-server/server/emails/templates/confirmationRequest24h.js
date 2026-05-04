import { buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';
export function buildConfirmationRequest24hEmail(data) {
    const { clientName, professionalName, serviceName, formattedDate, time, confirmUrl, rescheduleUrl, cancelUrl } = data;
    const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Oi, ${clientName}! Seu horário com <strong>${professionalName}</strong> é amanhã.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Confirme sua presença para garantirmos tudo certinho para você.
    </p>

    ${buildEmailCard([
        { label: 'Serviço', value: serviceName },
        { label: 'Data', value: formattedDate },
        { label: 'Horário', value: time }
    ])}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
      <!-- Primary Button -->
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
            <tr>
              <td align="center" bgcolor="#18120E" style="border-radius: 9999px;">
                <a href="${confirmUrl}" target="_blank" style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #ffffff; text-decoration: none; padding: 20px 50px; display: inline-block; text-transform: uppercase; letter-spacing: 0.15em;">
                  ✓ CONFIRMAR MINHA PRESENÇA
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      
      <!-- Spacer -->
      <tr>
        <td height="16" style="font-size: 16px; line-height: 16px;">&nbsp;</td>
      </tr>

      <!-- Secondary Buttons (Two Columns) -->
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="50%" align="center" style="padding-right: 6px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate;">
                  <tr>
                    <td align="center" style="border: 1px solid #18120E; border-radius: 9999px;">
                      <a href="${rescheduleUrl}" target="_blank" style="font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; color: #18120E; text-decoration: none; padding: 14px 20px; display: inline-block; text-transform: uppercase; letter-spacing: 0.1em;">
                        Reagendar
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
              <td width="50%" align="center" style="padding-left: 6px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate;">
                  <tr>
                    <td align="center" style="border: 1px solid #E5DDD6; border-radius: 9999px;">
                      <a href="${cancelUrl}" target="_blank" style="font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; color: #8A7060; text-decoration: none; padding: 14px 20px; display: inline-block; text-transform: uppercase; letter-spacing: 0.1em;">
                        Cancelar
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; text-align: center; margin-top: 30px; font-style: italic; line-height: 1.5;">
      Se não puder comparecer, prefira reagendar a cancelar — isso ajuda <strong>${professionalName}</strong> a planejar melhor o dia.
    </p>
  `;
    return buildEmailBase({
        topbarText: 'Confirmação Necessária',
        heroVariant: 'parchment',
        heroLabel: 'Lembrete',
        heroTitle: 'Seu horário',
        heroTitleItalic: 'é amanhã',
        badgeText: 'Aguardando sua confirmação',
        badgeVariant: 'pending',
        bodyHtml,
        ctaText: 'Ver Detalhes no App',
        ctaUrl: confirmUrl,
    });
}
