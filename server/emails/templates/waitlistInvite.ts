import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface WaitlistInviteData {
  clientName: string;
  professionalName: string;
  formattedDate: string;
  time: string;
  bookingUrl: string;
}

export function buildWaitlistInviteEmail(data: WaitlistInviteData): string {
  const { clientName, professionalName, formattedDate, time, bookingUrl } = data;

  const bodyHtml = `
    <p>Olá, ${clientName}!</p>
    <p>Temos ótimas notícias: um horário abriu na agenda de <strong>${professionalName}</strong> exatamente no período que você desejava.</p>
    
    ${buildEmailCard([
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time },
      { label: 'Profissional', value: professionalName }
    ])}
    
    <p>Este convite é exclusivo para você, mas corra: outras clientes na lista também foram notificadas e a vaga será preenchida por quem confirmar primeiro.</p>
  `;

  return buildEmailBase({
    topbarText: 'Oportunidade',
    heroVariant: 'terracotta',
    heroLabel: 'Lista de espera',
    heroTitle: 'Um horário',
    heroTitleItalic: 'ficou disponível',
    badgeText: 'Vaga Liberada',
    badgeVariant: 'success',
    bodyHtml,
    ctaText: 'Reservar Agora',
    ctaUrl: bookingUrl
  });
}
