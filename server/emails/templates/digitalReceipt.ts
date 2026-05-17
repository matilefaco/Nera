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
      Seu atendimento com ${professionalName} foi finalizado. Abaixo, você encontra o registro dos serviços realizados e valores correspondentes.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Profissional', value: professionalName },
      { label: 'Valor total', value: price }
    ])}

    <div style="margin-top: 40px; text-align: center;">
      &nbsp;
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${bookingUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; text-decoration: none; display: inline-block;">
                  Novo agendamento
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return buildEmailBase({
    topbarText: 'Recibo',
    heroVariant: 'parchment',
    heroLabel: 'Recibo Digital',
    heroTitle: 'Atendimento',
    heroTitleItalic: 'concluído ✨',
    badgeText: '✓ Finalizado',
    badgeVariant: 'success',
    bodyHtml
  });
}
