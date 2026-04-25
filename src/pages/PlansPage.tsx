import React from 'react';
import { motion } from 'motion/react';
import { Check, ArrowLeft, Star, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PremiumButton from '../components/PremiumButton';

export default function PlansPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-12 px-6">
        <header className="mb-16 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-12 h-12 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mb-6"
          >
            <Star size={24} />
          </motion.div>
          
          <h1 className="text-4xl font-serif text-brand-ink mb-4 italic">Escolha o ritmo do seu</h1>
          <h1 className="text-4xl font-serif text-brand-ink mb-6">Crescimento Profissional</h1>
          
          <p className="text-brand-stone text-sm max-w-md leading-relaxed font-light">
            O Nera cresce com você. No plano gratuito você tem tudo o que precisa para começar. No Essencial, você ganha o fôlego para escalar.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
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
                  'Vitrine pública básica',
                  'Agendamentos mensais',
                  'Filtro de clientes',
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
              Plano Ativado
            </button>
          </motion.div>

          {/* Plano Essencial */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-brand-ink p-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] rounded-[40px] shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6">
              <div className="bg-brand-terracotta text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Recomendado</div>
            </div>

            <div className="bg-brand-ink p-10 rounded-[38px] h-full flex flex-col border border-white/5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta block">Professional</span>
                  <Zap size={12} className="text-brand-terracotta" />
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
                    'Dashboard Avançado',
                    'Relatórios de faturamento',
                    'Sem cobrança de comissão',
                    'Suporte prioritário 24/7'
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

              <PremiumButton className="w-full py-5 text-[11px]">
                Fazer Upgrade
              </PremiumButton>

              <p className="text-[9px] text-white/40 font-medium uppercase tracking-widest text-center mt-6">Cancele a qualquer momento • Teste sem risco</p>
            </div>
          </motion.div>
        </div>

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
