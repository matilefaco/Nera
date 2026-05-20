import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

interface BookingCancelledData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  waitlistUrl: string;
  cancellationReason?: string;
  waitlistCount?: number;
  profileUrl?: string;
}

export function buildBookingCancelledEmail(data: BookingCancelledData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    waitlistUrl,
    cancellationReason,
    waitlistCount,
    profileUrl
  } = data;

  const hasWaitlist = typeof waitlistCount === 'number' && waitlistCount > 0;

  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; margin-bottom: 25px; line-height: 1.6;">
      <strong>${clientName}</strong> cancelou o horário marcado para ${formattedDate} às ${time}.
    </p>
    
    ${cancellationReason ? `
      <div style="background-color: ${COLORS.parchment}; padding: 20px; border-left: 2px solid ${COLORS.stone}; margin-bottom: 30px;">
        <font style="display: block; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: ${COLORS.stone}; margin-bottom: 8px; font-family: ${FONTS.sans};">Motivo do cancelamento</font>
        <p style="font-size: 14px; color: ${COLORS.ink}; margin: 0; font-family: ${FONTS.sans}; line-height: 1.5;">${cancellationReason}</p>
      </div>
    ` : ''}

    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'O horário era', value: `${formattedDate} às ${time}` }
    ])}
    
    <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid ${COLORS.mist}; text-align: center;">
      <p style="font-family: ${FONTS.sans}; font-size: 14px; color: ${COLORS.ink}; margin-bottom: 25px; line-height: 1.6;">
        ${hasWaitlist 
          ? `✓ <strong>Existem ${waitlistCount} cliente(s) na lista de espera</strong> para essa data. Você pode recuperar esse horário notificando as pessoas agora mesmo.`
          : `O horário já foi liberado na sua vitrine para novos agendamentos.`
        }
      </p>

      ${!hasWaitlist && profileUrl ? `
        <a href="${profileUrl}" target="_blank" style="font-family: ${FONTS.sans}; font-size: 13px; color: ${COLORS.stone}; text-decoration: underline;">
          Compartilhar página e novos horários
        </a>
      ` : ''}
    </div>
  `;

  return buildEmailBase({
    topbarText: 'Atualização da agenda',
    heroVariant: 'parchment',
    heroLabel: 'Agendamento cancelado',
    heroTitle: 'Horário livre',
    heroTitleItalic: '',
    bodyHtml,
    ctaText: hasWaitlist ? 'Avisar Lista de Espera' : 'Acessar Agenda',
    ctaUrl: waitlistUrl
  });
}
