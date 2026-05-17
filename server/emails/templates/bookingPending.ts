
import { COLORS, FONTS, buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';

interface BookingPendingData {
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price: string;
  reservationCode: string;
  manageUrl: string;
  whatsappUrl: string;
  clientName: string;
  paymentMethods?: string[];
}

export function buildBookingPendingEmail(data: BookingPendingData): string {
  const {
    professionalName,
    serviceName,
    formattedDate,
    time,
    price,
    reservationCode,
    manageUrl,
    whatsappUrl,
    clientName
  } = data;

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 25px; font-weight: 500;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 35px; line-height: 1.7;">
      Seu pedido de agendamento com <strong>${professionalName}</strong> foi recebido. 
      Você receberá uma confirmação assim que o horário for garantido pela profissional.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Valor previsto', value: price },
      { label: 'Reserva', value: reservationCode || '-' }
    ])}

    <div style="margin: 45px 0; text-align: center;">
      &nbsp;
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <!-- Primary Action -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                  <a href="${manageUrl}" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; text-decoration: none; display: inline-block;">
                    Acompanhar Reserva
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

        <!-- Secondary Action -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                   <a href="${whatsappUrl}" style="color: ${COLORS.stone}; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    Dúvidas ou Contato
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid ${COLORS.mist};">
      <p style="font-family: Arial, sans-serif; font-size: 11px; color: ${COLORS.stone}; text-align: center; line-height: 1.6; letter-spacing: 0.05em;">
        Deseja realizar alguma alteração? Você pode gerenciar seu horário através do link de acompanhamento acima.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Reserva',
    heroVariant: 'parchment',
    heroLabel: 'Solicitação Enviada',
    heroTitle: 'Solicitação',
    heroTitleItalic: 'recebida ✨',
    bodyHtml,
  });
}

