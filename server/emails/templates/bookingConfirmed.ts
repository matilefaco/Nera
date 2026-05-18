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
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 25px; font-weight: 500;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #5C4A3D; margin-bottom: 35px; line-height: 1.7;">
      Seu horário com <strong>${professionalName}</strong> foi confirmado. 
      Abaixo você encontra os detalhes para o seu atendimento.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Profissional', value: professionalName || 'Sua profissional' }
    ])}

    <div style="margin-top: 30px; padding: 0 10px;">
      <h4 style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #18120E; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px;">Localização</h4>
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #18120E; line-height: 1.5;">
        <div style="font-weight: 600; font-size: 15px;">${location}</div>
        ${fullAddress}
        ${mapsUrl ? `
          <div style="margin-top: 12px;">
            <a href="${mapsUrl}" target="_blank" style="color: ${COLORS.stone}; font-size: 11px; font-weight: bold; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.1em;">
              Ver no Mapa
            </a>
          </div>
        ` : ''}
      </div>
    </div>

    ${prepInstructions ? `
      <div style="margin-top: 40px; padding: 25px; border: 1px solid ${COLORS.mist};">
        <h4 style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #18120E; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px;">Instruções</h4>
        <p style="font-family: Arial, sans-serif; font-size: 14px; color: #5C4A3D; margin: 0; line-height: 1.6;">${prepInstructions}</p>
      </div>
    ` : ''}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 50px;">
      <!-- Primary Button -->
      <tr>
        <td align="center">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" bgcolor="${COLORS.ink}" style="padding: 18px 45px;">
                <a href="${calendarUrl}" target="_blank" style="color: #FDFAF7; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.25em; text-decoration: none; display: inline-block;">
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
          <td height="16" style="font-size: 16px; line-height: 16px;">&nbsp;</td>
        </tr>

        <!-- Secondary Button -->
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border: 1px solid ${COLORS.mist}; padding: 14px 40px;">
                  <a href="${whatsappUrl}" target="_blank" style="color: ${COLORS.stone}; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.2em; text-decoration: none; display: inline-block;">
                    Mensagem para profissional
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      ` : ''}
    </table>

    <div style="margin-top: 45px; text-align: center; padding-top: 30px; border-top: 1px solid ${COLORS.mist};">
      <p style="font-family: Arial, sans-serif; font-size: 12px; color: ${COLORS.stone}; letter-spacing: 0.05em;">
        Precisa reagendar? <a href="${manageUrl}" style="color: ${COLORS.stone}; font-weight: bold; text-decoration: underline;">Gerencie sua reserva</a>.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'parchment',
    heroLabel: 'Reserva confirmada',
    heroTitle: 'Tudo pronto',
    heroTitleItalic: 'para a sua visita ✨',
    badgeText: '✓ Confirmado',
    badgeVariant: 'success',
    bodyHtml
  });
}
