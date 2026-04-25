import { buildEmailBase, buildEmailCard } from '../../../src/services/emailBuilder';

interface ReviewRequestData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  professionalName: string;
  reviewUrl: string;
}

export function buildReviewRequestEmail(data: ReviewRequestData): string {
  const { 
    clientName, 
    serviceName, 
    formattedDate, 
    professionalName, 
    reviewUrl 
  } = data;

  const bodyHtml = `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
      <tr>
        <td align="center">
          <font style="font-size: 24px;">⭐⭐⭐⭐⭐</font>
        </td>
      </tr>
    </table>
    <p>Olá, ${clientName}!</p>
    <p>O seu atendimento de <strong>${serviceName}</strong> com <strong>${professionalName || 'sua profissional'}</strong> foi concluído.</p>
    <p>Sua opinião é fundamental para mantermos o padrão de excelência e ajudar outras clientes a conhecerem o trabalho da profissional.</p>
    
    ${buildEmailCard([
      { label: 'Profissional', value: professionalName || 'Sua profissional' },
      { label: 'Data', value: formattedDate }
    ])}
    
    <p style="font-size: 13px; color: #8A7060; font-style: italic; text-align: center; margin-top: 30px;">
      Sua avaliação leva menos de 1 minuto. ✨
    </p>
  `;

  return buildEmailBase({
    topbarText: 'Avaliação',
    heroVariant: 'parchment',
    heroLabel: 'Experiência concluída',
    heroTitle: 'Como foi seu',
    heroTitleItalic: 'atendimento?',
    badgeText: 'Avalie sua experiência',
    badgeVariant: 'info',
    bodyHtml,
    ctaText: 'Avaliar meu Atendimento',
    ctaUrl: reviewUrl
  });
}
