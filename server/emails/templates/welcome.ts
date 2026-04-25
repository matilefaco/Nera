import { buildEmailBase } from '../../../src/services/emailBuilder';

interface WelcomeData {
  name: string;
  loginUrl: string;
}

export function buildWelcomeEmail(data: WelcomeData): string {
  const { name, loginUrl } = data;

  const bodyHtml = `
    <p>Olá, ${name}!</p>
    <p>É um prazer ter você conosco. O Nera foi criado para profissionais que buscam excelência na gestão e uma experiência premium para suas clientes.</p>
    <p>Sua jornada para uma agenda mais inteligente e lucrativa começa aqui.</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#FDFAF7" style="border: 1px solid #E5DDD6; margin: 30px 0;">
      <tr>
        <td style="padding: 25px;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #18120E; font-family: Arial, sans-serif;">Próximos passos:</p>
          <ul style="margin: 0; padding-left: 20px; color: #8A7060; font-size: 14px; font-family: Arial, sans-serif;">
            <li style="margin-bottom: 8px;">Configure seus serviços e valores</li>
            <li style="margin-bottom: 8px;">Defina seus horários de atendimento</li>
            <li>Compartilhe seu link exclusivo com suas clientes</li>
          </ul>
        </td>
      </tr>
    </table>
  `;

  return buildEmailBase({
    topbarText: 'Bem-vinda',
    heroVariant: 'ink',
    heroLabel: 'Comece agora',
    heroTitle: 'Seja bem-vinda',
    heroTitleItalic: 'ao Universo Nera',
    bodyHtml,
    ctaText: 'Acessar meu Painel',
    ctaUrl: loginUrl
  });
}
