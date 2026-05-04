import { buildEmailBase, buildEmailCard, COLORS } from '../../services/emailBuilder.js';
export function buildBookingConfirmedEmail(data) {
    const { clientName, serviceName, formattedDate, time, professionalName, location, calendarUrl, manageUrl, prepInstructions, whatsappUrl } = data;
    const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Tudo certo, ${clientName}! ${professionalName} confirmou seu horário.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Anote na sua agenda e se prepare para esse momento.
    </p>
    
    ${buildEmailCard([
        { label: 'Serviço', value: serviceName },
        { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
        { label: 'Profissional', value: professionalName || 'Sua profissional' },
        { label: 'Local', value: location }
    ])}

    ${prepInstructions ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F9F5F0" style="border: 1px dashed #E5DDD6; margin: 30px 0;">
        <tr>
          <td style="padding: 25px;">
            <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.terracotta}; margin-bottom: 10px; font-family: Arial, sans-serif;">COMO SE PREPARAR</font>
            <p style="font-size: 13px; color: #18120E; margin: 0; font-family: Arial, sans-serif; line-height: 1.5;">${prepInstructions}</p>
          </td>
        </tr>
      </table>
    ` : ''}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px;">
      <!-- Primary Button -->
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${calendarUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                  Adicionar ao Calendário
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${whatsappUrl ? `
        <!-- Spacer -->
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>

        <!-- Secondary Button -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                  <a href="${whatsappUrl}" target="_blank" style="color: ${COLORS.stone}; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; text-decoration: none; display: inline-block;">
                    Falar com ${professionalName}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : ''}
    </table>

    <div style="margin-top: 35px; text-align: center;">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: ${COLORS.stone};">
        Precisa reagendar? <a href="${manageUrl}" style="color: ${COLORS.stone}; text-decoration: underline;">Faça isso pelo painel da sua reserva.</a>
      </p>
    </div>
  `;
    return buildEmailBase({
        topbarText: 'Confirmação',
        heroVariant: 'terracotta',
        heroLabel: 'Reserva confirmada',
        heroTitle: 'Tudo pronto!',
        heroTitleItalic: 'para te receber ✨',
        badgeText: '✓ Agendamento Confirmado',
        badgeVariant: 'success',
        bodyHtml
    });
}
