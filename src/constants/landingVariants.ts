export interface LandingVariant {
  path: string;
  niche: string;
  title: string;
  description: string;
  headline: string;
  subheadline: string;
  problems: { num: string; text: string }[];
  benefits: { title: string; desc: string; icon: 'calendar' | 'bell' | 'shop' | 'chart' | 'users' | 'gift' }[];
  forWhoDesc: string;
}

export const landingVariants: Record<string, LandingVariant> = {
  'para-nail-designers': {
    path: '/para-nail-designers',
    niche: 'Nail Designer',
    title: 'Nera | Agenda online para Nail Designers',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para nail designers, manicures e especialistas em alongamento de unhas.',
    headline: 'Sua agenda cheia e sem mistérios para Nail Designers',
    subheadline: 'Uma presença profissional completa: vitrine digital, agendamento online 24h e lembretes de retorno para fidelizar suas clientes de alongamento e manicure.',
    problems: [
      {
        num: '01',
        text: 'Você passa o dia inteiro respondendo mensagens no WhatsApp em vez de focar nos alongamentos e nail art.'
      },
      {
        num: '02',
        text: 'Clientes esquecem de confirmar ou atrasam o agendamento de manutenção, bagunçando toda a sua grade do dia.'
      },
      {
        num: '03',
        text: 'Faltas de última hora sem aviso prévio e clientes que não voltam para a manutenção causam prejuízos ocultos.'
      }
    ],
    benefits: [
      {
        title: 'Agenda inteligente',
        desc: 'Receba reservas online ou registre seus horários atuais manualmente. Você não perde nem o papel, nem o que vem da internet.',
        icon: 'calendar'
      },
      {
        title: 'Lembretes de manutenção',
        desc: 'Notificações por e-mail ou WhatsApp (Pro) para suas clientes não esquecerem a data limite de manutenção.',
        icon: 'bell'
      },
      {
        title: 'Vitrine de unhas premium',
        desc: 'Mostre suas melhores fotos de alongamento de unhas em uma página que trabalha enquanto você atende.',
        icon: 'shop'
      },
      {
        title: 'Faturamento em dia',
        desc: 'Controle de faltas e pagamentos para você saber exatamente quanto lucrou em cada procedimento.',
        icon: 'chart'
      },
      {
        title: 'Fidelização ativa',
        desc: 'Acompanhe quem está esfriando e reative clientes com um clique no WhatsApp, mantendo a agenda cheia de retornos.',
        icon: 'users'
      },
      {
        title: 'Cupons de indicação',
        desc: 'Facilite o boca a boca com cupons personalizados, estimulando suas clientes a trazerem novas amigas.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Designers de unhas, manicures, estúdios de alongamento em gel ou acrílico e profissionais autônomas que buscam organizar o dia a dia.'
  },
  'para-sobrancelhistas': {
    path: '/para-sobrancelhistas',
    niche: 'Sobrancelhista',
    title: 'Nera | Agenda online para Sobrancelhistas',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para sobrancelhistas, designers de sobrancelha e lash designers.',
    headline: 'Seu estúdio organizado e com agenda cheia',
    subheadline: 'Agendamento online automatizado, controle de retorno e vitrine profissional para Sobrancelhistas, Designers de Sobrancelha e Lash Designers.',
    problems: [
      {
        num: '01',
        text: 'Perda de tempo no vai-e-vem do WhatsApp tentando achar o horário perfeito para a cliente.'
      },
      {
        num: '02',
        text: 'Falta de controle dos prazos ideais para retoque de micropigmentação ou manutenção de extensão de cílios.'
      },
      {
        num: '03',
        text: 'Perfil do Instagram sem um link de agendamento rápido e profissional para converter visitantes em clientes.'
      }
    ],
    benefits: [
      {
        title: 'Agilidade no atendimento',
        desc: 'Receba reservas online ou registre seus horários de retoques e novos designs. Menos mensagens, mais tempo livre.',
        icon: 'calendar'
      },
      {
        title: 'Retoque programado',
        desc: 'Notificações automáticas no WhatsApp para garantir que suas clientes agendem o design ou manutenção de cílios na frequência certa.',
        icon: 'bell'
      },
      {
        title: 'Vitrine de olhar premium',
        desc: 'Mostre os resultados de "antes e depois" do seu trabalho em uma página elegante que valoriza sua marca pessoal.',
        icon: 'shop'
      },
      {
        title: 'Histórico de atendimento',
        desc: 'Saiba o mapeamento de cílios (mapping), técnicas de sobrancelha e cores de pigmentos utilizadas em cada cliente.',
        icon: 'chart'
      },
      {
        title: 'Prevenção de furos',
        desc: 'Identifique na hora as clientes inativas e use nossa reativação simples por WhatsApp para preencher lacunas na agenda.',
        icon: 'users'
      },
      {
        title: 'Programa de indicação',
        desc: 'Estimule suas clientes a recomendarem seu trabalho de cílios e sobrancelha com vantagens transparentes.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Designers de sobrancelha, micropigmentadoras, lash designers, estúdios de cílios e profissionais da beleza do olhar.'
  },
  'para-esteticistas': {
    path: '/para-esteticistas',
    niche: 'Esteticista',
    title: 'Nera | Agenda online para Esteticistas',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para esteticistas faciais e corporais, clínicas e profissionais autônomas.',
    headline: 'Organização cirúrgica para seu estúdio de Estética',
    subheadline: 'Gerencie históricos de atendimento, sessões de pacotes recorrentes e reduza as faltas com lembretes automáticos focados em Estética Facial e Corporal.',
    problems: [
      {
        num: '01',
        text: 'Dificuldade para organizar e consultar rapidamente o histórico de tratamentos de cada cliente ao longo do tempo.'
      },
      {
        num: '02',
        text: 'Esquecimento de sessões em pacotes contratados, gerando furos na sua agenda e esticando o tratamento.'
      },
      {
        num: '03',
        text: 'Mensagens manuais de confirmação de procedimentos estéticos tomam o precioso tempo que você usaria para atender.'
      }
    ],
    benefits: [
      {
        title: 'Controle de pacotes',
        desc: 'Agende sessões recorrentes com facilidade, mantendo os tratamentos e pacotes corporais ou faciais sempre nos trilhos.',
        icon: 'calendar'
      },
      {
        title: 'Confirmação automática',
        desc: 'A Nera envia lembretes profissionais para reduzir cancelamentos de última hora em procedimentos longos.',
        icon: 'bell'
      },
      {
        title: 'Vitrine clínica moderna',
        desc: 'Apresente seus procedimentos, protocolos, preços e depoimentos em um link rápido de altíssima qualidade visual.',
        icon: 'shop'
      },
      {
        title: 'Análise de resultados',
        desc: 'Monitore suas finanças e saiba quais protocolos de estética são os mais rentáveis para o seu estúdio.',
        icon: 'chart'
      },
      {
        title: 'Histórico de protocolos',
        desc: 'Guarde observações detalhadas de alergias, parâmetros de equipamentos e reações de cada sessão em prontuários integrados.',
        icon: 'users'
      },
      {
        title: 'Crescimento saudável',
        desc: 'Aproveite cupons promocionais e incentivos de indicação para fidelizar clientes e expandir sua cartela organicamente.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Esteticistas faciais e corporais, cosmetólogas, aplicadoras de drenagem linfática, limpeza de pele, massoterapeutas e clínicas de estética.'
  },
  'para-cabeleireiras': {
    path: '/para-cabeleireiras',
    niche: 'Cabeleireira',
    title: 'Nera | Agenda online para Cabeleireiras',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para cabeleireiras autônomas, coloristas e salões de beleza.',
    headline: 'Sua cadeira sempre ocupada e sua agenda organizada',
    subheadline: 'A agenda inteligente e vitrine digital perfeita para Cabeleireiras autônomas gerenciarem cortes, mechas, tratamentos e histórico de clientes.',
    problems: [
      {
        num: '01',
        text: 'Atrasos acumulados ao longo do dia por falta de controle exato dos tempos variados de mechas, cortes e escovas.'
      },
      {
        num: '02',
        text: 'Dificuldade de rastrear quais clientes fiéis estão esfriando e há tempos não retornam para retocar a cor ou cortar.'
      },
      {
        num: '03',
        text: 'Lembretes manuais por mensagem após um longo dia em pé tomam horas de descanso que deveriam ser suas.'
      }
    ],
    benefits: [
      {
        title: 'Durações flexíveis',
        desc: 'Configure o tempo necessário exato para cada serviço (escova, corte, mecha, progressiva) para manter a pontualidade.',
        icon: 'calendar'
      },
      {
        title: 'Lembretes automáticos',
        desc: 'Evite o no-show em procedimentos caros enviando notificações profissionais sem precisar digitar uma única palavra.',
        icon: 'bell'
      },
      {
        title: 'Sua marca em destaque',
        desc: 'Uma vitrine digital de alto nível para divulgar fotos de suas transformações, mechas, cortes e fidelizar visualmente.',
        icon: 'shop'
      },
      {
        title: 'Visão financeira clara',
        desc: 'Controle o faturamento e saiba exatamente quanto cada cadeira e cada horário representam no seu balanço mensal.',
        icon: 'chart'
      },
      {
        title: 'Ficha técnica integrada',
        desc: 'Guarde históricos de fórmulas de tinturas, marcas de produtos utilizadas e o histórico completo de cada fibra capilar.',
        icon: 'users'
      },
      {
        title: 'Cupons inteligentes',
        desc: 'Promova horários de menor movimento com cupons e mantenha seu salão faturando em qualquer dia da semana.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Cabeleireiras, coloristas, especialistas em megahair, terapeutas capilares e proprietárias de salões ou estúdios de beleza.'
  }
};
