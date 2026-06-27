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
  },
  'para-lash-designers': {
    path: '/para-lash-designers',
    niche: 'Lash Designer',
    title: 'Nera | Agenda online para Lash Designers',
    description: 'Agenda online, vitrine digital, lembretes de manutenção e gestão para lash designers e especialistas em extensão de cílios.',
    headline: 'Seu estúdio de cílios organizado e com agenda cheia',
    subheadline: 'Uma presença profissional completa para Lash Designers. Agendamento online 24h, lembrete de manutenção recorrente e fidelização ativa de clientes.',
    problems: [
      {
        num: '01',
        text: 'Você passa horas respondendo dúvidas pós-procedimento e negociando horários no WhatsApp.'
      },
      {
        num: '02',
        text: 'Clientes que perdem o prazo ideal de manutenção dos cílios, afetando a durabilidade e o seu faturamento.'
      },
      {
        num: '03',
        text: 'Faltas de última hora (no-shows) em procedimentos longos que deixam buracos caros na sua grade do dia.'
      }
    ],
    benefits: [
      {
        title: 'Agendamento online 24h',
        desc: 'Sua cliente reserva o horário ideal pelo celular e você recebe a confirmação sem precisar interromper seus atendimentos.',
        icon: 'calendar'
      },
      {
        title: 'Retorno programado',
        desc: 'Configure notificações automáticas para lembrar suas clientes da hora certa de fazer a manutenção dos cílios.',
        icon: 'bell'
      },
      {
        title: 'Vitrine de cílios premium',
        desc: 'Destaque fotos das suas extensões e lash lift em uma galeria organizada e de alta resolução que atrai novas clientes.',
        icon: 'shop'
      },
      {
        title: 'Histórico de mapping',
        desc: 'Guarde anotações completas de curvatura, espessura, técnica e mapeamento de cílios (mapping) usado para cada cliente.',
        icon: 'chart'
      },
      {
        title: 'Filtro de inatividade',
        desc: 'Identifique clientes que estão há mais de 30 dias sem agendar e mande uma mensagem de reativação com apenas um clique.',
        icon: 'users'
      },
      {
        title: 'Incentivo à indicação',
        desc: 'Crie cupons de indicação e fidelidade para transformar suas clientes atuais no seu canal de marketing mais eficiente.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Lash designers, especialistas em extensão de cílios, lash lifting, estúdios de olhar e profissionais autônomas do segmento.'
  },
  'para-maquiadoras': {
    path: '/para-maquiadoras',
    niche: 'Maquiadora',
    title: 'Nera | Agenda online para Maquiadoras',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para maquiadoras de eventos, noivas, formandas e profissionais da beleza.',
    headline: 'Organize sua agenda de beleza para eventos e casamentos',
    subheadline: 'Deixe de perder tempo com agendamentos manuais. Ofereça um link de reservas premium para suas clientes de maquiagem social, noivas e eventos.',
    problems: [
      {
        num: '01',
        text: 'Sobrecarga insana de mensagens no WhatsApp em datas concorridas de casamentos, formaturas e feriados.'
      },
      {
        num: '02',
        text: 'Falta de controle profissional nos agendamentos de prévia de noivas e madrinhas, gerando confusões de horários.'
      },
      {
        num: '03',
        text: 'Clientes que faltam ou desmarcam em cima da hora, deixando você sem tempo para preencher uma vaga muito disputada.'
      }
    ],
    benefits: [
      {
        title: 'Agenda de eventos inteligente',
        desc: 'Configure disponibilidades específicas para finais de semana e feriados para receber agendamentos sem atritos.',
        icon: 'calendar'
      },
      {
        title: 'Confirmação e lembretes',
        desc: 'Envie confirmações e lembretes automáticos por WhatsApp ou e-mail para reduzir as ausências a praticamente zero.',
        icon: 'bell'
      },
      {
        title: 'Portfólio de maquiagem premium',
        desc: 'Mostre seu portfólio de noivas, maquiagens sociais e artísticas em uma vitrine virtual focada em conversão.',
        icon: 'shop'
      },
      {
        title: 'Controle de faturamento',
        desc: 'Monitore os pagamentos de sinal de reserva para garantir seu faturamento mesmo em casos de cancelamento.',
        icon: 'chart'
      },
      {
        title: 'Ficha de preferências',
        desc: 'Registre tipos de pele, alergias e tons de produtos preferidos de cada cliente para um atendimento personalizado e seguro.',
        icon: 'users'
      },
      {
        title: 'Cupons de pacotes',
        desc: 'Crie cupons especiais para noivas, madrinhas e grupos de formandas para atrair agendamentos múltiplos de uma só vez.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Maquiadoras profissionais, especialistas em maquiagem para noivas e madrinhas, estúdios de maquiagem social e maquiadoras autônomas.'
  },
  'para-podologas': {
    path: '/para-podologas',
    niche: 'Podóloga',
    title: 'Nera | Agenda online para Podólogas',
    description: 'Agenda online, prontuário, lembretes de retorno e gestão para podólogas e clínicas de podologia organizarem seus atendimentos clínicos.',
    headline: 'Gestão inteligente e agendamento prático para Podólogas',
    subheadline: 'Simplifique o controle de retornos de tratamento, organize o histórico clínico de cada paciente e ofereça agendamento online intuitivo.',
    problems: [
      {
        num: '01',
        text: 'Tratamentos clínicos interrompidos ou atrasados porque os pacientes se esquecem da data correta de retorno.'
      },
      {
        num: '02',
        text: 'Perda de tempo valioso ligando ou mandando lembretes de acompanhamento manualmente todos os dias.'
      },
      {
        num: '03',
        text: 'Histórico de tratamentos e anamnese guardados de forma desorganizada em fichas físicas difíceis de consultar.'
      }
    ],
    benefits: [
      {
        title: 'Agendamento clínico',
        desc: 'Permita que seus pacientes agendem de forma rápida os procedimentos de rotina, liberando seu tempo para os atendimentos.',
        icon: 'calendar'
      },
      {
        title: 'Retorno programado',
        desc: 'Lembretes automáticos avisam o paciente no prazo exato do tratamento de órteses ou profilaxia.',
        icon: 'bell'
      },
      {
        title: 'Vitrine de atendimento',
        desc: 'Apresente seus tratamentos, procedimentos clínicos, preços e depoimentos de forma séria e profissional.',
        icon: 'shop'
      },
      {
        title: 'Ficha clínica digital',
        desc: 'Acompanhe a evolução de cada tratamento com anotações fáceis sobre cada sessão e queixas principais.',
        icon: 'chart'
      },
      {
        title: 'Acompanhamento de saúde',
        desc: 'Mantenha um canal ativo com seus pacientes, garantindo um acompanhamento periódico preventivo.',
        icon: 'users'
      },
      {
        title: 'Fidelização contínua',
        desc: 'Desenvolva campanhas de cuidados contínuos para pés saudáveis, mantendo sua agenda sempre preenchida de forma previsível.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Podólogas clínicas, especialistas em pé diabético, tratamento de órteses, podopediatria, gerontopodologia e clínicas de podologia.'
  },
  'para-depiladoras': {
    path: '/para-depiladoras',
    niche: 'Depiladora',
    title: 'Nera | Agenda online para Depiladoras',
    description: 'Agenda online, vitrine digital, lembretes e gestão de clientes para depiladoras profissionais e estúdios de depilação.',
    headline: 'Mantenha sua agenda de depilação sempre cheia e previsível',
    subheadline: 'Automatize lembretes de retorno no prazo exato do crescimento dos pelos, reduza as faltas de última hora e profissionalize seu estúdio.',
    problems: [
      {
        num: '01',
        text: 'Clientes que agendam apenas em cima da hora, gerando picos excessivos no fim de semana e dias ociosos no início da semana.'
      },
      {
        num: '02',
        text: 'Perda do ciclo de depilação da cliente porque ela esquece de agendar após o intervalo recomendado de 20 a 30 dias.'
      },
      {
        num: '03',
        text: 'Faltas e desmarcações sem aviso prévio que impedem o encaixe de outras clientes aguardando vaga.'
      }
    ],
    benefits: [
      {
        title: 'Agendamento autônomo',
        desc: 'Sua agenda aberta online para as clientes reservarem seus próprios horários no momento que desejarem.',
        icon: 'calendar'
      },
      {
        title: 'Lembrete do ciclo de pelos',
        desc: 'Envie avisos amigáveis e automáticos no WhatsApp no período exato em que a cliente precisa voltar para a próxima sessão.',
        icon: 'bell'
      },
      {
        title: 'Vitrine e menus claros',
        desc: 'Exponha seus serviços por áreas corporais de forma transparente, permitindo que a cliente escolha exatamente o que precisa.',
        icon: 'shop'
      },
      {
        title: 'Registro de métodos e ceras',
        desc: 'Anote ceras favoritas (ceras frias, quentes, ceras de mel), sensibilidades e áreas de cada cliente para atendimentos seguros.',
        icon: 'chart'
      },
      {
        title: 'Reativação rápida',
        desc: 'Monitore clientes inativas do mês e convide-as de forma direta para manter o ciclo de depilação em dia.',
        icon: 'users'
      },
      {
        title: 'Pacotes promocionais',
        desc: 'Crie cupons especiais para combos de áreas corporais e estimule suas clientes a realizarem mais serviços em uma mesma sessão.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Depiladoras profissionais, especialistas em depilação com cera, depilação egípcia (linha), fotodepilação e clínicas de depilação corporativa.'
  },
  'para-massagistas': {
    path: '/para-massagistas',
    niche: 'Massagista',
    title: 'Nera | Agenda online para Massagistas',
    description: 'Agenda online, controle de pacotes corporais, lembretes e gestão para massoterapeutas, massagistas e terapeutas corporais.',
    headline: 'Mais tranquilidade na sua gestão de massoterapia',
    subheadline: 'Ofereça uma experiência relaxante desde o agendamento. Automatize reservas, controle pacotes corporais e elimine as faltas com a Nera.',
    problems: [
      {
        num: '01',
        text: 'Interrupções constantes durante massagens e terapias relaxantes para atender chamadas ou responder WhatsApp de agendamento.'
      },
      {
        num: '02',
        text: 'Controle de sessões restantes de pacotes em planilhas manuais ou anotações em papel que frequentemente se perdem.'
      },
      {
        num: '03',
        text: 'No-shows ou cancelamentos repentinos de sessões longas que desestruturam financeiramente a sua semana.'
      }
    ],
    benefits: [
      {
        title: 'Reserva 100% autônoma',
        desc: 'Suas clientes reservam as massagens diretamente pelo link, sem interromper seus momentos de terapia e concentração.',
        icon: 'calendar'
      },
      {
        title: 'Confirmação e lembretes',
        desc: 'Envie notificações corteses e automatizadas de confirmação para evitar esquecimentos e garantir a presença.',
        icon: 'bell'
      },
      {
        title: 'Vitrine de terapias',
        desc: 'Apresente suas modalidades de massagem (relaxante, modeladora, drenagem lymphatic) com preços e detalhes elegantes.',
        icon: 'shop'
      },
      {
        title: 'Controle de pacotes corporais',
        desc: 'Registre e debite sessões de pacotes com facilidade, dando total clareza do saldo de sessões para você e sua cliente.',
        icon: 'chart'
      },
      {
        title: 'Ficha de anamnese',
        desc: 'Anote dores recorrentes, restrições médicas, alergias a óleos e preferências de intensidade de massagem de cada cliente.',
        icon: 'users'
      },
      {
        title: 'Cupons de menor movimento',
        desc: 'Atraia agendamentos em horários ociosos com cupons de desconto estratégicos, estabilizando seu faturamento.',
        icon: 'gift'
      }
    ],
    forWhoDesc: 'Massoterapeutas, massagistas profissionais, terapeutas corporais, especialistas em drenagem linfática, quiropraxia e estúdios de relaxamento.'
  }
};
