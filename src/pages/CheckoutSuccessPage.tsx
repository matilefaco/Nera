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
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8">
          {syncing ? (
            <Loader2 size={40} className="text-brand-terracotta animate-spin" />
          ) : error ? (
            <AlertCircle size={40} className="text-brand-terracotta" />
          ) : timedOut ? (
            <Sparkles size={40} className="text-brand-terracotta" />
          ) : (
            <CheckCircle2 size={40} className="text-emerald-500" />
          )}
        </div>

        <h1 className="text-3xl font-serif text-brand-ink mb-4">
          {syncing ? 'Verificando assinatura...' : error ? 'Algo deu errado' : timedOut ? 'Ativação em curso' : 'Assinatura ativada!'}
        </h1>
        
        <div className="text-brand-stone text-sm font-light leading-relaxed mb-10">
          {syncing ? (
            <p>Estamos confirmando seu teste de 15 dias com o Stripe. Isso levará apenas alguns instantes.</p>
          ) : error ? (
            <div className="space-y-3">
              <div className="p-4 bg-brand-linen/60 rounded-[20px] text-xs space-y-2 border border-brand-mist/30">
                <p>Recebemos sua tentativa de ativação, mas não conseguimos confirmar agora.</p>
                <p className="font-semibold text-brand-ink">{error}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setError(null);
                    setSyncing(true);
                    setTimedOut(false);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:text-brand-sienna"
                >
                  Tentar confirmar novamente
                </button>
                <a 
                  href="mailto:suporte@nera.app" 
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-mist hover:text-brand-stone"
                >
                  Falar com suporte
                </a>
              </div>
            </div>
          ) : timedOut ? (
            <div className="space-y-3">
              <div className="p-4 bg-brand-linen/60 rounded-[20px] text-xs space-y-2 border border-brand-mist/30">
                <p>O processamento está demorando um pouco mais que o esperado.</p>
                <p className="font-semibold text-brand-ink">Estamos finalizando sua ativação. Seu acesso será liberado automaticamente em instantes.</p>
              </div>
              <p className="text-[11px] text-brand-stone/60 italic">Você já pode seguir para o seu painel enquanto terminamos.</p>
            </div>
          ) : (
            <p>
              Parabéns! Sua assinatura foi ativada com sucesso. 
              <span className="block mt-2 font-medium text-emerald-600">
                <Sparkles size={14} className="inline mr-1" />
                Tudo pronto para começar!
              </span>
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Link 
            to={destination}
            className={cn(
              "w-full h-14 flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all group",
              (syncing && !error) 
                ? "bg-brand-stone/10 text-brand-stone cursor-not-allowed" 
                : "bg-brand-ink text-brand-white hover:bg-brand-ink/90 shadow-lg shadow-brand-ink/10"
            )}
            onClick={(e) => (syncing && !error) && e.preventDefault()}
          >
            {syncing ? 'Sincronizando...' : profile?.onboardingCompleted ? 'Ir para meu painel' : 'Começar Onboarding'}
            {(!syncing || error) && <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />}
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
