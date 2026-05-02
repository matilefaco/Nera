import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function CheckoutSuccessPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    if (profile?.plan && profile.plan !== 'free') {
      setSyncing(false);
    }
  }, [profile]);

  useEffect(() => {
    // Timeout after 30 seconds if syncing still true
    const timeout = setTimeout(() => {
      setSyncing(false);
    }, 30000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-[0_32px_64px_rgba(0,0,0,0.05)] border border-brand-stone/10 text-center"
      >
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>

        <h1 className="text-3xl font-serif text-brand-ink mb-4">Assinatura ativada!</h1>
        
        <p className="text-brand-stone text-sm font-light leading-relaxed mb-10">
          Parabéns! Sua conta foi atualizada com sucesso. 
          {syncing ? (
            <span className="block mt-2 font-medium text-brand-terracotta flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Sincronizando seu plano...
            </span>
          ) : (
            <span className="block mt-2 font-medium text-emerald-600">
              <Sparkles size={14} className="inline mr-1" />
              Tudo pronto!
            </span>
          )}
        </p>

        <div className="space-y-4">
          <Link 
            to="/dashboard"
            className="w-full h-14 flex items-center justify-center bg-brand-ink text-brand-white rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-ink/90 transition-all group"
          >
            Ir para meu painel
            <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="mt-10 pt-8 border-top border-brand-stone/5">
          <p className="text-[10px] text-brand-stone/50 font-bold uppercase tracking-widest">
            Nera &reg; 2026 • Premium Experience
          </p>
        </div>
      </motion.div>
    </div>
  );
}
