import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingCancelledClientData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  profileUrl?: string;
  cancellationReason?: string;
}

export function buildBookingCancelledClientEmail(data: BookingCancelledClientData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    profileUrl,
    cancellationReason
  } = data;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 5px;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 25px;">
      Seu agendamento com <strong>${professionalName}</strong> foi cancelado.
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
    
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-top: 25px; margin-bottom: 35px; line-height: 1.6;">
      Sentimos muito pelo inconveniente. Se desejar, você pode conferir a disponibilidade da profissional e realizar um novo agendamento a qualquer momento.
    </p>

    ${profileUrl ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                  <a href="${profileUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.white}; text-decoration: none; display: inline-block;">
                    Ver novos horários
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    ` : ''}
  `;

  return buildEmailBase({
    topbarText: 'Aviso importante',
    heroVariant: 'parchment',
    heroLabel: 'Agendamento cancelado',
    heroTitle: 'Reserva cancelada',
    heroTitleItalic: 'sentimos pelo inconveniente.',
    bodyHtml,
  });
}
