import { buildEmailBase, buildEmailCard, COLORS } from '../../services/emailBuilder.js';

interface DigitalReceiptData {
  clientName?: string;
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price: string;
  bookingUrl: string;
}

export function buildDigitalReceiptEmail(data: DigitalReceiptData): string {
  const { 
    clientName, 
    professionalName, 
    serviceName, 
    formattedDate, 
    time, 
    price, 
    bookingUrl 
  } = data;

  const firstName = clientName ? clientName.split(' ')[0] : 'Cliente';

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px; font-weight: 500;">
      Olá, ${firstName}.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.7;">
      Foi um prazer receber você hoje. Acreditamos que seu tempo com ${professionalName} tenha sido um momento de cuidado e renovação. 
      Abaixo, você encontra o registro da sua experiência.
    </p>
    
    ${buildEmailCard([
      { label: 'A Experiência', value: serviceName },
      { label: 'O Momento', value: `${formattedDate} às ${time}` },
      { label: 'Com', value: professionalName },
      { label: 'Valor', value: price }
    ])}

    <div style="margin-top: 40px; text-align: center;">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; font-style: italic; margin-bottom: 30px;">
        "A beleza reside na intenção que colocamos em cada detalhe."
      </p>
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${bookingUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; text-decoration: none; display: inline-block;">
                  Agendar Próxima Visita
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return buildEmailBase({
    topbarText: 'Sua Experiência',
    heroVariant: 'parchment',
    heroLabel: 'Recibo Digital',
    heroTitle: 'Tudo pronto,',
    heroTitleItalic: 'até breve ✨',
    badgeText: '✓ Finalizado',
    badgeVariant: 'success',
    bodyHtml
  });
}
