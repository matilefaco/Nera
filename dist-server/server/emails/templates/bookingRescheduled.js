import { buildEmailBase, COLORS, FONTS } from '../../services/emailBuilder.js';
export function buildBookingRescheduledEmail(data) {
    const { clientName, serviceName, oldDate, oldTime, newDate, newTime, professionalName, manageUrl, rescheduledBy, cancelUrl } = data;
    const headerMessage = rescheduledBy === 'professional'
        ? `<p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;"><strong>${professionalName}</strong> precisou ajustar seu horário.</p>
       <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 25px;">Veja o novo horário abaixo.</p>`
        : `<p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;">Você reagendou seu horário com sucesso.</p>
       <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 25px;">Confirme os dados abaixo.</p>`;
    const bodyHtml = `
    ${headerMessage}
    
    <div style="margin: 25px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F5F5F5" style="border: 1px solid ${COLORS.mist};">
        <tr>
          <td style="padding: 15px;">
            <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; margin-bottom: 5px; font-family: ${FONTS.sans};">Horário Anterior</font>
            <p style="margin: 0; color: ${COLORS.stone}; font-size: 14px; text-decoration: line-through; font-family: ${FONTS.sans};">${oldDate} às ${oldTime}</p>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin: 10px 0 35px 0;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F9F5F0" style="border: 1px solid ${COLORS.terracotta};">
        <tr>
          <td style="padding: 20px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.terracotta}; margin-bottom: 10px; font-family: ${FONTS.sans};">Novo Horário</font>
                </td>
                <td align="right">
                  <span style="background-color: ${COLORS.terracotta}; color: ${COLORS.white}; font-size: 9px; font-weight: bold; padding: 2px 8px; border-radius: 2px; font-family: ${FONTS.sans};">NOVO</span>
                </td>
              </tr>
            </table>
            <p style="margin: 0; color: ${COLORS.ink}; font-size: 16px; font-weight: bold; font-family: ${FONTS.sans};">${newDate} às ${newTime}</p>
            <p style="margin: 5px 0 0 0; color: ${COLORS.stone}; font-size: 13px; font-family: ${FONTS.sans};">${serviceName}</p>
          </td>
        </tr>
      </table>
    </div>

    ${rescheduledBy === 'professional' ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 1px dashed ${COLORS.mist}; padding: 15px;">
        <tr>
          <td style="font-family: ${FONTS.sans}; font-size: 12px; color: ${COLORS.stone}; text-align: center; line-height: 1.5;">
            Se o novo horário não servir, você pode reagendar ou cancelar pelo link abaixo.
          </td>
        </tr>
      </table>
    ` : ''}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${manageUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.white}; text-decoration: none; display: inline-block;">
                  Ver Minha Reserva
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      
      ${(rescheduledBy === 'professional' && cancelUrl) ? `
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                  <a href="${cancelUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; text-decoration: none; display: inline-block;">
                    Preciso de outro horário
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : ''}
    </table>
  `;
    return buildEmailBase({
        topbarText: 'Reagendamento',
        heroVariant: 'parchment',
        heroLabel: 'Houve uma mudança',
        heroTitle: 'Seu horário foi',
        heroTitleItalic: 'reagendado ✨',
        bodyHtml
    });
}
