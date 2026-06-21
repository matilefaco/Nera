import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Zap, Sparkles, Heart, Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { UpgradeFeature } from '../hooks/useUpgradeTriggers';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: UpgradeFeature | 'theme';
  count?: number;
  totalClients?: number;
  averageTicket?: number;
}

const variantA = {
  title: "Evolua sua gestão",
  subtitle: "CRESCIMENTO",
  tagline: "Dê o próximo passo.",
  featureTitle: "Cresça com consistência",
  featureDesc: "Acesse ferramentas essenciais para organizar sua agenda.",
  cta: "Ver planos disponíveis"
};

const variantB = {
  title: "Profissionalize sua rotina",
  subtitle: "GESTÃO INTELIGENTE",
  tagline: "Eleve o nível do seu atendimento.",
  featureTitle: "Decisões baseadas em dados",
  featureDesc: "Recursos completos para automatizar seu dia a dia.",
  cta: "Ver planos disponíveis"
};

export default function UpgradeModal({ 
  open, 
  onClose, 
  feature = 'unlimitedBookings', 
  count = 0,
  totalClients = 0,
  averageTicket = 200
}: UpgradeModalProps) {
  
  // A/B Test Logic (Simplified based on a persistent or random factor)
  const isEmotional = useMemo(() => {
    // We can use a simple flip or based on UUID character
    return Math.random() > 0.5;
  }, [open]);

  const variant = isEmotional ? variantA : variantB;

  const upgradeContent = useMemo(() => {
    switch (feature) {
      case 'waitlist':
        return {
          title: "Preencha horários vagos automaticamente",
          desc: "Clientes entram em uma fila inteligente e recebem aviso quando surgir uma vaga. Transforme cancelamentos em faturamento.",
          limit: "Disponível exclusivamente no Plano PRO."
        };
      case 'coupons':
        return {
          title: "Incentivos e Cupons",
          desc: "Crie campanhas de desconto para fidelizar suas clientes.",
          limit: "Aumente as taxas de retorno"
        };
      case 'referrals':
        return {
          title: "Indicação Premiada",
          desc: "Compartilhe a Nera com outras profissionais e acumule créditos.",
          limit: "Cresça junto com a Nera"
        };
      case 'crm':
        return {
          title: "Inteligência de Clientes",
          desc: "Entenda exatamente quem pode voltar, quem esfriou e onde existe oportunidade de retorno.",
          limit: "CRM Inteligente"
        };
      case 'exportCsv':
        return {
          title: "Exporte sua base de clientes",
          desc: "Organize sua base em planilha para acompanhar retornos, campanhas e histórico com mais controle.",
          limit: "Exportação Avançada"
        };
      case 'analytics':
        return {
          title: "Inteligência de Dados",
          desc: "Saiba exatamente quem são suas clientes VIP e o desempenho do seu negócio.",
          limit: "Decisões precisas"
        };
      case 'reports':
        return {
          title: "Relatórios Profissionais",
          desc: "Gere documentos em PDF com sua performance e serviços.",
          limit: "Sua gestão com mais clareza"
        };
      case 'antiNoShow':
        return {
          title: "Lembretes e Confirmações",
          desc: "Envie e-mails automáticos para suas clientes confirmarem presença.",
          limit: "Experiência Profissional"
        };
      case 'whatsappNotifications':
        return {
          title: "Notificações WhatsApp",
          desc: "Envie confirmações e lembretes automáticos diretamente pelo WhatsApp com integração oficial.",
          limit: "Experiência Premium no WhatsApp"
        };
      case 'theme':
        return {
          title: "Personalize sua vitrine",
          desc: "Escolha temas com cores e atmosfera diferentes para apresentar seu trabalho com mais intenção.",
          limit: "Mais presença para sua marca"
        };
      case 'unlimitedBookings':
      default:
        return {
          title: "Agenda Ilimitada",
          desc: "Remova as restrições e aceite quantos agendamentos precisar.",
          limit: "Aceite mais agendamentos"
        };
    }
  }, [feature]);

  const displayTitle = feature === 'theme' ? upgradeContent.title : variant.title;
  const displaySubtitle = feature === 'theme' ? "Identidade visual" : (feature === 'referrals' ? 'Expansão' : (feature === 'unlimitedBookings' ? variant.subtitle : (upgradeContent.title || 'RECURSO EXCLUSIVO')));
  const displayBoxTitle = feature === 'theme' ? "Desbloqueie temas visuais" : "Recursos para crescer com mais controle";
  const displayBoxDesc = feature === 'theme' ? "Deixe sua página mais alinhada ao estilo do seu atendimento." : "Campanhas, relatórios e automações para profissionalizar sua rotina.";

  return (
    <AnimatePresence>
      {open && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-0 bg-brand-ink/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-[calc(100vw-24px)] md:w-full max-w-lg bg-brand-white rounded-[32px] md:rounded-[48px] shadow-2xl border border-brand-mist relative overflow-hidden flex flex-col max-h-[calc(100dvh-24px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-linen rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
            
            {/* Sticky Close Button */}
            <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
              <button 
                onClick={onClose}
                className="p-3 bg-brand-white/80 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none hover:bg-brand-linen rounded-full transition-colors text-brand-stone shadow-sm md:shadow-none"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pt-2 no-scrollbar">
              <div className="p-5 md:p-10 pb-0 flex flex-col items-center text-center mt-4 md:mt-0">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-16 h-16 md:w-20 md:h-20 bg-brand-linen rounded-2xl md:rounded-3xl flex items-center justify-center text-brand-terracotta mb-6 md:mb-8 shadow-inner shrink-0"
                >
                  {isEmotional ? <Heart size={32} /> : <TrendingUp size={32} />}
                </motion.div>

                <span className="text-[10px] font-bold uppercase tracking-[0.3em] md:tracking-[0.4em] text-brand-terracotta mb-3">
                  {displaySubtitle}
                </span>
                <h2 className="text-2xl md:text-3xl font-serif text-brand-ink mb-6 italic leading-tight">
                  {displayTitle}
                </h2>
                
                <div className="flex flex-col items-center justify-center bg-brand-parchment/40 rounded-3xl p-5 md:p-6 border border-brand-mist/50 mb-6 md:mb-8 w-full">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-2">
                    {displayBoxTitle}
                  </h3>
                  <p className="text-[11px] text-brand-stone font-light text-center max-w-[250px] leading-relaxed">
                    {displayBoxDesc}
                  </p>
                </div>

                <div className="w-full bg-brand-ink text-white rounded-[24px] md:rounded-3xl p-5 md:p-6 mb-6 md:mb-8 text-left relative overflow-hidden group">
                  <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:rotate-12 transition-transform duration-500">
                    <Sparkles size={100} className="md:w-[120px] md:h-[120px]" />
                  </div>
                  <div className="flex items-center gap-3 mb-3 relative z-10">
                    <div className="w-6 h-6 bg-brand-terracotta rounded-full flex items-center justify-center">
                      {feature === 'unlimitedBookings' ? <Target size={12} /> : <Zap size={12} />}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      {feature === 'theme' ? 'Identidade' : (feature === 'unlimitedBookings' ? 'Alerta de Limite' : 'Recurso Exclusivo')}
                    </p>
                  </div>
                  <p className="text-base md:text-lg font-serif italic mb-2 leading-tight relative z-10">
                    "{upgradeContent.limit}"
                  </p>
                  <p className="text-[10px] md:text-[11px] text-white/60 font-light leading-relaxed uppercase tracking-tight relative z-10">
                    {upgradeContent.desc}
                  </p>
                </div>
              </div>

              <div className="p-5 md:p-10 pt-0">
                <Link to="/planos" className="w-full block" onClick={onClose}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 md:py-6 bg-brand-terracotta text-white rounded-full text-[11px] md:text-[12px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-brand-terracotta/20 min-h-[44px]"
                  >
                    Ver planos disponíveis <ArrowRight size={16} />
                  </motion.div>
                </Link>

                <div className="mt-6 md:mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pb-2">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="text-[9px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors min-h-[44px] flex items-center"
                  >
                    Decidir depois
                  </button>
                  <div className="h-1 w-1 rounded-full bg-brand-mist shrink-0" />
                  <p className="text-[9px] text-brand-stone italic">{variant.tagline}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
