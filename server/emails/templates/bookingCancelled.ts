import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../../src/services/emailBuilder';

interface BookingCancelledData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  waitlistUrl: string;
  cancellationReason?: string;
  waitlistCount?: number;
  profileUrl?: string;
}

export function buildBookingCancelledEmail(data: BookingCancelledData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    waitlistUrl,
    cancellationReason,
    waitlistCount,
    profileUrl
  } = data;

  const hasWaitlist = typeof waitlistCount === 'number' && waitlistCount > 0;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;">
      Oi, ${professionalName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 25px;">
      ${clientName} cancelou o horário de ${formattedDate} às ${time}.
    </p>
    
    ${cancellationReason ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 1px dashed ${COLORS.mist}; padding: 15px;">
        <tr>
          <td>
            <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; margin-bottom: 8px; font-family: ${FONTS.sans};">MOTIVO DO CANCELAMENTO</font>
            <p style="font-size: 13px; color: ${COLORS.ink}; margin: 0; font-family: ${FONTS.sans}; line-height: 1.5;">${cancellationReason}</p>
          </td>
        </tr>
      </table>
    ` : ''}

    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'O horário era', value: `${formattedDate} às ${time}` }
    ])}
    
    <!-- Opportunity Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px; margin-bottom: 35px;">
      <tr>
        <td bgcolor="#F0FBF5" style="border: 1px solid #C6F6D5; padding: 20px; text-align: center; border-radius: 4px;">
          <p style="font-family: ${FONTS.sans}; font-size: 13px; color: #22543D; margin: 0; line-height: 1.5;">
            ${hasWaitlist 
              ? `✓ Você tem <strong>${waitlistCount} pessoa(s)</strong> na lista de espera para esse período. Notifique agora e recupere esse horário.`
              : `O horário está disponível para novas reservas na sua vitrine.`
            }
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${waitlistUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.white}; text-decoration: none; display: inline-block;">
                  Ver Lista de Espera
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      
      ${(!hasWaitlist && profileUrl) ? `
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                  <a href="${profileUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; text-decoration: none; display: inline-block;">
                    Compartilhar Minha Agenda
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
    topbarText: 'Atualização da agenda',
    heroVariant: 'parchment',
    heroLabel: 'Atualização da agenda',
    heroTitle: 'Reserva cancelada',
    heroTitleItalic: 'mas o horário já está livre.',
    bodyHtml,
  });
}
