import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingConfirmedData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  professionalName: string;
  location: string;
  calendarUrl: string;
  manageUrl: string;
  prepInstructions?: string; // instruções de preparo enviadas pela profissional
  whatsappUrl?: string;      // link wa.me/ para a profissional
  locationType?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
}

export function buildBookingConfirmedEmail(data: BookingConfirmedData): string {
  const { 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    professionalName, 
    location, 
    calendarUrl,
    manageUrl,
    prepInstructions,
    whatsappUrl,
    address,
    locationType
  } = data;

  const isStudio = locationType === 'studio' || locationType === 'estudio' || !locationType;
  const hasValidAddress = address && address.street;
  
  // Format full address
  let fullAddress = '';
  let mapsUrl = '';

  if (isStudio && hasValidAddress) {
    const parts = [];
    if (address.street) parts.push(address.street);
    if (address.number) parts.push(address.number);
    if (address.complement) parts.push(address.complement);
    
    const secondLine = [];
    if (address.neighborhood) secondLine.push(address.neighborhood);
    if (address.city) secondLine.push(address.city);

    fullAddress = `
      <div style="font-size: 13px; color: #18120E; margin-top: 4px; font-family: Arial, sans-serif; line-height: 1.4;">
        ${parts.join(', ')}<br/>
        ${secondLine.join(' — ')}
      </div>
    `;

    const searchQuery = encodeURIComponent(`${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}`);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  }

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Tudo certo, ${clientName}! ${professionalName} confirmou seu horário.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Anote na sua agenda e se prepare para esse momento.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
      { label: 'Profissional', value: professionalName || 'Sua profissional' },
      { label: 'Local', value: `
        <div>
          <div style="font-weight: bold;">${location}</div>
          ${fullAddress}
          ${mapsUrl ? `
            <div style="margin-top: 8px;">
              <a href="${mapsUrl}" target="_blank" style="color: ${COLORS.terracotta}; font-size: 11px; font-weight: bold; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.05em;">
                Abrir no Google Maps
              </a>
            </div>
          ` : ''}
        </div>
      ` }
    ])}

    ${prepInstructions ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#F9F5F0" style="border: 1px dashed #E5DDD6; margin: 30px 0;">
        <tr>
          <td style="padding: 25px;">
            <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.terracotta}; margin-bottom: 10px; font-family: Arial, sans-serif;">COMO SE PREPARAR</font>
            <p style="font-size: 13px; color: #18120E; margin: 0; font-family: Arial, sans-serif; line-height: 1.5;">${prepInstructions}</p>
          </td>
        </tr>
      </table>
    ` : ''}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px;">
      <!-- Primary Button -->
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${calendarUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                  Adicionar ao Calendário
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${whatsappUrl ? `
        <!-- Spacer -->
        <tr>
          <td height="12" style="font-size: 12px; line-height: 12px;">&nbsp;</td>
        </tr>

        <!-- Secondary Button -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                  <a href="${whatsappUrl}" target="_blank" style="color: ${COLORS.stone}; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; text-decoration: none; display: inline-block;">
                    Falar com ${professionalName}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : ''}
    </table>

    <div style="margin-top: 35px; text-align: center;">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: ${COLORS.stone};">
        Precisa reagendar? <a href="${manageUrl}" style="color: ${COLORS.stone}; text-decoration: underline;">Faça isso pelo painel da sua reserva.</a>
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'terracotta',
    heroLabel: 'Reserva confirmada',
    heroTitle: 'Tudo pronto!',
    heroTitleItalic: 'para te receber ✨',
    badgeText: '✓ Agendamento Confirmado',
    badgeVariant: 'success',
    bodyHtml
  });
}
