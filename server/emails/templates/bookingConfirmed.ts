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
  prepInstructions?: string; 
  whatsappUrl?: string;      
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
      <div style="font-size: 13px; color: ${COLORS.stone}; margin-top: 4px; font-family: ${FONTS.sans}; line-height: 1.4;">
        ${parts.join(', ')}<br/>
        ${secondLine.join(' — ')}
      </div>
    `;

    const searchQuery = encodeURIComponent(`${address.street}, ${address.number}, ${address.neighborhood}, ${address.city}`);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
  }

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 25px; font-weight: 500;">
      Olá, ${clientName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 35px; line-height: 1.7;">
      Seu horário com <strong>${professionalName}</strong> está confirmado. Esperamos você no momento combinado.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Horário', value: `${formattedDate} às ${time}` },
      { label: 'Profissional', value: professionalName || 'Sua profissional' }
    ])}

    <div style="margin-top: 30px; padding: 0 10px;">
      <h4 style="font-family: ${FONTS.sans}; font-size: 12px; font-weight: bold; color: ${COLORS.ink}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px;">Local</h4>
      <div style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.ink}; line-height: 1.5;">
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
        <h4 style="font-family: ${FONTS.sans}; font-size: 12px; font-weight: bold; color: ${COLORS.ink}; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 12px;">Instruções</h4>
        <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.stone}; margin: 0; line-height: 1.6;">${prepInstructions}</p>
      </div>
    ` : ''}

    <div style="margin-top: 40px; text-align: center;">
      ${whatsappUrl ? `
        <a href="${whatsappUrl}" target="_blank" style="color: ${COLORS.stone}; font-family: ${FONTS.sans}; font-size: 13px; text-decoration: underline;">
          Dúvidas? Fale com a profissional no WhatsApp.
        </a>
      ` : ''}
      <p style="font-family: ${FONTS.sans}; font-size: 11px; color: ${COLORS.stone}; margin-top: 15px; line-height: 1.6;">
        Você pode alterar seu agendamento a qualquer momento <a href="${manageUrl}" style="color: ${COLORS.stone}; text-decoration: underline;">pelo painel</a>.
      </p>
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Confirmação',
    heroVariant: 'parchment',
    heroLabel: 'Horário Confirmado',
    heroTitle: 'Tudo pronto',
    heroTitleItalic: 'para a sua visita ✨',
    badgeText: 'Confirmado',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Adicionar ao Calendário',
    ctaUrl: calendarUrl
  });
}
