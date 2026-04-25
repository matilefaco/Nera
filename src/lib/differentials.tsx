import React from 'react';
import { 
  Clock, ShieldCheck, UserCheck, Star, Sparkles, 
  Settings, Award, Heart, Leaf, Zap, 
  Crown, Home, Coffee, MapPin, Accessibility 
} from 'lucide-react';

export interface DifferentialDisplay {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function getDifferentialDisplay(differential: string): DifferentialDisplay {
  const diff = differential.toLowerCase().trim();

  // Mapping
  if (diff.includes('pontualidade')) {
    return {
      icon: <Clock size={20} />,
      title: 'Pontualidade',
      description: 'Horários organizados para evitar atrasos e esperas longas.'
    };
  }

  if (diff.includes('biossegurança') || diff.includes('bio-segurança')) {
    return {
      icon: <ShieldCheck size={20} />,
      title: 'Biossegurança',
      description: 'Materiais higienizados e cuidado em cada etapa do atendimento.'
    };
  }

  if (diff.includes('atendimento personalizado') || diff.includes('personalizado')) {
    return {
      icon: <UserCheck size={20} />,
      title: 'Atendimento Personalizado',
      description: 'Cada serviço é pensado de acordo com sua necessidade.'
    };
  }

  if (diff.includes('experiência') || diff.includes('comprovada')) {
    return {
      icon: <Award size={20} />,
      title: 'Experiência Comprovada',
      description: 'Anos de prática e atualizações constantes na área.'
    };
  }

  if (diff.includes('qualidade')) {
    return {
      icon: <Star size={20} />,
      title: 'Máxima Qualidade',
      description: 'Compromisso com o melhor resultado em cada detalhe.'
    };
  }

  if (diff.includes('conforto') || diff.includes('confortável')) {
    return {
      icon: <Coffee size={20} />,
      title: 'Ambiente Confortável',
      description: 'Espaço preparado para você se sentir bem e relaxada.'
    };
  }

  if (diff.includes('cuidado') || diff.includes('acolhedor')) {
    return {
      icon: <Heart size={20} />,
      title: 'Cuidado e Acolhimento',
      description: 'Atendimento humano que prioriza o seu bem-estar.'
    };
  }

  if (diff.includes('naturalidade') || diff.includes('natural')) {
    return {
      icon: <Leaf size={20} />,
      title: 'Naturalidade',
      description: 'Resultados que realçam sua beleza sem perder a essência.'
    };
  }

  if (diff.includes('durabilidade') || diff.includes('duradouro')) {
    return {
      icon: <Zap size={20} />,
      title: 'Alta Durabilidade',
      description: 'Técnicas que garantem que seu resultado dure mais tempo.'
    };
  }

  if (diff.includes('técnica avançada') || diff.includes('especializado')) {
    return {
      icon: <Settings size={20} />,
      title: 'Técnica Avançada',
      description: 'Uso das metodologias mais modernas do mercado.'
    };
  }

  if (diff.includes('produtos premium') || diff.includes('marcas')) {
    return {
      icon: <Crown size={20} />,
      title: 'Produtos Premium',
      description: 'Utilização exclusiva das melhores marcas e ativos.'
    };
  }

  if (diff.includes('atendimento exclusivo')) {
    return {
      icon: <Sparkles size={20} />,
      title: 'Atendimento Exclusivo',
      description: 'Foco total em você durante todo o seu horário reservado.'
    };
  }

  if (diff.includes('climatizado')) {
    return {
      icon: <Home size={20} />,
      title: 'Ambiente Climatizado',
      description: 'Temperatura ideal para o seu máximo conforto térmico.'
    };
  }

  if (diff.includes('estacionamento')) {
    return {
      icon: <MapPin size={20} />,
      title: 'Estacionamento Próprio',
      description: 'Facilidade e segurança para seu veículo durante a sessão.'
    };
  }

  if (diff.includes('acessibilidade') || diff.includes('acessível')) {
    return {
      icon: <Accessibility size={20} />,
      title: 'Acessibilidade',
      description: 'Espaço preparado para receber a todos com facilidade.'
    };
  }

  // Fallback
  return {
    icon: <Sparkles size={20} />,
    title: differential,
    description: 'Um cuidado a mais para tornar sua experiência melhor.'
  };
}
