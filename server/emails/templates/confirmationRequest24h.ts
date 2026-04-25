import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface ConfirmationRequest24hData {
  clientName: string;
  professionalName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  confirmUrl: string;
  rescheduleUrl: string;
  cancelUrl: string;
}

export function buildConfirmationRequest24hEmail(data: ConfirmationRequest24hData): string {
  const { clientName, professionalName, serviceName, formattedDate, time, confirmUrl, rescheduleUrl, cancelUrl } = data;

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Olá, ${clientName}!
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Lembrete de agendamento: seu horário com <strong>${professionalName}</strong> é amanhã! 
      Você pode confirmar sua presença agora para garantir sua reserva.
    </p>

    ${buildEmailCard([
      { label: 'Serviço', value: serviceName },
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time }
    ])}

    <div style="margin-top: 30px; text-align: center;">
      <a href="${confirmUrl}" style="display: block; background-color: #18120E; color: #ffffff; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; margin-bottom: 12px;">
        CONFIRMAR PRESENÇA
      </a>
      
      <div style="display: flex; gap: 10px; justify-content: center;">
        <a href="${rescheduleUrl}" style="flex: 1; border: 1px solid #E5E1DE; color: #18120E; padding: 12px; border-radius: 12px; text-decoration: none; font-size: 12px; font-weight: bold;">
          REAGENDAR
        </a>
        <a href="${cancelUrl}" style="flex: 1; border: 1px solid #E5E1DE; color: #8A7060; padding: 12px; border-radius: 12px; text-decoration: none; font-size: 12px;">
          CANCELAR
        </a>
      </div>
    </div>

    <p style="font-family: Arial, sans-serif; font-size: 12px; color: #8A7060; text-align: center; margin-top: 30px; font-style: italic;">
      Caso não possa comparecer, por favor reagende ou cancele para liberar o horário para outra pessoa.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Confirmação Necessária',
    heroVariant: 'parchment',
    heroLabel: 'Lembrete',
    heroTitle: 'Seu horário',
    heroTitleItalic: 'é amanhã',
    badgeText: 'Aguardando sua confirmação',
    badgeVariant: 'pending',
    bodyHtml,
    ctaText: 'Ver Detalhes no App',
    ctaUrl: confirmUrl,
  });
}
