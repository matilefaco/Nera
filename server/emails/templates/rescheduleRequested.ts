import { buildEmailBase, buildEmailCard, COLORS, FONTS } from '../../services/emailBuilder.js';

export function buildRescheduleRequestedEmail(data: {
  professionalName: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  dashboardUrl: string;
}) {
  const { professionalName, clientName, serviceName, date, time, dashboardUrl } = data;
  
  const bodyHtml = `
    <p style="font-family: ${FONTS.sans}; font-size: 16px; color: ${COLORS.ink}; margin-bottom: 20px;">
      Olá, ${professionalName}.
    </p>
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px;">
      A cliente <strong>${clientName}</strong> indicou através do lembrete que <strong>não poderá comparecer</strong> e <strong>solicitou remarcação</strong> para o horário abaixo:
    </p>
    
    ${buildEmailCard([
      { label: 'Cliente', value: clientName },
      { label: 'Serviço', value: serviceName },
      { label: 'Data', value: date.split('-').reverse().join('/') },
      { label: 'Horário', value: time }
    ])}
    
    <p style="font-family: ${FONTS.sans}; font-size: 15px; color: ${COLORS.stone}; line-height: 1.6; margin-bottom: 25px; margin-top: 25px;">
      A cliente já está com o acesso para escolher um novo horário na sua agenda. Se preferir, você pode liberar este horário manualmente ou entrar em contato.
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Aviso de Remarcação',
    heroVariant: 'clay',
    heroLabel: 'Mudança de Planos',
    heroTitle: 'Pedido de',
    heroTitleItalic: 'remarcação',
    bodyHtml,
    ctaText: 'Ver Agenda',
    ctaUrl: dashboardUrl
  });
}
