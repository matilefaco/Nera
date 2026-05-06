import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Tag, Calendar, Users, 
  Trash2, ToggleLeft, ToggleRight, 
  X, Check, AlertCircle, Info,
  Percent, CircleSlash, ArrowLeft
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
  const { user } = useAuth();
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
    if (!user) return;

    const q = query(
      collection(db, 'coupons'),
      where('professionalId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
setCoupons(data.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
setLoading(false);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => { console.error("Firestore onSnapshot error:", error); });

    const fetchServices = async () => {
      const sQuery = query(collection(db, 'services'), where('professionalId', '==', user.uid));
      const sSnap = await getDocs(sQuery);
      setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    };

    fetchServices();
    return () => unsubscribe();
  }, [user]);

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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-brand-linen/20 rounded-[32px] animate-pulse" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-20 bg-brand-white rounded-[40px] border border-brand-mist shadow-sm">
            <div className="w-16 h-16 bg-brand-linen text-brand-stone/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <Tag size={24} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2">Nenhum cupom ainda</h3>
            <p className="text-sm text-brand-stone font-light max-w-xs mx-auto mb-8">
              Cupons são ótimos para atrair novas clientes ou fidelizar as atuais.
            </p>
            <button 
              onClick={() => {
                if (checkFeatureAccess('coupons')) {
                  setIsModalOpen(true);
                }
              }}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-terracotta hover:scale-105 transition-transform"
            >
              Criar meu primeiro cupom
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
                          "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase",
                          coupon.active ? "bg-green-100 text-green-700" : "bg-brand-linen text-brand-stone"
                        )}>
                          {coupon.active ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleCouponStatus(coupon)}
                          className="p-2 text-brand-stone hover:text-brand-ink transition-colors"
                          title={coupon.active ? 'Desativar' : 'Ativar'}
                        >
                          {coupon.active ? <ToggleRight size={24} className="text-brand-terracotta" /> : <ToggleLeft size={24} />}
                        </button>
                        <button 
                          onClick={() => setIsDeleting(coupon.id)}
                          className="p-2 text-brand-stone hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-2xl font-serif text-brand-ink tracking-tight mb-1">{coupon.code}</h4>
                        <p className="text-[10px] text-brand-terracotta font-bold uppercase tracking-widest">
                          {coupon.type === 'percentage' ? `${coupon.value}% de desconto` : `${formatCurrency(coupon.value)} de desconto`}
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-brand-mist/30">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone/60">Usos</span>
                            <p className="text-xs font-medium text-brand-ink">
                              {coupon.usedCount} {coupon.maxUses ? `/ ${coupon.maxUses}` : 'ilimitados'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone/60">Validade</span>
                            <p className="text-xs font-medium text-brand-ink">
                              {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('pt-BR') : 'Sem expiração'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone/60">Serviços</span>
                            <p className="text-[10px] text-brand-stone italic truncate">
                              {coupon.applicableServiceIds && coupon.applicableServiceIds.length > 0 
                                ? `Válido p/ ${coupon.applicableServiceIds.length} serviços` 
                                : 'Todos os serviços'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone/60">Limite por Cliente</span>
                            <p className="text-[10px] text-brand-stone italic">
                              {coupon.perClientLimit === 1 ? '1 vez por cliente' : 'Ilimitado'}
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
              className="bg-brand-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl border border-brand-mist text-center"
            >
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-xl font-serif text-brand-ink mb-2">Excluir cupom?</h3>
              <p className="text-xs text-brand-stone font-light mb-8 italic">
                Esta ação não pode ser desfeita. Clientes que já têm este código salvo não poderão mais usá-lo.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteCoupon(isDeleting)}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
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

                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Tag className="text-brand-terracotta" size={24} />
                    <h2 className="text-2xl font-serif text-brand-ink italic">Novo Cupom</h2>
                  </div>
                  <p className="text-xs text-brand-stone font-light italic">Defina as regras de desconto para suas clientes.</p>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Código do Cupom</label>
                      <input 
                        type="text" 
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Ex: PRIMEIRA10"
                        className="w-full px-6 py-4 bg-brand-white border border-brand-mist rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-ink uppercase font-mono tracking-widest"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Tipo de Desconto</label>
                      <div className="flex bg-brand-white p-1 rounded-2xl border border-brand-mist">
                        <button 
                          type="button" 
                          onClick={() => setType('percentage')}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            type === 'percentage' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                          )}
                        >
                          Porcentagem (%)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setType('fixed')}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            type === 'fixed' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                          )}
                        >
                          Valor Fixo (R$)
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Valor do Desconto</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={type === 'percentage' ? "Ex: 10" : "Ex: 15"}
                          className="w-full px-6 py-4 bg-brand-white border border-brand-mist rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-ink"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-stone/40 font-bold uppercase tracking-widest text-[10px]">
                          {type === 'percentage' ? '%' : 'Reais'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Limite de Usos (Opcional)</label>
                      <input 
                        type="number" 
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        placeholder="Vazio para ilimitado"
                        className="w-full px-6 py-4 bg-brand-white border border-brand-mist rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-ink"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Data de Expiração (Opcional)</label>
                      <input 
                        type="date" 
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full px-6 py-4 bg-brand-white border border-brand-mist rounded-2xl text-xs outline-none focus:ring-1 focus:ring-brand-ink"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Limite por Cliente</label>
                      <div className="flex bg-brand-white p-1 rounded-2xl border border-brand-mist">
                        <button 
                          type="button" 
                          onClick={() => setPerClientLimit(null)}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            perClientLimit === null ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                          )}
                        >
                          Ilimitado
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPerClientLimit(1)}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            perClientLimit === 1 ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                          )}
                        >
                          1 por cliente
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-1">Serviços Aplicáveis</label>
                    
                    <div className="flex bg-brand-white p-1 rounded-2xl border border-brand-mist mb-4">
                      <button 
                        type="button" 
                        onClick={() => setServiceRestriction('all')}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                          serviceRestriction === 'all' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                        )}
                      >
                        Todos os Serviços
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setServiceRestriction('specific')}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                          serviceRestriction === 'specific' ? "bg-brand-ink text-brand-white shadow-md" : "text-brand-stone hover:bg-brand-parchment"
                        )}
                      >
                        Serviços Específicos
                      </button>
                    </div>

                    {serviceRestriction === 'specific' && (
                    <div className="p-6 bg-brand-white border border-brand-mist rounded-3xl space-y-4">
                      <div className="flex items-center justify-between pb-4 border-b border-brand-mist/50">
                        <p className="text-[10px] text-brand-stone font-light italic">
                          Selecione os serviços que podem usar este cupom.
                        </p>
                        {selectedServices.length > 0 && (
                          <button 
                            type="button" 
                            onClick={() => setSelectedServices([])}
                            className="text-[9px] font-bold text-brand-terracotta uppercase tracking-widest"
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
                                "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                isSelected ? "bg-brand-linen border-brand-terracotta/30" : "bg-brand-parchment border-brand-mist/50 hover:border-brand-mist"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                                isSelected ? "bg-brand-terracotta border-brand-terracotta" : "bg-white border-brand-mist"
                              )}>
                                {isSelected && <Check size={10} className="text-white" />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-medium text-brand-ink truncate">{service.name}</span>
                                <span className="text-[9px] text-brand-stone font-bold">{formatCurrency(service.price)}</span>
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
                      variant="terracotta" 
                      className="w-full py-6"
                      loading={isCreating}
                      loadingText="Criando cupom..."
                    >
                      Criar Cupom de Desconto
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
