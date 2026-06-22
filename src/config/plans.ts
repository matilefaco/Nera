
export interface PlanFeature {
  text: string;
  isNew?: boolean;
  isHighlight?: boolean;
}

export interface Plan {
  id: 'free' | 'essencial' | 'pro';
  name: string;
  price: number;
  priceDescriptor: string;
  subtitle: string;
  trialDays: number;
  features: PlanFeature[];
  cta: string;
  popular?: boolean;
  tagline?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    priceDescriptor: '/mês',
    subtitle: 'Plano gratuito para começar com teste sem risco.',
    trialDays: 0,
    tagline: 'Ideal para começar',
    features: [
      { text: 'Perfil digital premium (foto, bio e serviços)' },
      { text: 'Até 15 reservas online por mês' },
      { text: 'Aprovação manual (seu filtro)' },
      { text: 'Link direto para bio' }
    ],
    cta: 'Criar conta grátis'
  },
  {
    id: 'essencial',
    name: 'Essencial',
    price: 49,
    priceDescriptor: '/mês',
    subtitle: 'Sua vitrine impecável e agenda sob controle.',
    trialDays: 15,
    tagline: 'Presença e Controle',
    features: [
      { text: 'Agenda digital com agendamentos ilimitados' },
      { text: 'Vitrine pública premium com seus serviços' },
      { text: 'Experiência profissional por e-mail' },
      { text: 'Confirmações e lembretes por e-mail' },
      { text: 'Gestão de clientes e histórico de atendimentos' }
    ],
    cta: 'Testar Essencial por 15 dias'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    priceDescriptor: '/mês',
    subtitle: 'Recursos avançados para crescer e recuperar oportunidades.',
    trialDays: 0,
    popular: true,
    tagline: 'Crescimento e Autoridade',
    features: [
      { text: 'Tudo do Essencial + Notificações WhatsApp', isHighlight: true },
      { text: 'Lista de espera para recuperar horários' },
      { text: 'Cupons de desconto para fidelização' },
      { text: 'Relatório mensal de performance em PDF' },
      { text: 'Badge Pro na vitrine' },
      { text: 'Link de indicação premiado' },
      { text: 'Suporte prioritário' }
    ],
    cta: 'Começar como Pro'
  }
];
