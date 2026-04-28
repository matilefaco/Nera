import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder.js';

interface RetentionEmailData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  bookingUrl: string;
  lastServiceDate: string;  // ex: "12 de março"
  daysSince: number;        // ex: 32
}

export function buildRetentionEmail(data: RetentionEmailData): string {
  const { clientName, professionalName, serviceName, bookingUrl, lastServiceDate, daysSince } = data;
  const firstName = clientName.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Oi, ${firstName}!
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Você esteve com <strong>${professionalName}</strong> para <strong>${serviceName}</strong> em ${lastServiceDate}.
      <br><br>
      Que tal marcar o próximo horário?
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#18120E" style="padding: 18px 50px;">
                <a href="${bookingUrl}" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                  MARCAR MEU PRÓXIMO HORÁRIO
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 12px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="font-family: Arial, sans-serif; font-size: 11px; color: #8A7060;">
                Reserve em menos de 1 minuto.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return buildEmailBase({
    topbarText: 'Hora de Retornar',
    heroVariant: 'terracotta',
    heroLabel: `Saudades, ${firstName}!`,
    heroTitle: 'Está na hora de',
    heroTitleItalic: 'se cuidar de novo 🌸',
    badgeText: `Faz ${daysSince} dias desde seu último horário`,
    badgeVariant: 'info',
    bodyHtml,
  });
}
