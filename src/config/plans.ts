
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
      { text: 'Até 15 agendamentos por mês' },
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
    subtitle: 'por mês · cancele quando quiser',
    trialDays: 15,
    tagline: 'Professional',
    features: [
      { text: 'Agendamentos ilimitados' },
      { text: 'Notificações WhatsApp' },
      { text: 'Bloqueio de horários' },
      { text: 'Lembrete automático 24h (reduz faltas)' },
      { text: 'Histórico de clientes' }
    ],
    cta: 'Testar Essencial por 15 dias'
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    priceDescriptor: '/mês',
    subtitle: 'Ferramentas completas para crescer mais rápido',
    trialDays: 15,
    popular: true,
    tagline: 'Nera Elite',
    features: [
      { text: 'Tudo do Essencial, com recursos para crescer mais rápido', isHighlight: true },
      { text: 'Lista de espera inteligente para preencher horários vagos automaticamente' },
      { text: 'Cupons de desconto' },
      { text: 'Relatório mensal em PDF' },
      { text: 'Link de indicação premiado' },
      { text: 'Badge Pro Nera na vitrine' },
      { text: 'Suporte prioritário' }
    ],
    cta: 'Começar como Pro'
  }
];
