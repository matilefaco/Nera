import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, Circle, ChevronDown, ChevronUp, 
  Camera, FileText, Settings, Calendar, Share2, Star, Sparkles, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { UserProfile, Appointment, Service } from '../types';
import { cn } from '../lib/utils';

interface Step {
  id: string;
  label: string;
  description: string;
  icon: any;
  isComplete: boolean;
  link?: string;
  action?: () => void;
}

interface ActivationChecklistProps {
  profile: UserProfile | null;
  appointments: Appointment[];
  services: Service[];
  onShareClick: () => void;
}

export const ActivationChecklist = ({ 
  profile, 
  appointments, 
  services,
  onShareClick
}: ActivationChecklistProps) => {
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('nera_checklist_minimized') === 'true';
  });
  const [isFullyComplete, setIsFullyComplete] = useState(false);
  const [shouldDestroy, setShouldDestroy] = useState(false);
  const [hasShared, setHasShared] = useState(() => {
    return localStorage.getItem('nera_link_shared') === 'true';
  });

  // Profile completeness logic from ProfilePage.tsx
  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      !!profile.avatar,
      !!profile.bio,
      !!profile.headline,
      !!profile.instagram,
      (profile.portfolio?.length || 0) >= 3,
      (profile.professionalIdentity?.differentials?.length || 0) >= 2,
      !!profile.professionalIdentity?.yearsExperience,
      !!profile.studioAddress?.street || (profile.serviceAreas?.length || 0) > 0,
    ];
    const pts = [15,15,10,10,20,10,10,10];
    let total = 0;
    fields.forEach((f, i) => { if (f) total += pts[i]; });
    return total;
  }, [profile]);

  const steps: Step[] = [
    {
      id: 'avatar',
      label: 'Adicionar foto de perfil',
      description: 'Perfis com foto recebem 3x mais cliques.',
      icon: Camera,
      isComplete: !!profile?.avatar,
      link: '/perfil'
    },
    {
      id: 'bio',
      label: 'Escrever sua bio',
      description: 'Conte quem você é e sua especialidade.',
      icon: FileText,
      isComplete: !!profile?.bio,
      link: '/perfil#bio'
    },
    {
      id: 'service',
      label: 'Cadastre seu primeiro serviço',
      description: 'Suas clientes precisam saber o que você faz.',
      icon: Settings,
      isComplete: services.length > 0,
      link: '/servicos'
    },
    {
      id: 'schedule',
      label: 'Defina seus horários',
      description: 'Escolha os dias e horas que você atende.',
      icon: Calendar,
      isComplete: (profile?.workingDays?.length ?? 0) > 0,
      link: '/perfil#horarios'
    },
    {
      id: 'share',
      label: 'Seu link personalizado',
      description: 'Divulgue sua vitrine para suas clientes.',
      icon: Share2,
      isComplete: hasShared,
      action: () => {
        onShareClick();
        setHasShared(true);
        localStorage.setItem('nera_link_shared', 'true');
      }
    },
    {
      id: 'first_booking',
      label: 'Receber sua primeira reserva',
      description: 'O momento mais esperado!',
      icon: Star,
      isComplete: appointments.length > 0
    }
  ];

  const completedSteps = steps.filter(s => s.isComplete).length;
  const checklistProgress = (completedSteps / steps.length) * 100;

  useEffect(() => {
    if (completedSteps === steps.length && !isFullyComplete) {
      setIsFullyComplete(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#A85C3A', '#C47A5A', '#E2D1C3']
      });
      
      const timer = setTimeout(() => {
        setShouldDestroy(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [completedSteps, steps.length, isFullyComplete]);

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('nera_checklist_minimized', String(newState));
  };

  if (profileCompleteness === 100 && !isFullyComplete) return null;
  if (shouldDestroy) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-brand-parchment rounded-[32px] border border-brand-mist shadow-sm overflow-hidden"
    >
      {/* Progress Bar Top */}
      <div className="h-1.5 w-full bg-brand-linen">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${checklistProgress}%` }}
          className="h-full bg-brand-terracotta"
        />
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-terracotta/10 text-brand-terracotta rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone">
                Checklist de Ativação
              </h3>
              <p className="text-sm font-serif text-brand-ink">
                {isFullyComplete 
                  ? "Sua vitrine está pronta! Compartilhe agora." 
                  : checklistProgress < 60 
                    ? "Sua vitrine ainda não está pronta" 
                    : "Quase lá! Finalize seu perfil"}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleMinimize}
            className="p-2 text-brand-stone hover:bg-brand-linen rounded-full transition-colors"
          >
            {isMinimized ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {steps.map((step) => (
                  <div 
                    key={step.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition-all",
                      step.isComplete 
                        ? "bg-white/50 border-brand-mist/20" 
                        : "bg-white border-brand-mist"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl shrink-0 transition-colors",
                      step.isComplete ? "bg-green-50 text-green-600" : "bg-brand-linen text-brand-stone"
                    )}>
                      <step.icon size={18} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {step.link ? (
                        <Link 
                          to={step.link}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest block transition-all",
                            step.isComplete ? "text-brand-stone line-through" : "text-brand-ink hover:text-brand-terracotta"
                          )}
                        >
                          {step.label}
                        </Link>
                      ) : step.action ? (
                        <button 
                          onClick={step.action}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-widest text-left block w-full transition-all",
                            step.isComplete ? "text-brand-stone line-through" : "text-brand-ink hover:text-brand-terracotta"
                          )}
                        >
                          {step.label}
                        </button>
                      ) : (
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest block",
                          step.isComplete ? "text-brand-stone line-through" : "text-brand-ink"
                        )}>
                          {step.label}
                        </span>
                      )}
                      <p className="text-[10px] text-brand-stone font-light italic truncate">
                        {step.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {step.isComplete ? (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-green-600"
                        >
                          <CheckCircle2 size={18} />
                        </motion.div>
                      ) : (
                        <Circle size={18} className="text-brand-mist" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
