import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Gift, ArrowLeft, Calendar, CheckCircle2, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { auth } from '../firebase';
import AppLayout from '../components/AppLayout';
import { formatCurrency } from '../lib/utils';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import PremiumButton from '../components/PremiumButton';

interface ReferralRecord {
  id: string;
  name: string;
  specialty?: string;
  createdAt: string;
  plan: string;
}

export default function ReferralsPage() {
  const navigate = useNavigate();
  const { profile, isAuthReady } = useAuth();
  const { features } = usePlanFeatures();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [copyAnim, setCopyAnim] = useState(false);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!features.referrals) {
      setLoading(false);
      return;
    }

    if (!profile?.referralCode) {
      setLoading(false);
      return;
    }


    let isMounted = true;
    let isCancelled = false;

    async function fetchReferrals() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        setLoading(true);
        setError(false);
        
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/profile/referrals', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`API_ERROR_${response.status}`);
        
        const docs = await response.json();
        
        if (!isMounted || isCancelled) return;

        setReferrals(docs);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (!isMounted || isCancelled) return;
        
        console.error("[Referrals] error:", err);
        
        // Only show error UI if it was a real failure, not just empty
        if (err.name === 'AbortError') {
          setError(true);
        } else if (err.message.includes('API_ERROR_')) {
          setError(true);
        } else {
          // Fallback
          setError(true);
        }
        setReferrals([]);
      } finally {
        if (isMounted && !isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchReferrals();

    return () => {
      isMounted = false;
      isCancelled = true;
    };
  }, [profile?.referralCode, isAuthReady, retryCount, features.referrals]);

  const totalCredits = (referrals.filter(r => r.plan !== 'free').length) * 10;
  const referralLink = `${window.location.origin}/register?ref=${profile?.referralCode || ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopyAnim(true);
    setTimeout(() => setCopyAnim(false), 2000);
  };

  return (
    <AppLayout activeRoute="dashboard">
      <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 sm:px-6">
        <header className="mb-8 md:mb-12">
          <Link 
            to="/dashboard" 
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Voltar ao Painel
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-terracotta/10 rounded-2xl flex items-center justify-center text-brand-terracotta">
                  <Gift size={20} />
                </div>
                <h1 className="text-3xl font-serif text-brand-ink italic">Minhas Indicações</h1>
              </div>
              <p className="text-brand-stone text-sm font-light max-w-md">
                Aqui você acompanha quem se cadastrou usando seu código e os créditos que você já ganhou.
              </p>
            </div>

            {features.referrals && (
              <div className="bg-brand-ink text-white p-6 rounded-3xl min-w-[200px]">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-1">Total Ganho</span>
                <span className="text-3xl font-serif text-brand-terracotta">{formatCurrency(profile?.credits || 0)}</span>
                {(profile?.credits || 0) > 0 && (
                  <div className="mt-2 text-[9px] text-brand-linen/80 uppercase tracking-widest font-medium border-t border-white/10 pt-2">
                    aplicados no próximo upgrade
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {!features.referrals ? (
          <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="text-center mb-16 md:mb-24">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-6 block">Recurso Exclusivo</span>
              <h2 className="text-4xl md:text-6xl font-serif text-brand-ink mb-8 italic leading-tight">Indicação premiada</h2>
              <p className="text-base md:text-xl text-brand-stone font-light leading-relaxed max-w-2xl mx-auto">
                Compartilhe a Nera com outras profissionais e acompanhe seus créditos quando a indicação se tornar ativa.
              </p>
            </div>

            <div className="bg-brand-parchment/40 rounded-[48px] p-12 md:p-20 text-center border border-brand-mist/50 backdrop-blur-sm">
              <p className="text-xs text-brand-stone font-medium uppercase tracking-[0.2em] mb-10">
                Disponível no plano Pro
              </p>
              <PremiumButton 
                variant="terracotta" 
                onClick={() => navigate('/planos')}
                className="px-14 py-5 text-[11px]"
              >
                Ver plano Pro
              </PremiumButton>
            </div>
          </div>
        ) : (
          <>
        {/* Link Section */}
        <section className="mb-8 md:mb-12 bg-brand-white p-5 sm:p-8 rounded-[32px] border border-brand-mist shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="max-w-md w-full">
            <h3 className="text-base font-serif text-brand-ink mb-1">Seu Código de Indicação</h3>
            <p className="text-[11px] text-brand-stone font-light">Envie este link para outras profissionais ganharem vantagens exclusivas pelo seu convite.</p>
          </div>
          
          <div className="flex w-full md:w-auto items-stretch md:items-center gap-2 flex-col md:flex-row">
            <div className="bg-[#FAF9F8] px-4 py-3 rounded-2xl border border-brand-mist/60 font-mono text-sm tracking-widest text-brand-ink flex-1 text-center md:text-left min-w-0 break-all">
              {profile?.referralCode || '------'}
            </div>
            <button 
              onClick={handleCopy}
              className="bg-brand-ink text-brand-white px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-espresso transition-all whitespace-nowrap min-h-[44px]"
            >
              {copyAnim ? <CheckCircle2 size={14} className="text-green-400" /> : <Gift size={14} />} 
              {copyAnim ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
        </section>

        {error ? (
          <div className="bg-brand-parchment rounded-[40px] border border-brand-mist p-16 text-center">
            <div className="w-16 h-16 bg-brand-white rounded-full flex items-center justify-center mx-auto mb-6 text-brand-terracotta shadow-sm">
               <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2 italic">Carregamento Lento</h3>
            <p className="text-xs text-brand-stone font-light max-w-xs mx-auto mb-8">
              A conexão está lenta ou houve um erro de processamento. Tente novamente em alguns instantes.
            </p>
            <button 
              onClick={() => setRetryCount(c => c + 1)}
              className="inline-flex items-center justify-center bg-brand-ink text-brand-white px-8 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-brand-white p-6 rounded-3xl border border-brand-mist shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-brand-linen rounded-full shrink-0"></div>
                   <div className="space-y-2">
                     <div className="h-4 bg-brand-linen rounded w-32"></div>
                     <div className="h-3 bg-brand-linen rounded w-24"></div>
                   </div>
                </div>
                <div className="h-8 bg-brand-linen rounded-2xl w-24"></div>
              </div>
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="bg-white rounded-[40px] border border-dashed border-brand-mist/60 py-20 px-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-brand-linen/40 text-brand-stone/30 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-brand-mist/20">
              <Gift size={28} strokeWidth={1} />
            </div>
            <h3 className="text-2xl font-serif text-brand-ink mb-2 italic">Sua primeira indicação começa aqui</h3>
            <p className="text-[11px] text-brand-stone font-light max-w-xs mx-auto mb-10 leading-relaxed uppercase tracking-widest">
              Indique outras profissionais e ganhe créditos quando elas se tornarem clientes da Nera.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-2 bg-brand-ink text-brand-white px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md"
              >
                {copyAnim ? <CheckCircle2 size={14} className="text-green-400" /> : <Gift size={14} />}
                {copyAnim ? 'Link Copiado!' : 'Copiar Link'}
              </button>
              <button 
                onClick={() => {
                  const url = encodeURIComponent(referralLink);
                  window.open(`https://wa.me/?text=${encodeURIComponent(`Oie! Descobri a Nera, uma plataforma incrível para vitrine e agendamento. Se cadastre pelo meu link: ${referralLink}`)}`, '_blank');
                }}
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md"
              >
                <MessageCircle size={14} />
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="hidden sm:grid grid-cols-4 px-6 text-[9px] font-bold uppercase tracking-widest text-brand-stone">
              <div className="col-span-2">Profissional</div>
              <div>Data</div>
              <div>Status & Recompensa</div>
            </div>

            {referrals.map((referral, idx) => {
              const firstName = referral.name.split(' ')[0];
              const isPaid = referral.plan !== 'free';
              
              const statusLabel = referral.plan === 'pro' ? 'Assinatura ativa' : 
                                 referral.plan === 'essencial' ? 'Trial ativo' : 
                                 'Cadastro iniciado';
              
              return (
                <motion.div 
                  key={referral.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-brand-white border border-brand-mist p-5 rounded-[24px] shadow-sm"
                >
                  <div className="flex flex-col sm:grid sm:grid-cols-4 w-full items-start sm:items-center gap-4 sm:gap-0">
                    <div className="sm:col-span-2 flex items-center gap-4 w-full min-w-0">
                      <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-ink font-serif italic text-lg shrink-0">
                        {referral.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-brand-ink uppercase tracking-tight truncate">{firstName}</h4>
                          <span className="w-1 h-1 rounded-full bg-brand-mist" />
                          <span className="text-[10px] text-brand-stone font-light truncate">{referral.specialty || 'Profissional'}</span>
                        </div>
                        <p className="text-[9px] text-brand-stone/60 uppercase tracking-widest mt-1">{statusLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-brand-stone">
                      <Calendar size={14} />
                      <span className="text-[11px] font-medium">{new Date(referral.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <div>
                      {isPaid ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full w-fit border border-emerald-100">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} />
                            <span className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Crédito liberado</span>
                          </div>
                          <span className="w-px h-3 bg-emerald-200 mx-1" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">+R$ 10</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-brand-stone bg-brand-linen/60 px-3 py-1.5 rounded-full w-fit border border-brand-mist/50">
                          <Clock size={12} />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Aguardando ativação</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <footer className="mt-16 p-8 bg-brand-linen/30 border border-brand-mist rounded-[40px]">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink mb-4">Como funciona?</h4>
          <ul className="space-y-3">
            {[
              "Cada profissional que criar uma conta com seu código é uma indicação pendente.",
              "Quando ela assina qualquer plano pago, sua indicação se torna 'Ativa'.",
              "Indicações Ativas somam R$ 10,00 de crédito na sua conta.",
              "Seus créditos são aplicados automaticamente como desconto no seu próximo upgrade ou renovação."
            ].map((text, i) => (
              <li key={i} className="flex gap-3 text-[11px] text-brand-stone font-light leading-relaxed">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta mt-1.5 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </footer>
        </>
        )}
      </div>
    </AppLayout>
  );
}
