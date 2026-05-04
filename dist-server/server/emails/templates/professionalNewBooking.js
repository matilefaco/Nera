import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';
export function buildProfessionalNewBookingEmail(data) {
    const { professionalName, clientName, serviceName, formattedDate, time, price, location, agendaUrl, paymentMethods, clientWhatsapp, whatsappUrl } = data;
    const paymentMethodsHtml = paymentMethods && paymentMethods.length > 0
        ? paymentMethods.join(', ')
        : 'Não configurado';
    const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}!
    </p>

    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      ${clientName} acabou de pedir um horário. Confirme agora para ela receber a confirmação.
    </p>

    ${buildEmailCard([
        { label: 'Cliente', value: clientName },
        { label: 'WhatsApp da cliente', value: clientWhatsapp, valueUrl: whatsappUrl },
        { label: 'Serviço', value: serviceName },
        { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
        { label: 'Local', value: location },
        { label: 'Valor', value: price || 'Sob consulta' },
        { label: 'Seu Pagamento', value: paymentMethodsHtml }
    ])}

    <!-- Urgency Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px; margin-bottom: 30px;">
      <tr>
        <td bgcolor="#FFF8F1" style="border: 1px solid #FFECCF; padding: 16px; text-align: center;">
          <p style="font-family: ${FONTS.sans}; font-size: 13px; color: #8A4B00; margin: 0;">
            ⏱ <strong>Responda em até 2 horas.</strong> Clientes que não recebem resposta tendem a cancelar.
          </p>
        </td>
      </tr>
    </table>

    <div style="margin-top: 10px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding-top: 16px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${agendaUrl || '#'}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 11px; color: ${COLORS.stone}; text-decoration: underline;">
                    Ou recusar pelo painel caso não tenha disponibilidade
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
    return buildEmailBase({
        topbarText: 'Nova Reserva',
        heroVariant: 'ink',
        heroLabel: 'Nova reserva na sua agenda',
        heroTitle: 'Chegou!',
        heroTitleItalic: 'Uma nova cliente quer te ver ✨',
        badgeText: 'Aguardando sua confirmação',
        badgeVariant: 'alert',
        bodyHtml,
        ctaText: 'Confirmar Agendamento',
        ctaUrl: agendaUrl || '#',
    });
}
