import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { notify } from '../lib/notify';

export default function CheckoutSuccessPage() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [syncing, setSyncing] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (profile?.plan && profile.plan !== 'free') {
      setSyncing(false);
      setTimedOut(false);
      setError(null);
    }
  }, [profile]);

  useEffect(() => {
    const confirmCheckout = async () => {
      if (!sessionId || !user || !syncing) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/plans/confirm-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sessionId })
        });

        const data = await response.json();
        if (data.success) {
          refreshProfile();
        } else {
           console.warn("Confirm checkout API failed:", data.error);
           // We don't necessarily stop everything here, we let polling continue
           // but if we want to show a specific error if it's a hard failure:
           if (response.status === 403 || response.status === 404) {
             setError(data.error);
             setSyncing(false);
           }
        }
      } catch (err) {
        console.error("Error confirming checkout:", err);
      }
    };

    if (sessionId && user && syncing) {
      confirmCheckout();
    }
  }, [sessionId, user, refreshProfile, syncing]);

  useEffect(() => {
    if (!syncing || error) return;

    // Poll refreshProfile every 3 seconds
    const interval = setInterval(() => {
      refreshProfile();
    }, 3000);

    // Timeout after 15 seconds if syncing still true
    const timeout = setTimeout(() => {
      setTimedOut(true);
      setSyncing(false);
      clearInterval(interval);
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [syncing, refreshProfile, error]);

  const destination = profile?.onboardingCompleted ? '/dashboard' : '/onboarding';

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-[0_32px_64px_rgba(0,0,0,0.05)] border border-brand-stone/10 text-center"
      >
        <div className="w-20 h-20 bg-[#FAF9F8] border border-brand-mist/40 shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-8">
          {syncing ? (
            <Loader2 size={32} strokeWidth={1.5} className="text-brand-ink animate-spin" />
          ) : error ? (
            <AlertCircle size={32} strokeWidth={1.5} className="text-brand-terracotta" />
          ) : timedOut ? (
            <Sparkles size={32} strokeWidth={1.5} className="text-brand-terracotta" />
          ) : (
            <CheckCircle2 size={32} strokeWidth={1.5} className="text-emerald-500" />
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-serif text-brand-ink mb-3 italic">
          {syncing ? 'Preparando seu acesso' : error ? 'Aviso de sincronização' : timedOut ? 'Ativação em andamento' : 'Assinatura ativada'}
        </h1>
        
        <div className="text-[11px] uppercase tracking-widest text-brand-stone font-light leading-relaxed mb-10 max-w-sm mx-auto">
          {syncing ? (
            <p>A Nera está finalizando a ativação da sua assinatura. Isso levará apenas alguns instantes.</p>
          ) : error ? (
            <div className="space-y-4 normal-case tracking-normal">
              <div className="p-5 bg-brand-linen/40 rounded-2xl text-xs space-y-2 border border-brand-mist/30">
                <p>Não conseguimos confirmar agora. Tente novamente em instantes.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setError(null);
                    setSyncing(true);
                    setTimedOut(false);
                  }}
                  className="w-full h-12 flex items-center justify-center rounded-2xl bg-brand-ink text-brand-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-espresso transition-all shadow-md focus:ring-4 ring-brand-ink/10"
                >
                  Tentar novamente
                </button>
                <a 
                  href="mailto:suporte@nera.app" 
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                >
                  Falar com suporte
                </a>
              </div>
            </div>
          ) : timedOut ? (
            <div className="space-y-4 normal-case tracking-normal">
              <div className="p-5 bg-brand-linen/40 rounded-2xl text-[13px] space-y-2 border border-brand-mist/30 text-brand-stone leading-relaxed">
                <p>Isso está demorando um pouco mais do que o esperado, mas sua ativação continua em andamento.</p>
                <p className="font-medium text-brand-ink">A Nera já registrou sua solicitação e o acesso será liberado em instantes.</p>
              </div>
              <p className="text-[11px] text-brand-stone/80 italic">Você já pode seguir para o seu painel.</p>
            </div>
          ) : (
            <p>
              Parabéns! Sua assinatura foi ativada com sucesso. 
              <span className="block mt-2 font-medium text-emerald-600">
                Tudo pronto para começar.
              </span>
            </p>
          )}
        </div>

        {(!error) && (
          <div className="space-y-4">
            <Link 
              to={destination}
              className={cn(
                "w-full h-14 flex items-center justify-center rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all group focus:ring-4",
                (syncing && !error) 
                  ? "bg-[#FAF9F8] text-brand-stone/50 border border-brand-mist/40 shadow-sm cursor-wait" 
                  : "bg-brand-ink text-brand-white shadow-md ring-brand-ink/10 hover:bg-brand-espresso"
              )}
              onClick={(e) => (syncing && !error) && e.preventDefault()}
            >
              {syncing ? 'Aguarde um momento...' : profile?.onboardingCompleted ? 'Ir para meu painel' : 'Começar Onboarding'}
              {(!syncing || error) && <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />}
            </Link>
          </div>
        )}

        <div className="mt-10 pt-8 border-t border-brand-mist/30">
          <p className="text-[10px] text-brand-stone/50 font-bold uppercase tracking-widest">
            Nera &reg; 2026 • Premium Experience
          </p>
        </div>
      </motion.div>
    </div>
  );
}
