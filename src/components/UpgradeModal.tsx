import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Zap, Sparkles, Heart, Target, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: 'unlimitedBookings' | 'whatsappNotifications' | 'advancedDashboard' | 'waitlist' | 'antiNoShow' | 'coupons' | 'analytics' | 'reports';
  count?: number;
  totalClients?: number;
  averageTicket?: number;
}

const variantA = { // Emotional
  title: "Você está crescendo 🚀",
  subtitle: "Sucesso à vista",
  tagline: "O mundo precisa do seu talento.",
  featureTitle: "O Nera cresce com você",
  featureDesc: "Não deixe que limites técnicos freiem a sua paixão e o seu brilho.",
  cta: "Liberar agenda ilimitada"
};

const variantB = { // Rational
  title: "Aumente seu faturamento 📈",
  subtitle: "Otimização de lucro",
  tagline: "Dados não mentem.",
  featureTitle: "Decisões baseadas em números",
  featureDesc: "Recupere o valor investido na primeira semana com economia de tempo e zero faltas.",
  cta: "Maximizar meus ganhos"
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
          title: "Lista de Espera Inteligente",
          desc: "Nunca mais perca uma cliente por falta de horário. Ative a fila automática.",
          limit: "Recupere até 4h/semana de ociosidade"
        };
      case 'coupons':
        return {
          title: "Incentivos e Cupons",
          desc: "Crie campanhas de desconto para fidelizar suas clientes VIP.",
          limit: "Aumente sua taxa de retorno em até 30%"
        };
      case 'analytics':
        return {
          title: "Inteligência de Dados",
          desc: "Saiba exatamente quem são suas clientes VIP e quem está em risco.",
          limit: "Decisões precisas, lucro garantido"
        };
      case 'reports':
        return {
          title: "Relatórios Profissionais",
          desc: "Gere documentos em PDF com sua performance mensal e top serviços.",
          limit: "Sua gestão elevada ao nível Pro"
        };
      case 'unlimitedBookings':
      default:
        return {
          title: "Agenda Ilimitada",
          desc: "Não deixe que limites técnicos freiem o seu crescimento profissional.",
          limit: "Você está perdendo clientes por limite de agenda"
        };
    }
  }, [feature]);

  const potentialRevenue = (25 - 15) * averageTicket; // Calculation based on getting 10 more clients if unlimited

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-ink/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="w-full max-w-lg bg-brand-white rounded-[48px] p-0 shadow-2xl border border-brand-mist relative overflow-hidden"
          >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-linen rounded-full blur-3xl -ml-32 -mb-32" />
            
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 p-3 hover:bg-brand-linen rounded-full transition-colors text-brand-stone z-10"
            >
              <X size={20} />
            </button>

            <div className="relative z-10">
              <div className="p-10 pb-0 flex flex-col items-center text-center">
                <motion.div 
                  initial={{ rotate: -10, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-20 h-20 bg-brand-linen rounded-3xl flex items-center justify-center text-brand-terracotta mb-8 shadow-inner"
                >
                  {isEmotional ? <Heart size={40} /> : <TrendingUp size={40} />}
                </motion.div>

                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta mb-3">
                  {feature === 'unlimitedBookings' ? variant.subtitle : upgradeContent.title}
                </span>
                <h2 className="text-3xl font-serif text-brand-ink mb-6 italic leading-tight">
                  {variant.title}
                </h2>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                  <div className="bg-brand-parchment/40 rounded-3xl p-6 border border-brand-mist/50">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-2">Já atendeu</p>
                    <p className="text-2xl font-serif text-brand-ink italic">{totalClients || count || 20}+ únicas</p>
                    <p className="text-[9px] text-brand-stone mt-1 font-medium italic">CLIENTES CONVENCIDAS</p>
                  </div>
                  <div className="bg-brand-parchment/40 rounded-3xl p-6 border border-brand-mist/50">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone mb-2">Potencial Extra</p>
                    <p className="text-2xl font-serif text-brand-terracotta italic">+{formatCurrency(potentialRevenue)}</p>
                    <p className="text-[9px] text-brand-stone mt-1 font-medium italic">MARGEM DE CRESCIMENTO</p>
                  </div>
                </div>

                <div className="w-full bg-brand-ink text-white rounded-3xl p-6 mb-8 text-left relative overflow-hidden group">
                  <div className="absolute right-[-20px] top-[-20px] opacity-10 group-hover:rotate-12 transition-transform duration-500">
                    <Sparkles size={120} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-6 h-6 bg-brand-terracotta rounded-full flex items-center justify-center">
                      {feature === 'unlimitedBookings' ? <Target size={12} /> : <Zap size={12} />}
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">
                      {feature === 'unlimitedBookings' ? 'Alerta de Ganho' : 'Recurso Premium'}
                    </p>
                  </div>
                  <p className="text-lg font-serif italic mb-2 leading-tight">
                    "{upgradeContent.limit}"
                  </p>
                  <p className="text-[10px] text-white/60 font-light leading-relaxed uppercase tracking-tight">
                    {upgradeContent.desc}
                  </p>
                </div>
              </div>

              <div className="p-10 pt-0">
                <Link to="/planos" className="w-full" onClick={onClose}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-6 bg-brand-terracotta text-white rounded-full text-[12px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-brand-terracotta/20"
                  >
                    {variant.cta} <ArrowRight size={16} />
                  </motion.div>
                </Link>

                <div className="mt-8 flex items-center justify-center gap-6">
                  <button 
                    onClick={onClose}
                    className="text-[9px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                  >
                    Decidir depois
                  </button>
                  <div className="h-1 w-1 rounded-full bg-brand-mist" />
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
