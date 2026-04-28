import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface WaitlistInviteData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  servicePrice?: string;
  formattedDate: string;
  time: string;
  bookingUrl: string;
  expiresInHours: number; // horas até o convite expirar
  isExclusive?: boolean;  // true = só ela foi convidada
}

export function buildWaitlistInviteEmail(data: WaitlistInviteData): string {
  const { 
    clientName, 
    professionalName, 
    serviceName, 
    servicePrice, 
    formattedDate, 
    time, 
    bookingUrl, 
    expiresInHours, 
    isExclusive 
  } = data;

  const badgeText = isExclusive ? "Convite exclusivo para você" : `⏰ Expira em ${expiresInHours} horas`;
  const badgeVariant = isExclusive ? 'success' : 'alert';

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin-bottom: 25px; line-height: 1.6;">
      ${isExclusive 
        ? "Este convite é exclusivo para você. Reserve agora e garanta seu horário."
        : "Outras clientes na lista também foram notificadas. A vaga vai para quem confirmar primeiro."
      }
    </p>

    ${buildEmailCard([
      { label: 'Profissional', value: professionalName },
      { label: 'Serviço', value: serviceName },
      ...(servicePrice ? [{ label: 'Preço', value: servicePrice }] : []),
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time }
    ])}
    
    <div style="margin-top: 40px; text-align: center;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${COLORS.terracotta}" style="padding: 18px 45px;">
                  <a href="${bookingUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.white}; text-decoration: none; display: inline-block;">
                    GARANTIR MEU HORÁRIO →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top: 10px;">
            <font style="font-family: ${FONTS.sans}; font-size: 11px; color: ${COLORS.stone};">
              Este link expira em ${expiresInHours} horas.
            </font>
          </td>
        </tr>
      </table>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Oportunidade',
    heroVariant: 'terracotta',
    heroLabel: 'Sua vaga está esperando',
    heroTitle: `${clientName},`,
    heroTitleItalic: 'um horário abriu pra você! 🌟',
    badgeText,
    badgeVariant,
    bodyHtml
  });
}
