import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface BookingRescheduledData {
  clientName: string;
  serviceName: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  professionalName: string;
  manageUrl: string;
}

export function buildBookingRescheduledEmail(data: BookingRescheduledData): string {
  const { 
    clientName, 
    serviceName, 
    oldDate, 
    oldTime, 
    newDate, 
    newTime, 
    professionalName, 
    manageUrl 
  } = data;

  const bodyHtml = `
    <p>Olá, ${clientName}!</p>
    <p>O seu agendamento de <strong>${serviceName}</strong> com <strong>${professionalName || 'sua profissional'}</strong> foi alterado para um novo horário.</p>
    
    <div style="margin: 25px 0;">
      <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: #8A7060; margin-bottom: 10px; font-family: Arial, sans-serif;">Horário Anterior</font>
      <p style="margin: 0; color: #8A7060; font-size: 14px; text-decoration: line-through;">${oldDate} às ${oldTime}</p>
    </div>

    <div style="margin: 25px 0 35px 0;">
      <font style="display: block; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; color: #A85C3A; margin-bottom: 10px; font-family: Arial, sans-serif;">Novo Horário</font>
      ${buildEmailCard([
        { label: 'Data', value: newDate },
        { label: 'Horário', value: newTime }
      ])}
    </div>
    
    <p style="font-size: 13px; color: #8A7060; line-height: 1.6;">
      Todas as outras informações do seu atendimento permanecem as mesmas. Caso tenha algum imprevisto com o novo horário, você pode gerenciar pelo link abaixo.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Reagendamento',
    heroVariant: 'parchment',
    heroLabel: 'Houve uma mudança',
    heroTitle: 'Seu horário foi',
    heroTitleItalic: 'reagendado ✨',
    badgeText: 'Horário Atualizado',
    badgeVariant: 'info',
    bodyHtml,
    ctaText: 'Ver Nova Reserva',
    ctaUrl: manageUrl
  });
}
