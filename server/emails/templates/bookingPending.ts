
import { COLORS, FONTS, buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder.js';

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
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 25px;">
      Oi, ${clientName}! Sua solicitação chegou.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      <strong>${professionalName}</strong> normalmente responde em até 2 horas.
      Você receberá um e-mail assim que o horário for confirmado.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
      { label: 'Valor', value: price },
      { label: 'Código da reserva', value: reservationCode || '-' }
    ])}

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; font-style: italic; margin-top: -10px; margin-bottom: 30px;">
      Guarde esse código — você pode precisar dele para reagendar.
    </p>
    
    <div style="margin: 35px 0; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; border-collapse: separate;">
        <tr>
          <td align="center" bgcolor="#FFF8F1" style="border: 1px solid #FFECCF; padding: 12px 25px;">
            <font style="color: #8A4B00; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; font-family: ${FONTS.sans};">
              ⏳ Aguardando confirmação
            </font>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 40px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <!-- Primary Action -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                  <a href="${manageUrl}" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    Ver Status da Reserva
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        
        <!-- Spacer -->
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>

        <!-- Secondary Action -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                   <a href="${whatsappUrl}" style="color: ${COLORS.stone}; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; text-decoration: none; display: inline-block;">
                    Falar no WhatsApp
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 45px; padding-top: 30px; border-top: 1px solid ${COLORS.mist};">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: ${COLORS.stone}; text-align: center; line-height: 1.5;">
        Precisa cancelar? Você pode fazer isso pelo painel da reserva a qualquer momento.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Pedido Recebido',
    heroVariant: 'parchment',
    heroLabel: 'Pedido recebido',
    heroTitle: professionalName,
    heroTitleItalic: 'vai confirmar em breve ✨',
    bodyHtml,
  });
}

