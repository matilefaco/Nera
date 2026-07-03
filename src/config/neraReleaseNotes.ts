export interface ReleaseNote {
  id: string;
  title: string;
  description: string;
}

export interface ReleasePeriod {
  period: string; // e.g. "Julho 2026"
  publishedAt: string; // ISO String, e.g. "2026-07-01T12:00:00.000Z"
  items: ReleaseNote[];
}

export const releaseNotes: ReleasePeriod[] = [
  {
    period: "Julho 2026",
    publishedAt: "2026-07-01T12:00:00.000Z",
    items: [
      {
        id: "portfolio_ampliado_jul26",
        title: "Portfólio ampliado",
        description: "Agora o plano gratuito permite até 6 fotos no portfólio. Mais espaço para mostrar seu trabalho e encantar novas clientes."
      },
      {
        id: "agenda_manual_inteligente_jul26",
        title: "Agenda manual mais inteligente",
        description: "Quando existir algum conflito de horário, a Nera mostra o contexto com clareza para que você decida com segurança."
      },
      {
        id: "mais_estabilidade_jul26",
        title: "Mais estabilidade na rotina",
        description: "Realizamos melhorias internas para deixar agendamentos, notificações e confirmações ainda mais confiáveis."
      }
    ]
  }
];

export const getLatestReleaseDate = (): string => {
  if (releaseNotes.length === 0) return "";
  const dates = releaseNotes.map(rn => new Date(rn.publishedAt).getTime());
  const maxDate = Math.max(...dates);
  return new Date(maxDate).toISOString();
};

export const hasNewReleases = (lastViewedAt: string | undefined | null): boolean => {
  if (releaseNotes.length === 0) return false;
  if (!lastViewedAt) return true; // If never viewed, show it
  
  try {
    const latestTime = new Date(getLatestReleaseDate()).getTime();
    const viewedTime = new Date(lastViewedAt).getTime();
    if (isNaN(latestTime) || isNaN(viewedTime)) return true;
    return latestTime > viewedTime;
  } catch (err) {
    return true; // Fallback to safe showing in case of parse error
  }
};
