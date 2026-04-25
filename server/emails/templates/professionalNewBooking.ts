import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface ProfessionalNewBookingData {
  professionalName: string;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  time: string;
  price?: string;
  location: string;
  agendaUrl?: string;
  paymentMethods?: string[];
}

export function buildProfessionalNewBookingEmail(data: ProfessionalNewBookingData): string {
  const { professionalName, clientName, serviceName, formattedDate, time, price, location, agendaUrl, paymentMethods } = data;

  const paymentMethodsHtml = paymentMethods && paymentMethods.length > 0 
    ? paymentMethods.join(', ')
    : 'Não configurado';

  const bodyHtml = `
    <p style="font-family: Arial, sans-serif; font-size: 16px; color: #18120E; margin-bottom: 20px;">
      Olá, ${professionalName}!
    </p>

    <p style="font-family: Arial, sans-serif; font-size: 14px; color: #8A7060; margin-bottom: 30px; line-height: 1.6;">
      Uma nova cliente solicitou um horário com você no Nera. Confirme para garantir o agendamento.
    </p>

    ${buildEmailCard([
      { label: 'Cliente', value: clientName },
      { label: 'Serviço', value: serviceName },
      { label: 'Data', value: formattedDate },
      { label: 'Horário', value: time },
      { label: 'Local', value: location },
      { label: 'Valor', value: price || 'Sob consulta' },
      { label: 'Seu Pagamento', value: paymentMethodsHtml }
    ])}

    <p style="font-family: Arial, sans-serif; font-size: 13px; color: #8A7060; font-style: italic; text-align: center; margin-top: 30px;">
      Acesse o app para confirmar ou recusar esta solicitação.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Nova Reserva',
    heroVariant: 'ink',
    heroLabel: 'Sua agenda',
    heroTitle: 'Nova solicitação',
    heroTitleItalic: 'de agendamento',
    badgeText: 'Aguardando sua confirmação',
    badgeVariant: 'alert',
    bodyHtml,
    ctaText: 'Confirmar Agendamento',
    ctaUrl: agendaUrl || '#',
  });
}
