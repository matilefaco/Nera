import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, ArrowLeft, Star, TrendingUp, ShieldCheck, Zap, Gift, Copy, Share2, Sparkles } from 'lucide-react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PremiumButton from '../components/PremiumButton';
import { useAuth } from '../AuthContext';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

export default function PlansPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success')) {
      toast.success('Assinatura processada com sucesso! Bem-vinda ao seleto grupo Nera Pro.');
    }
    if (searchParams.get('canceled')) {
      toast.error('O processo de assinatura foi cancelado.');
    }
  }, [searchParams]);

  const referralLink = `${window.location.origin}/cadastro?ref=${profile?.referralCode || ''}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link de indicação copiado!');
  };

  const handleUpgrade = async (planType: 'essencial' | 'pro') => {
    if (!user || !profile) {
      toast.error('Erro ao identificar usuária. Tente novamente.');
      return;
    }

    setLoadingPlan(planType);
    try {
      const response = await fetch('/api/plans/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        toast.error(data.error || 'Erro ao iniciar checkout.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Não foi possível conectar com o servidor de pagamentos.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-12 px-6">
        <header className="mb-16 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-12 h-12 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mb-6"
          >
            <Star size={24} />
          </motion.div>
          
          <h1 className="text-4xl font-serif text-brand-ink mb-4 italic text-balance">Mais clientes, menos caos.</h1>
          <h2 className="text-2xl font-serif text-brand-ink mb-6">O plano ideal para transformar sua rotina.</h2>
          
          <p className="text-brand-stone text-sm max-w-md leading-relaxed font-light">
            O Nera cresce com você. No plano gratuito você tem tudo o que precisa para começar. Nossos planos premium dão o fôlego para escalar.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {/* Plano Gratuito */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm flex flex-col"
          >
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-stone block mb-2">Plano Atual</span>
              <h3 className="text-2xl font-serif text-brand-ink mb-2 italic">Gratuito</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-serif text-brand-ink">R$ 0</span>
                <span className="text-xs text-brand-stone uppercase tracking-widest font-bold">/mês</span>
              </div>

              <div className="space-y-4 mb-10">
                {[
                  'Perfil digital premium (foto, bio e serviços)',
                  'Até 15 agendamentos por mês',
                  'Aprovação manual (seu filtro)',
                  'Email para clientes',
                  'Links para Instagram'
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-linen flex items-center justify-center text-brand-stone">
                      <Check size={12} />
                    </div>
                    <span className="text-xs font-medium text-brand-stone uppercase tracking-tight">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <button disabled className="w-full py-4 text-[10px] font-bold uppercase tracking-widest bg-brand-linen text-brand-stone rounded-full cursor-not-allowed">
              {profile?.plan === 'free' || !profile?.plan ? 'Plano Ativado' : 'Incluso'}
            </button>
          </motion.div>

          {/* Plano Essencial */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-brand-ink p-10 rounded-[40px] border border-white/5 shadow-xl flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Zap size={64} className="text-white" />
            </div>

            <div className="flex-1 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta block">Professional</span>
                <Zap size={12} className="text-brand-terracotta fill-brand-terracotta/20" />
              </div>
              <h3 className="text-2xl font-serif text-white mb-2 italic">Essencial</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-serif text-white">R$ 49</span>
                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">,90/mês</span>
              </div>

              <div className="space-y-4 mb-10">
                {[
                  'Agendamentos Ilimitados',
                  'Prioridade na Vitrine Nera',
                  'Faturamento e Métricas base',
                  'Sem cobrança de comissão',
                  'WhatsApp Notifications',
                  'Cupons de Desconto'
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-terracotta flex items-center justify-center text-white">
                      <Check size={12} />
                    </div>
                    <span className="text-xs font-medium text-white/80 uppercase tracking-tight">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <PremiumButton 
              onClick={() => handleUpgrade('essencial')}
              loading={loadingPlan === 'essencial'}
              className="w-full py-5 text-[11px]"
              variant={profile?.plan === 'essencial' ? 'secondary' : 'primary'}
              disabled={profile?.plan === 'essencial'}
            >
              {profile?.plan === 'essencial' ? 'Plano Atual' : 'Começar Essencial'}
            </PremiumButton>
          </motion.div>

          {/* Plano Pro */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-1 rounded-[40px] shadow-[0_40px_80px_-15px_rgba(139,92,71,0.2)] relative overflow-hidden border-2 border-brand-terracotta/30 bg-brand-parchment"
          >
            <div className="absolute top-0 right-0 p-6 z-10">
              <div className="bg-brand-terracotta text-white text-[8px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">Premium Elite</div>
            </div>

            <div className="bg-[#F3EDE7] p-12 lg:p-14 rounded-[38px] h-full flex flex-col border border-white/50 relative">
              {/* Subtle Decorative Gradient */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-terracotta/10 rounded-full blur-3xl -mr-32 -mt-32" />
              
              <div className="flex-1 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta block">Nera Elite</span>
                  <Sparkles size={14} className="text-brand-terracotta fill-brand-terracotta/20" />
                </div>
                <h3 className="text-4xl font-serif text-brand-ink mb-3 italic">Plano Pro</h3>
                <div className="flex items-baseline gap-1 mb-12">
                  <span className="text-6xl font-serif text-brand-ink tracking-tight">R$ 99</span>
                  <span className="text-base text-brand-stone uppercase tracking-widest font-bold">,90/mês</span>
                </div>

                <div className="space-y-6 mb-16">
                  {[
                    'Tudo do Plano Essencial',
                    'Dashboard Avançado (Gráficos)',
                    'Lista de Espera Inteligente',
                    'Analytics de Atendimento',
                    'Anti No-Show Automático',
                    'Suporte prioritário 24/7'
                  ].map(item => (
                    <div key={item} className="flex items-center gap-4">
                      <div className="w-6 h-6 rounded-full bg-brand-terracotta flex items-center justify-center text-white shadow-md ring-4 ring-brand-terracotta/10">
                        <Check size={14} />
                      </div>
                      <span className="text-[12px] font-extrabold text-brand-ink uppercase tracking-tight">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <PremiumButton 
                onClick={() => handleUpgrade('pro')}
                loading={loadingPlan === 'pro'}
                className="w-full py-7 text-[12px] shadow-2xl"
                variant={profile?.plan === 'pro' ? 'secondary' : 'terracotta'}
                disabled={profile?.plan === 'pro'}
              >
                {profile?.plan === 'pro' ? 'Plano Ativado' : 'Seja Pro agora'}
              </PremiumButton>

              <p className="text-[10px] text-brand-stone/80 font-bold uppercase tracking-[0.3em] text-center mt-8">Gestão completa e sem limites</p>
            </div>
          </motion.div>
        </div>

        {/* Referrals Section */}
        <motion.section 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 bg-brand-linen/30 border border-brand-mist/50 rounded-[40px] p-10 overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <Gift size={200} />
          </div>

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4 max-w-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-terracotta/10 flex items-center justify-center text-brand-terracotta">
                    <Gift size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta">Indique e Ganhe</span>
                </div>
                <h3 className="text-2xl font-serif text-brand-ink italic">Ajude outras profissionais a crescerem.</h3>
                <p className="text-xs text-brand-stone font-light leading-relaxed">
                  Para cada profissional que assinar o plano <span className="font-semibold">Essencial</span> usando seu código, 
                  você ganha <span className="font-semibold text-brand-ink">R$ 10,00</span> de crédito na sua próxima fatura.
                </p>
              </div>

              <div className="bg-brand-white p-6 rounded-3xl border border-brand-mist shadow-sm space-y-6 w-full md:w-auto md:min-w-[300px]">
                <div className="flex justify-between items-center px-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">Créditos Acumulados</span>
                  <span className="text-lg font-serif text-brand-terracotta">{formatCurrency(profile?.credits || 0)}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-[8px] font-bold uppercase tracking-widest text-brand-mist ml-1">Seu Código</label>
                  <div className="flex items-center gap-2 p-4 bg-brand-parchment rounded-2xl border border-brand-mist font-mono text-sm tracking-widest text-brand-ink">
                    {profile?.referralCode || '------'}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={copyReferral}
                    className="flex-1 bg-brand-ink text-brand-white py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-2"
                  >
                    <Copy size={14} /> Copiar Link
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Nera - Vitrine Digital Premium',
                          text: 'Use meu código e ganhe bônus ao criar sua vitrine no Nera!',
                          url: referralLink,
                        });
                      }
                    }}
                    className="w-14 h-14 bg-brand-linen text-brand-ink rounded-2xl flex items-center justify-center hover:bg-brand-mist transition-all"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

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
