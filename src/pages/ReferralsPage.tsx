import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Gift, ArrowLeft, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import AppLayout from '../components/AppLayout';
import { formatCurrency } from '../lib/utils';

interface ReferralRecord {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  plan: string;
}

export default function ReferralsPage() {
  const { profile } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.referralCode) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', profile.referralCode)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const docs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || 'Nova Profissional',
              email: data.email || '',
              createdAt: data.createdAt || new Date().toISOString(),
              plan: data.plan || 'free'
            } as ReferralRecord;
          });
setReferrals(docs);
setLoading(false);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => { console.error("Firestore onSnapshot error:", error); });

    return () => unsubscribe();
  }, [profile?.referralCode]);

  const totalCredits = (referrals.filter(r => r.plan !== 'free').length) * 10;

  return (
    <AppLayout activeRoute="plans">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <header className="mb-12">
          <Link 
            to="/planos" 
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Voltar aos Planos
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

            <div className="bg-brand-ink text-white p-6 rounded-3xl min-w-[200px]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 block mb-1">Total Ganho</span>
              <span className="text-3xl font-serif text-brand-terracotta">{formatCurrency(totalCredits)}</span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-8 h-8 border-2 border-brand-terracotta border-t-transparent rounded-full"
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone">Carregando indicações...</span>
          </div>
        ) : referrals.length === 0 ? (
          <div className="bg-brand-parchment rounded-[40px] border border-brand-mist p-16 text-center">
            <div className="w-16 h-16 bg-brand-white rounded-full flex items-center justify-center mx-auto mb-6 text-brand-mist">
              <Users size={32} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2 italic">Nenhuma indicação ainda</h3>
            <p className="text-xs text-brand-stone font-light max-w-xs mx-auto mb-8">
              Compartilhe seu código com outras profissionais e comece a ganhar créditos hoje mesmo!
            </p>
            <Link 
              to="/planos" 
              className="inline-block bg-brand-ink text-brand-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all"
            >
              Pegar meu código
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 px-6 text-[9px] font-bold uppercase tracking-widest text-brand-stone">
              <div className="col-span-2">Profissional</div>
              <div>Data</div>
              <div>Status</div>
            </div>

            {referrals.map((referral, idx) => (
              <motion.div 
                key={referral.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-brand-white border border-brand-mist p-6 rounded-3xl flex items-center justify-between"
              >
                <div className="grid grid-cols-4 w-full items-center">
                  <div className="col-span-2 flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-ink font-serif italic text-lg">
                      {referral.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-ink uppercase tracking-tight">{referral.name}</h4>
                      <p className="text-[10px] text-brand-stone font-light truncate max-w-[150px]">{referral.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-brand-stone">
                    <Calendar size={14} />
                    <span className="text-[11px] font-medium">{new Date(referral.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div>
                    {referral.plan !== 'free' ? (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full w-fit border border-green-100">
                        <CheckCircle2 size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Ativa (R$ 10)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-brand-stone bg-brand-linen px-3 py-1.5 rounded-full w-fit border border-brand-mist/50">
                        <Clock size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Pendente</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
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
      </div>
    </AppLayout>
  );
}
