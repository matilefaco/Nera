import { buildEmailBase, buildEmailCard } from '../../services/emailBuilder.js';
export function buildBookingReminder24hEmail(data) {
    const { clientName, serviceName, formattedDate, time, professionalName, location, manageUrl, whatsappUrl, confirmUrl, duration } = data;
    const firstName = clientName.split(' ')[0];
    const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Só um aviso carinhoso: seu horário com <strong>${professionalName}</strong> é amanhã.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Guarde um tempinho na sua agenda e cuide-se com calma.
    </p>
    
    ${buildEmailCard([
        { label: 'Serviço', value: serviceName },
        { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
        { label: 'Duração', value: `${duration} minutos` },
        { label: 'Local', value: location }
    ])}

    ${location.includes('Domicílio') ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 10px; margin-bottom: 20px;">
        <tr>
          <td style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; padding: 12px; background-color: #FDFAF7; border: 1px solid #E5DDD6; border-radius: 8px;">
            📍 <strong>Confirme seu endereço com a profissional se necessário.</strong>
          </td>
        </tr>
      </table>
    ` : ''}
    
    <div style="margin-top: 30px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${confirmUrl ? '#A85C3A' : '#18120E'}" style="padding: 18px 45px;">
                  <a href="${confirmUrl || manageUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    ${confirmUrl ? 'Confirmar Presença' : 'Ver Detalhes'}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid #E5DDD6; padding: 14px 40px;">
                  <a href="${whatsappUrl}" target="_blank" style="color: #8A7060; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; text-decoration: none; display: inline-block;">
                    Falar no WhatsApp
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; font-style: italic; text-align: center; margin-top: 40px; border-top: 1px solid #E5DDD6; padding-top: 25px;">
      ${professionalName} já está preparando tudo para o seu atendimento.
    </p>
  `;
    return buildEmailBase({
        topbarText: 'Lembrete',
        heroVariant: 'terracotta',
        heroLabel: 'Lembrete — amanhã é o dia',
        heroTitle: 'Até amanhã,',
        heroTitleItalic: `${firstName}! 🌸`,
        bodyHtml
    });
}
