
import { COLORS, FONTS, buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

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
    clientName,
    paymentMethods
  } = data;

  const paymentMethodsHtml = paymentMethods && paymentMethods.length > 0 
    ? paymentMethods.join(', ')
    : 'A combinar com a profissional';

  const bodyHtml = `
    <p style="margin-bottom: 25px;">Olá, ${clientName}!</p>
    <p style="margin-bottom: 30px;">Seu agendamento foi solicitado com sucesso e agora está aguardando confirmação da profissional.</p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time },
      { label: 'Valor', value: price },
      { label: 'Pagamento aceito', value: paymentMethodsHtml },
      { label: 'Código da reserva', value: reservationCode || '-' }
    ])}
    
    <div style="margin: 35px 0; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
        <tr>
          <td align="center" bgcolor="#FDF2F2" style="border: 1px solid #FBD5D5; padding: 10px 25px;">
            <font style="color: #9B1C1C; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; font-family: ${FONTS.sans};">
              ⏳ Aguardando confirmação
            </font>
          </td>
        </tr>
      </table>
    </div>

    <div style="margin-top: 40px; text-align: center;">
      <p style="font-size: 13px; color: ${COLORS.stone}; margin-bottom: 20px; font-family: ${FONTS.sans};">
        Você pode acompanhar o status ou falar com a profissional pelos botões abaixo:
      </p>
      
      <!-- Action Buttons Area -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding-bottom: 15px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px; border-radius: 9999px;">
                  <a href="${manageUrl}" style="color: ${COLORS.white}; font-family: ${FONTS.sans}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    Gerenciar Reserva
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding: 15px 40px; border: 1px solid ${COLORS.mist}; border-radius: 9999px;">
                  <a href="${whatsappUrl}" style="color: ${COLORS.stone}; font-family: ${FONTS.sans}; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    Falar com a profissional
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin-top: 45px; font-size: 12px; color: ${COLORS.stone}; font-style: italic; text-align: center; border-top: 1px solid ${COLORS.mist}; pt-30px; padding-top: 30px;">
      Você receberá um novo e-mail assim que houver resposta.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Pedido Recebido',
    heroVariant: 'parchment',
    heroLabel: 'Agendamento em análise',
    heroTitle: `${professionalName}`,
    heroTitleItalic: 'recebeu seu pedido ✨',
    bodyHtml,
    footerLinksHtml: `Enviado via Nera &bull; Agendamento Premium`
  });
}
