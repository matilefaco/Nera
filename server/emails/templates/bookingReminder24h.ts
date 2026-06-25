import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingReminderData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  professionalName: string;
  location: string;
  manageUrl: string;
  whatsappUrl: string;
  confirmUrl?: string; // link para confirmar presença
  duration: string | number;
}

export function buildBookingReminder24hEmail(data: BookingReminderData): string {
  const { 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    professionalName, 
    location, 
    manageUrl,
    whatsappUrl,
    confirmUrl,
    duration
  } = data;

  const firstName = clientName.split(' ')[0];

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${firstName}. Seu atendimento está chegando.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 30px; line-height: 1.6;">
      Confirme sua presença pelo botão abaixo.<br/><br/>
      Você também pode usar o mesmo link para remarcar ou cancelar, se precisar.
    </p>
    
    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data e Hora', value: `${formattedDate} às ${time}` },
      { label: 'Duração estimada', value: `${duration} min` },
      { label: 'Local', value: location }
    ])}

    ${location.includes('Domicílio') ? `
      <p style="font-family: ${FONTS.sans}; font-size: 13px; color: ${COLORS.stone}; margin-top: 15px; background-color: ${COLORS.parchment}; padding: 15px; border-left: 2px solid ${COLORS.terracotta};">
        📍 <strong>Dica Nera:</strong> Verifique se no painel o seu endereço está certinho para a profissional chegar até você.
      </p>
    ` : ''}
    
    <div style="margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid ${COLORS.mist};">
      ${whatsappUrl ? `
        <a href="${whatsappUrl}" target="_blank" style="color: ${COLORS.stone}; font-family: ${FONTS.sans}; font-size: 13px; text-decoration: underline;">
          Dúvidas? Fale com a profissional no WhatsApp.
        </a><br><br>
      ` : ''}
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Lembrete',
    heroVariant: 'terracotta',
    heroLabel: 'Amanhã é o dia',
    heroTitle: 'Te esperamos,',
    heroTitleItalic: `${firstName} ✨`,
    bodyHtml,
    ctaText: confirmUrl ? 'Confirmar Presença' : 'Visualizar Horário',
    ctaUrl: confirmUrl || manageUrl
  });
}
