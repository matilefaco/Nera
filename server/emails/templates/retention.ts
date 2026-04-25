import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface RetentionEmailData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  bookingUrl: string;
}

export function buildRetentionEmail(data: RetentionEmailData): string {
  const { clientName, professionalName, serviceName, bookingUrl } = data;

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Olá, ${clientName}!
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Faz cerca de um mês que você esteve com <strong>${professionalName}</strong> para realizar o serviço <strong>${serviceName}</strong>. 
      <br><br>
      Estatísticas mostram que agora é o momento ideal para a manutenção. Que tal garantir seu próximo horário agora?
    </p>

    <div style="margin-top: 30px; text-align: center;">
      <a href="${bookingUrl}" style="display: block; background-color: #18120E; color: #ffffff; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px;">
        REPETIR AGENDAMENTO
      </a>
    </div>

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; text-align: center; margin-top: 30px; font-style: italic;">
      Reserve em menos de 1 minuto e mantenha seu autocuidado em dia.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Hora de Retornar',
    heroVariant: 'terracotta',
    heroLabel: 'Saudades',
    heroTitle: 'Que tal',
    heroTitleItalic: 'renovar?',
    badgeText: 'Momento ideal para manutenção',
    badgeVariant: 'pending',
    bodyHtml,
    ctaText: 'Ver Agenda',
    ctaUrl: bookingUrl,
  });
}
