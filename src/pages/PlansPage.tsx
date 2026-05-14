import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import PricingGrid from '../components/PricingGrid';

export default function PlansPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success')) {
      notify.success('Assinatura processada com sucesso! Bem-vinda ao seleto grupo Nera Pro.');
    }
    if (searchParams.get('canceled')) {
      notify.error('O processo de assinatura foi cancelado.');
    }
  }, [searchParams]);

  const handleUpgrade = async (planType: 'essencial' | 'pro') => {
    if (!user || !profile) {
      notify.error('Erro ao identificar usuária. Tente novamente.');
      return;
    }

    setLoadingPlan(planType);
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
      <div className="landing-page max-w-6xl mx-auto py-12 px-6 pb-40 md:pb-12" style={{ background: 'transparent' }}>
        <header className="mb-12 flex flex-col items-center text-center wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-terra">Upgrade</span>
          <h2 className="pricing-h2 text-brand-ink">O investimento<br/><em>certo para você.</em></h2>
          <p className="pricing-sub text-brand-stone">O Nera cresce com você. Sem contrato de fidelidade. Cancele quando quiser.</p>
        </header>

        <PricingGrid 
          currentPlan={profile?.plan || 'free'} 
          onUpgrade={handleUpgrade} 
          loadingPlan={loadingPlan} 
        />

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
            <p className="text-[10px] text-brand-stone uppercase tracking-tight leading-relaxed">O Nera não cobra comissão sobre seus serviços. </p>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 bg-brand-parchment rounded-full flex items-center justify-center mx-auto mb-4 text-brand-ink">
              <Zap size={20} />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-2">Setup Instantâneo</h4>
            <p className="text-[10px] text-brand-stone uppercase tracking-tight leading-relaxed">Ative o plano Essencial e desbloqueie tudo na hora.</p>
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
