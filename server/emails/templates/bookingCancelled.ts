import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface BookingCancelledData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  waitlistUrl: string;
}

export function buildBookingCancelledEmail(data: BookingCancelledData): string {
  const { 
    professionalName, 
    clientName, 
    serviceName, 
    formattedDate, 
    time, 
    waitlistUrl 
  } = data;

  const bodyHtml = `
    <p>Olá, ${professionalName || 'Profissional'}!</p>
    <p>Informamos que o agendamento de <strong>${clientName}</strong> foi cancelado.</p>
    
    ${buildEmailCard([
      { label: 'Cliente', value: clientName },
      { label: 'Serviço', value: serviceName },
      { label: 'Data Original', value: `${formattedDate} às ${time}` }
    ])}
    
    <p>O horário foi liberado instantaneamente na sua agenda e está disponível para novas reservas.</p>
    
    <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center;">
      Dica: Você pode verificar sua Lista de Espera para encaixar outra cliente interessada neste período.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Cancelamento',
    heroVariant: 'ink',
    heroLabel: 'Horário liberado',
    heroTitle: 'Reserva',
    heroTitleItalic: 'cancelada',
    badgeText: 'Reserva Cancelada',
    badgeVariant: 'pending',
    bodyHtml,
    ctaText: 'Ver Lista de Espera',
    ctaUrl: waitlistUrl
  });
}
