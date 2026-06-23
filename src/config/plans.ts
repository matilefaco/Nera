
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
    tagline: 'Para começar, organizar sua agenda e sentir a diferença.',
    features: [
      { text: 'Agendamentos manuais ilimitados', isHighlight: true },
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
    tagline: 'Para quem já atende com frequência e quer entender melhor suas clientes.',
    features: [
      { text: 'Agendamentos online ilimitados' },
      { text: 'Saiba exatamente quem são suas melhores clientes', isHighlight: true },
      { text: 'Entenda quem voltou, quem sumiu e quem mais compra', isHighlight: true },
      { text: 'Nunca mais esqueça quem atendeu e o que fez' },
      { text: 'Confirmações e lembretes por e-mail' },
      { text: 'Gestão organizada de clientes' }
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
    tagline: 'Para quem já está no ritmo e quer fazer clientes voltarem, preencher horários e crescer.',
    features: [
      { text: 'Tudo do Essencial + Notificações WhatsApp', isHighlight: true },
      { text: 'Receba uma lista pronta de clientes para chamar de volta', isHighlight: true },
      { text: 'Saiba quanto dinheiro está parado em clientes que não retornaram' },
      { text: 'Transforme horários vazios em novas reservas' },
      { text: 'Lista de espera inteligente' },
      { text: 'Cupons, fidelidade e indicação para atrair mais clientes' },
      { text: 'Relatório mensal de performance em PDF' }
    ],
    cta: 'Começar como Pro'
  }
];
