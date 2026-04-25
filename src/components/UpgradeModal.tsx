import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import PremiumButton from './PremiumButton';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  count: number;
}

export default function UpgradeModal({ open, onClose, count }: UpgradeModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-ink/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-brand-white rounded-[40px] p-8 shadow-2xl border border-brand-mist relative overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/5 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-brand-linen rounded-full transition-colors text-brand-stone"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mb-6">
                <TrendingUp size={32} />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-2">Sucesso à vista</span>
              <h2 className="text-2xl font-serif text-brand-ink mb-4 italic">Seu negócio está crescendo 💛</h2>
              
              <p className="text-sm text-brand-stone font-light leading-relaxed mb-8">
                Você já recebeu <span className="font-bold text-brand-ink">{count} agendamentos</span> este mês! 
                Sua vitrine está atraindo clientes e é hora de elevar o nível.
              </p>

              <div className="w-full space-y-4 mb-8">
                <div className="flex items-start gap-4 text-left p-4 bg-brand-parchment/50 rounded-2xl border border-brand-mist/50">
                  <div className="mt-1 text-brand-terracotta">
                    <Zap size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-1">Agendamentos Ilimitados</p>
                    <p className="text-[10px] text-brand-stone leading-relaxed uppercase tracking-tight">Esqueça os limites e foque no seu faturamento.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 text-left p-4 bg-brand-parchment/50 rounded-2xl border border-brand-mist/50">
                  <div className="mt-1 text-brand-terracotta">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-1">Destaque na Vitrine</p>
                    <p className="text-[10px] text-brand-stone leading-relaxed uppercase tracking-tight">Sua página priorizada nas buscas do Nera.</p>
                  </div>
                </div>
              </div>

              <Link to="/planos" className="w-full">
                <PremiumButton className="w-full py-5 text-[11px]">
                  Desbloquear Ilimitado
                </PremiumButton>
              </Link>

              <button 
                onClick={onClose}
                className="mt-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
              >
                Continuar usando (por enquanto)
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
