import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Tag, Calendar, Users, 
  Trash2, ToggleLeft, ToggleRight, 
  X, Check, AlertCircle, Info,
  Percent, CircleSlash, ArrowLeft, ArrowRight
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, 
  addDoc, deleteDoc, doc, updateDoc, 
  serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Coupon, Service } from '../types';
import AppLayout from '../components/AppLayout';
import PremiumButton from '../components/PremiumButton';
import { formatCurrency, cn } from '../lib/utils';
import { notify } from '../lib/notify';
import { FirstVisitTip } from '../components/FirstVisitTip';

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import UpgradeModal from '../components/UpgradeModal';

export default function CouponsPage() {
  const { user, isAuthReady } = useAuth();
  const { 
    isUpgradeModalOpen, 
    upgradeFeature, 
    usageCount, 
    closeUpgradeModal, 
    checkFeatureAccess 
  } = useUpgradeTriggers();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceRestriction, setServiceRestriction] = useState<'all' | 'specific'>('all');
  const [perClientLimit, setPerClientLimit] = useState<1 | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let loadingTimeout: NodeJS.Timeout;

    if (!isAuthReady) return; // Aguardar o AuthContext carregar primeiro
    
    if (!user?.uid) {
      if (isMounted) setLoading(false);
      return;
    }

    if (isMounted) {
      setLoading(true);
      setError(false);
    }

    loadingTimeout = setTimeout(() => {
      if (isMounted) {
        console.log('[Coupons] timeout! forcing loading false');
        setError(true);
        setLoading(false);
      }
    }, 8000);

    const q = query(
      collection(db, 'coupons'),
      where('professionalId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      if (!isMounted) return;

      try {
        if (snapshot.metadata.fromCache && snapshot.empty) {
          console.log('[Coupons] from cache and empty, waiting for server');
          return;
        }

        console.log(`[Coupons] success count=${snapshot.docs.length}`);

        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
        
        const getSortTime = (timestamp: any) => {
          if (!timestamp) return 0;
          if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
          if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
          if (timestamp.seconds) return timestamp.seconds * 1000;
          if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const time = new Date(timestamp).getTime();
            return isNaN(time) ? 0 : time;
          }
          return 0;
        };

        const sortedData = data.sort((a, b) => getSortTime(b.createdAt) - getSortTime(a.createdAt));
        
        setCoupons(sortedData);
        setLoading(false);
        clearTimeout(loadingTimeout);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
        if (isMounted) {
          setLoading(false);
          clearTimeout(loadingTimeout);
        }
      }
    }, (error) => { 
      console.error("Firestore onSnapshot error:", error); 
      if (isMounted) {
        setLoading(false);
        clearTimeout(loadingTimeout);
      }
    });

    const fetchServices = async () => {
      try {
        const sQuery = query(collection(db, 'services'), where('professionalId', '==', user.uid));
        const sSnap = await getDocs(sQuery);
        if (isMounted) {
          setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
        }
      } catch (err) {
        console.error("Error fetching services:", err);
      }
    };

    fetchServices();

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [user?.uid, isAuthReady, retryCount]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!code.trim() || !value) {
      notify.error('Preencha o código e o valor do cupom.');
      return;
    }

    setIsCreating(true);
    try {
      // Check if code already exists for this pro
      const existing = coupons.find(c => c.code === code.trim().toUpperCase());
      if (existing) {
        notify.error('Você já tem um cupom com este código.');
        setIsCreating(false);
        return;
      }

      await addDoc(collection(db, 'coupons'), {
        professionalId: user.uid,
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        maxUses: maxUses ? Number(maxUses) : null,
        usedCount: 0,
        expiresAt: expiresAt || null,
        active: true,
        applicableServiceIds: serviceRestriction === 'specific' ? selectedServices : [],
        perClientLimit,
        createdAt: serverTimestamp()
      });

      notify.success('Cupom criado com sucesso!');
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error creating coupon:', err);
      notify.error('Erro ao criar cupom.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setCode('');
    setType('percentage');
    setValue('');
    setMaxUses('');
    setExpiresAt('');
    setSelectedServices([]);
    setServiceRestriction('all');
    setPerClientLimit(null);
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), {
        active: !coupon.active
      });
      notify.success(`Cupom ${!coupon.active ? 'ativado' : 'desativado'}!`);
    } catch (err) {
      notify.error('Erro ao atualizar status.');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      notify.success('Cupom excluído.');
    } catch (err) {
      notify.error('Erro ao excluir cupom.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <AppLayout activeRoute="coupons">
      <FirstVisitTip 
        pageKey="coupons"
        title="Cupons e descontos"
        description="Crie códigos promocionais para datas especiais ou para fidelizar clientes. Você controla o valor e a validade."
      />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-brand-terracotta/10 flex items-center justify-center text-brand-terracotta">
                <Tag size={18} />
              </div>
              <h1 className="text-3xl font-serif text-brand-ink">Cupons de Desconto</h1>
            </div>
            <p className="text-sm text-brand-stone font-light italic">
              Crie incentivos exclusivos para suas clientes.
            </p>
          </div>
          <PremiumButton 
            variant="terracotta" 
            onClick={() => {
              if (checkFeatureAccess('coupons')) {
                setIsModalOpen(true);
              }
            }}
            className="w-full md:w-auto"
          >
            <Plus size={18} className="mr-2" /> Criar Cupom
          </PremiumButton>
        </header>

        {error ? (
          <div className="bg-brand-parchment rounded-[40px] border border-brand-mist p-16 text-center">
            <div className="w-16 h-16 bg-brand-white rounded-full flex items-center justify-center mx-auto mb-6 text-brand-mist shadow-sm">
               <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2 italic">Carregamento Lento</h3>
            <p className="text-xs text-brand-stone font-light max-w-xs mx-auto mb-8">
              A conexão está lenta. Nossos servidores demoraram mais que o esperado.
            </p>
            <button 
              onClick={() => setRetryCount(c => c + 1)}
              className="inline-flex items-center justify-center bg-brand-ink text-brand-white px-8 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-brand-linen/20 rounded-[32px] animate-pulse" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-24 bg-[#FCFBF9] rounded-[40px] border border-[#F2EFEA] shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-terracotta/[0.03] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="w-20 h-20 bg-brand-linen/60 text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-8 relative z-10">
              <Tag size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-serif text-brand-ink mb-3 relative z-10">Nenhum cupom ativo</h3>
            <p className="text-base text-brand-stone font-light max-w-sm mx-auto mb-10 relative z-10 leading-relaxed">
              Incentive novas marcações ou recompense suas clientes mais fiéis com vantagens exclusivas.
            </p>
            <button 
              onClick={() => {
                if (checkFeatureAccess('coupons')) {
                  setIsModalOpen(true);
                }
              }}
              className="relative z-10 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-terracotta flex items-center justify-center gap-2 mx-auto group hover:scale-105 transition-transform"
            >
              Criar meu primeiro cupom <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {coupons.map((coupon) => (
                <motion.div 
                  key={coupon.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "bg-brand-white rounded-[32px] border transition-all overflow-hidden group shadow-sm hover:shadow-md",
                    coupon.active ? "border-brand-mist" : "border-brand-mist/50 opacity-70"
                  )}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase transition-colors border",
                          coupon.active 
                            ? "bg-brand-linen/50 text-brand-ink border-brand-mist shadow-sm" 
                            : "bg-brand-stone/5 text-brand-stone/50 border-brand-mist/50"
                        )}>
                          {coupon.active ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleCouponStatus(coupon)}
                          className="p-2 text-brand-stone/60 hover:text-brand-ink transition-colors"
                          title={coupon.active ? 'Desativar' : 'Ativar'}
                        >
                          {coupon.active ? <ToggleRight size={26} strokeWidth={1.5} className="text-brand-terracotta" /> : <ToggleLeft size={26} strokeWidth={1.5} />}
                        </button>
                        <button 
                          onClick={() => setIsDeleting(coupon.id)}
                          className="p-2 text-brand-stone/60 hover:text-brand-terracotta transition-colors"
                        >
                          <Trash2 size={18} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className={cn(
                          "text-2xl font-serif tracking-tight mb-1",
                          coupon.active ? "text-brand-ink" : "text-brand-ink/50"
                        )}>{coupon.code}</h4>
                        <p className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.2em]",
                          coupon.active ? "text-brand-terracotta" : "text-brand-stone/50"
                        )}>
                          {coupon.type === 'percentage' ? `${coupon.value}% de desconto` : `${formatCurrency(coupon.value)} de desconto`}
                        </p>
                      </div>

                      <div className="space-y-4 pt-5 border-t border-brand-mist/50">
                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60">Usos</span>
                            <p className={cn(
                              "text-xs font-medium font-mono tracking-tight",
                              coupon.active ? "text-brand-ink" : "text-brand-stone"
                            )}>
                              {coupon.usedCount} <span className="text-brand-stone/40 font-sans mx-0.5">/</span> {coupon.maxUses ? coupon.maxUses : 'Ilimitado'}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60">Validade</span>
                            <p className={cn(
                              "text-xs font-medium",
                              coupon.active ? "text-brand-ink" : "text-brand-stone"
                            )}>
                              {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('pt-BR') : 'Sem expiração'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60">Serviços</span>
                            <p className="text-[11px] text-brand-stone font-light truncate">
                              {coupon.applicableServiceIds && coupon.applicableServiceIds.length > 0 
                                ? `Válido p/ ${coupon.applicableServiceIds.length} serviços` 
                                : 'Todos os serviços'}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone/60">Por Cliente</span>
                            <p className="text-[11px] text-brand-stone font-light">
                              {coupon.perClientLimit === 1 ? 'Apenas 1 vez' : 'Sem limite'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-brand-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-[#F2EFEA] text-center"
            >
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-3">Excluir cupom?</h3>
              <p className="text-sm text-brand-stone font-light mb-8 leading-relaxed">
                Esta ação não pode ser desfeita. Clientes que já têm este código salvo <span className="font-semibold">não poderão mais usá-lo.</span>
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink hover:bg-brand-mist/20 rounded-[16px] transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteCoupon(isDeleting)}
                  className="flex-1 py-3.5 bg-red-500 text-white rounded-[16px] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-red-600 transition-colors shadow-sm"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Coupon Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[300] flex items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-brand-parchment w-full max-w-2xl md:rounded-[40px] shadow-2xl relative max-h-[100dvh] md:max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col"
            >
              <div className="p-8 md:p-12">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors"
                >
                  <X size={24} />
                </button>

                <div className="mb-10 text-center md:text-left">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-brand-linen/50 text-brand-terracotta rounded-full flex items-center justify-center mx-auto md:mx-0">
                      <Tag size={24} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-3xl font-serif text-brand-ink">Novo Cupom</h2>
                  </div>
                  <p className="text-base text-brand-stone font-light">
                    Defina as regras e condições para este desconto.
                  </p>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Código Promocional</label>
                      <input 
                        type="text" 
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Ex: PRIMEIRA10"
                        className="w-full px-6 py-4 bg-brand-white border border-[#F2EFEA] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)] rounded-[20px] text-sm outline-none focus:ring-1 focus:ring-brand-ink focus:border-brand-ink uppercase font-mono tracking-widest transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Tipo de Desconto</label>
                      <div className="flex bg-[#FCFBF9] p-1.5 rounded-[20px] border border-[#F2EFEA]">
                        <button 
                          type="button" 
                          onClick={() => setType('percentage')}
                          className={cn(
                            "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                            type === 'percentage' 
                              ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" 
                              : "text-brand-stone hover:text-brand-ink"
                          )}
                        >
                          Porcentagem (%)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setType('fixed')}
                          className={cn(
                            "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                            type === 'fixed' 
                              ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" 
                              : "text-brand-stone hover:text-brand-ink"
                          )}
                        >
                          Valor Fixo (R$)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Valor do Desconto</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={type === 'percentage' ? "Ex: 10" : "Ex: 15"}
                          className="w-full px-6 py-4 bg-brand-white border border-[#F2EFEA] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)] rounded-[20px] text-sm outline-none focus:ring-1 focus:ring-brand-ink focus:border-brand-ink transition-all"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-stone/40 font-bold uppercase tracking-[0.2em] text-[10px]">
                          {type === 'percentage' ? '%' : 'Reais'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Limite de Usos (Opcional)</label>
                      <input 
                        type="number" 
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        placeholder="Vazio para ilimitado"
                        className="w-full px-6 py-4 bg-brand-white border border-[#F2EFEA] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)] rounded-[20px] text-sm outline-none focus:ring-1 focus:ring-brand-ink focus:border-brand-ink transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Data de Expiração (Opcional)</label>
                      <input 
                        type="date" 
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full px-6 py-4 bg-brand-white border border-[#F2EFEA] shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)] rounded-[20px] text-sm text-brand-ink outline-none focus:ring-1 focus:ring-brand-ink focus:border-brand-ink transition-all"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="ml-1 flex flex-col mb-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone">Limite por Cliente</label>
                        <span className="text-[9px] text-brand-stone/60 font-medium">Previne usos abusivos do mesmo cupom</span>
                      </div>
                      <div className="flex bg-[#FCFBF9] p-1.5 rounded-[20px] border border-[#F2EFEA]">
                        <button 
                          type="button" 
                          onClick={() => setPerClientLimit(null)}
                          className={cn(
                            "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                            perClientLimit === null ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" : "text-brand-stone hover:text-brand-ink"
                          )}
                        >
                          Sem limite
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPerClientLimit(1)}
                          className={cn(
                            "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                            perClientLimit === 1 ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" : "text-brand-stone hover:text-brand-ink"
                          )}
                        >
                          1 por cliente
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone ml-1">Serviços Aplicáveis</label>
                    
                    <div className="flex bg-[#FCFBF9] p-1.5 rounded-[20px] border border-[#F2EFEA]">
                      <button 
                        type="button" 
                        onClick={() => setServiceRestriction('all')}
                        className={cn(
                          "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                          serviceRestriction === 'all' ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" : "text-brand-stone hover:text-brand-ink"
                        )}
                      >
                        Todos os Serviços
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setServiceRestriction('specific')}
                        className={cn(
                          "flex-1 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all",
                          serviceRestriction === 'specific' ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.08)] border border-brand-mist/50" : "text-brand-stone hover:text-brand-ink"
                        )}
                      >
                        Serviços Específicos
                      </button>
                    </div>

                    {serviceRestriction === 'specific' && (
                    <div className="p-6 bg-[#FCFBF9] border border-[#F2EFEA] rounded-[24px] space-y-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]">
                      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-brand-mist/50 gap-4">
                        <p className="text-[11px] text-brand-stone font-light leading-relaxed max-w-sm">
                          Selecione em quais serviços este cupom poderá ser aplicado.
                        </p>
                        {selectedServices.length > 0 && (
                          <button 
                            type="button" 
                            onClick={() => setSelectedServices([])}
                            className="text-[9px] font-bold text-brand-terracotta uppercase tracking-[0.2em] whitespace-nowrap self-start md:self-auto hover:text-brand-terracotta/80 transition-colors"
                          >
                            Limpar seleção
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {services.map(service => {
                          const isSelected = selectedServices.includes(service.id);
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedServices(selectedServices.filter(id => id !== service.id));
                                } else {
                                  setSelectedServices([...selectedServices, service.id]);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-4 p-4 rounded-[16px] border transition-all text-left",
                                isSelected ? "bg-brand-linen/50 border-brand-terracotta/40 shadow-sm" : "bg-white border-brand-mist/60 hover:border-brand-mist hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)]"
                              )}
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                isSelected ? "bg-brand-terracotta border-brand-terracotta" : "bg-white border-brand-mist"
                              )}>
                                {isSelected && <Check size={12} strokeWidth={3} className="text-white" />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-brand-ink truncate">{service.name}</span>
                                <span className="text-[10px] text-brand-stone/80 font-medium">{formatCurrency(service.price)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </div>

                  <div className="pt-6">
                    <PremiumButton 
                      type="submit"
                      variant="terracotta" 
                      className="w-full py-5 text-sm"
                      loading={isCreating}
                      loadingText="Criando cupom..."
                    >
                      Criar Cupom Promocional
                    </PremiumButton>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <UpgradeModal 
        open={isUpgradeModalOpen} 
        onClose={closeUpgradeModal}
        feature={upgradeFeature}
        count={usageCount}
      />
    </AppLayout>
  );
}
