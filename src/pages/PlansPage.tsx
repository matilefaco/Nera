import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import PricingGrid from '../components/PricingGrid';
import { AnimatePresence, motion } from 'motion/react';

export default function PlansPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  useEffect(() => {
    if (searchParams.get('success')) {
      notify.success('Assinatura processada com sucesso! Bem-vinda ao seleto grupo Nera Pro.');
    }
    if (searchParams.get('canceled')) {
      notify.error('O processo de assinatura foi cancelado.');
    }
  }, [searchParams]);

  const handleManageSubscription = async () => {
    if (!user) return;
    setLoadingPortal(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/plans/create-portal', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Portal API Error Response:", data);
        if (data.error && data.error.startsWith('Ocorreu um erro ao abrir o portal')) {
          notify.error(data.error); // shows the Stripe message directly
        } else {
          notify.error(data.error || 'Erro ao abrir o portal de assinaturas.');
        }
      }
    } catch (err) {
      console.error('Portal connection error:', err);
      notify.error('Erro de conexão ao tentar gerenciar assinatura.');
    } finally {
      setLoadingPortal(false);
    }
  };

  const [showUpgradeConfirmation, setShowUpgradeConfirmation] = useState(false);

  const confirmUpgradeToPro = async () => {
    if (!user) return;
    setShowUpgradeConfirmation(false);
    setUpgradeStatus('loading');
    
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/plans/upgrade-to-pro', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setUpgradeStatus('success');
        setTimeout(() => { window.location.reload(); }, 3000);
      } else {
         setUpgradeStatus('idle');
         notify.error(data.error || 'Não conseguimos concluir seu upgrade no momento. Nenhuma cobrança foi realizada.');
      }
    } catch (err) {
      setUpgradeStatus('idle');
      console.error('Upgrade error:', err);
      notify.error('Não conseguimos concluir seu upgrade no momento. Nenhuma cobrança foi realizada.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleUpgrade = async (planType: 'essencial' | 'pro') => {
    if (!user || !profile) {
      notify.error('Erro ao identificar usuária. Tente novamente.');
      return;
    }

    setLoadingPlan(planType);

    if (profile.plan === 'essencial' && planType === 'pro') {
      setShowUpgradeConfirmation(true);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/plans/create-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: planType,
          professionalId: user.uid,
          email: user.email,
        }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        notify.error(data.error || 'Erro ao iniciar checkout.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      notify.error('Não foi possível conectar com o servidor de pagamentos.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppLayout>
      <AnimatePresence>
        {upgradeStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center bg-brand-white"
          >
            {upgradeStatus === 'loading' ? (
              <div key="loading" className="max-w-xs w-full flex flex-col items-center">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 rounded-full border border-brand-linen flex items-center justify-center mb-6 relative"
                >
                   <Sparkles className="text-brand-terracotta" size={24} />
                   <div className="absolute inset-0 border-2 border-brand-terracotta rounded-full border-t-transparent animate-spin" />
                </motion.div>
                <h3 className="text-xl font-serif text-brand-ink mb-2">Ativando seus<br/>recursos Pro...</h3>
                <div className="flex flex-col gap-3 mt-8 w-full text-left">
                   <motion.div initial={{opacity: 0, x:-10}} animate={{opacity: 1, x:0}} transition={{delay: 0.5}} className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-brand-stone font-bold">
                      <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center">✓</span> Preparando upgrade
                   </motion.div>
                   <motion.div initial={{opacity: 0, x:-10}} animate={{opacity: 1, x:0}} transition={{delay: 1.2}} className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-brand-stone font-bold">
                      <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center">✓</span> Liberando recursos premium
                   </motion.div>
                   <motion.div initial={{opacity: 0, x:-10}} animate={{opacity: 1, x:0}} transition={{delay: 1.9}} className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-brand-stone font-bold">
                      <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center">✓</span> Sincronizando assinatura
                   </motion.div>
                </div>
              </div>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xs w-full flex flex-col items-center"
              >
                <div className="w-20 h-20 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta shadow-sm mb-6 border border-brand-mist/20">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                  >
                    <ShieldCheck size={32} />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-serif text-brand-ink leading-tight mb-3">Seu perfil agora faz parte do Nera Pro.</h3>
                <p className="text-sm text-brand-stone font-light leading-relaxed">
                  Os recursos premium já foram liberados para sua conta.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="landing-page max-w-6xl mx-auto py-12 px-6 pb-40 md:pb-12" style={{ background: 'transparent' }}>
        <header className="mb-12 flex flex-col items-center text-center wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-terra">Upgrade</span>
          <h2 className="pricing-h2 text-brand-ink">O investimento<br/><em>certo para você.</em></h2>
          <p className="pricing-sub text-brand-stone">A Nera cresce com você. Sem contrato de fidelidade. Cancele quando quiser.</p>
          
          {profile?.plan && profile.plan !== 'free' && (
            <button 
              onClick={() => handleManageSubscription()} 
              disabled={loadingPortal}
              className="mt-6 px-6 py-3 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-stone transition-all"
            >
              {loadingPortal ? 'Carregando...' : 'Gerenciar assinatura'}
            </button>
          )}
        </header>

        <PricingGrid 
          currentPlan={profile?.plan || 'free'} 
          onUpgrade={handleUpgrade} 
          onManageSubscription={handleManageSubscription}
          loadingPlan={loadingPlan} 
        />

        <AnimatePresence>
          {showUpgradeConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-ink/40 backdrop-blur-sm"
              onClick={() => setShowUpgradeConfirmation(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-brand-mist/50 flex flex-col"
              >
                <div className="p-8 pb-6 bg-gradient-to-b from-brand-linen/60 to-brand-white relative">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-terracotta border border-brand-mist/30 shadow-sm mb-5">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-2xl font-serif text-brand-ink leading-tight mb-2">Evoluir para o Nera Pro</h3>
                  <p className="text-sm text-brand-stone font-light leading-relaxed">
                    Desbloqueie recursos avançados para crescer com mais estratégia, inteligência e presença.
                  </p>
                </div>

                <div className="px-8 py-2">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-brand-parchment flex items-center justify-center text-brand-terracotta shrink-0">
                        <TrendingUp size={12} />
                      </div>
                      <span className="text-sm text-brand-ink">Insights avançados da vitrine</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-brand-parchment flex items-center justify-center text-brand-terracotta shrink-0">
                        <ShieldCheck size={12} />
                      </div>
                      <span className="text-sm text-brand-ink">Badge Pro de confiança</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-0.5 w-5 h-5 rounded-full bg-brand-parchment flex items-center justify-center text-brand-terracotta shrink-0">
                        <Zap size={12} />
                      </div>
                      <span className="text-sm text-brand-ink">Lista de espera inteligente</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 px-8 py-6 bg-brand-parchment/30 border-t border-brand-mist/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-brand-stone uppercase tracking-widest font-bold">Plano atual</span>
                    <span className="text-sm font-serif text-brand-ink">Essencial — R$49/mês</span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-brand-terracotta uppercase tracking-widest font-bold">Novo plano</span>
                    <span className="text-base font-serif text-brand-terracotta font-medium">Pro — R$89/mês</span>
                  </div>
                  <div className="p-3 bg-brand-white rounded-xl border border-brand-mist/50">
                    <p className="text-[11px] text-brand-stone font-light leading-relaxed text-center">
                      A Stripe aplicará automaticamente apenas a diferença proporcional do período atual.
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-4 flex flex-col gap-3">
                  <button 
                    onClick={confirmUpgradeToPro}
                    className="w-full py-4 bg-brand-ink text-brand-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-brand-stone transition-all"
                  >
                    Confirmar upgrade
                  </button>
                  <button 
                    onClick={() => setShowUpgradeConfirmation(false)}
                    className="w-full py-4 bg-transparent text-brand-stone rounded-full text-xs font-bold uppercase tracking-widest hover:text-brand-ink transition-all"
                  >
                    Agora não
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-brand-parchment rounded-full flex items-center justify-center mx-auto mb-4 text-brand-ink">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-2">Segurança Total</h4>
            <p className="text-[10px] text-brand-stone uppercase tracking-tight leading-relaxed">Seus dados e de suas clientes protegidos com criptografia.</p>
          </div>
          
          <div className="text-center">
            <div className="w-10 h-10 bg-brand-parchment rounded-full flex items-center justify-center mx-auto mb-4 text-brand-ink">
              <TrendingUp size={20} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-2">Foco no Lucro</h4>
            <p className="text-[10px] text-brand-stone uppercase tracking-tight leading-relaxed">A Nera não cobra comissão sobre seus serviços. </p>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 bg-brand-parchment rounded-full flex items-center justify-center mx-auto mb-4 text-brand-ink">
              <Zap size={20} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-2">Setup Instantâneo</h4>
            <p className="text-[10px] text-brand-stone uppercase tracking-tight leading-relaxed">Ative o plano Pro e desbloqueie tudo na hora.</p>
          </div>
        </section>

        <div className="mt-20 border-t border-brand-mist pt-10 text-center">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-all">
            <ArrowLeft size={14} /> Voltar ao Painel
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
