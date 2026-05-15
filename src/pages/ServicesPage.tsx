import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, List, Plus, Trash2, Edit2, X, Clock, 
  DollarSign, Settings, Sparkles, ChevronRight, Info, Users,
  Wand2, Loader2, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { notify } from '../lib/notify';
import { formatCurrency, getHumanError, cn } from '../lib/utils';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import { UserProfile, Service } from '../types';
import { generateServiceDescription } from '../services/aiService';
import { FirstVisitTip } from '../components/FirstVisitTip';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { Skeleton } from '../components/ui/Skeleton';

export default function ServicesPage() {
  const { user, profile, isAuthReady } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [durationError, setDurationError] = useState(false);

  const DURATION_OPTIONS = [
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1h', value: 60 },
    { label: '1h30', value: 90 },
    { label: '2h', value: 120 },
    { label: '2h30', value: 150 },
    { label: '3h', value: 180 },
  ];

  const calculateSlots = (d: number) => {
    if (!d || d <= 0 || !profile?.workingHours) return 0;
    const start = profile.workingHours.startTime || '09:00';
    const end = profile.workingHours.endTime || '18:00';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    return Math.floor(total / d);
  };

  useEffect(() => {
    let isMounted = true;
    
    if (!isAuthReady) return;
    if (!user) {
      if (isMounted) setIsInitialLoading(false);
      return;
    }

    const fallbackTimeout = setTimeout(() => {
      if (isMounted) setIsInitialLoading(false);
    }, 4000);

    const q = query(collection(db, 'services'), where('professionalId', '==', user.uid));
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      if (!isMounted) return;

      try {
        const rawServices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
        const filtered = rawServices.filter(s => 
            s.active !== false &&
            s.name?.trim() &&
            Number(s.price) > 0
          ).map((s) => {
            let parsedDuration = Number(s.duration) || 0;
            if (parsedDuration < 15 || parsedDuration > 480) parsedDuration = 60;
            return {
              ...s,
              duration: parsedDuration
            };
          });
        const grouped = new Map<string, any[]>();
        filtered.forEach((s: any) => {
            const key = s.name.trim().toLowerCase().replace(/\s+/g, ' ');
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(s);
          });
        const uniqueServices = Array.from(grouped.values()).map(list => {
            if (list.length === 1) return list[0];
            
            // Critérios de desempate se houver duplicados:
            // 1. Tem descrição
            // 2. Mais recente (updatedAt ou createdAt)
            // 3. Primeiro da lista
            return [...list].sort((a, b) => {
              const aDesc = !!a.description?.trim();
              const bDesc = !!b.description?.trim();
              if (aDesc !== bDesc) return aDesc ? -1 : 1;
              
              const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
              const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
              return bTime - aTime;
            })[0];
          });
        setServices(uniqueServices);

        if (snapshot.empty && snapshot.metadata.fromCache) {
          // just wait
        } else {
          setIsInitialLoading(false);
          clearTimeout(fallbackTimeout);
        }
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
        setIsInitialLoading(false);
      }
    }, (error) => { 
        console.error("Firestore onSnapshot error:", error); 
        if (isMounted) setIsInitialLoading(false);
    });
    
    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      unsubscribe();
    };
  }, [user, isAuthReady]);

  const generateAIDescription = async () => {
    if (!name) {
      notify.error('Dê um nome ao serviço primeiro.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const specialty = profile?.professionalIdentity?.mainSpecialty || profile?.specialty || 'Beleza';
      const style = profile?.professionalIdentity?.serviceStyle?.[0] || 'elegante';
      
      const result = await generateServiceDescription({
        serviceName: name,
        professionalSpecialty: specialty,
        duration: duration,
        price: price,
        tone: style
      });

      let finalDescription = result.description?.trim() || '';
      
      // Se falhou completamente na rede ou retry, usar o fallback elegante local
      if (!finalDescription) {
        finalDescription = "Realça os cílios com leveza, mantendo um acabamento delicado e natural.";
      }

      // Sanitize: remove quotes at start/end and trim
      const sanitized = finalDescription.replace(/^["']|["']$/g, '').trim();
      setDescription(sanitized.slice(0, 160));
      
      if (result.source === 'fallback' || !result.description) {
        notify.success('Sugestão padrão adicionada. ✨');
      } else {
        notify.success('Descrição gerada com IA! ✨');
      }
    } catch (error: any) {
      console.error('[AI Generation] Error:', error);
      fetch('/api/health/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          source: 'ServicesPage generateAIDescription catch block',
        })
      }).catch(e => console.error(e));
      notify.error(`Erro IA: ${error.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDurationError(false);

    if (!duration || Number(duration) < 15 || Number(duration) > 480) {
      setDurationError(true);
      notify.error('Informe a duração do serviço (entre 15 e 480 min).');
      return;
    }

    setLoading(true);

    const professionalId = user?.uid;

    if (!professionalId) {
      notify.error('Sessão expirada. Por favor, faça login novamente.');
      setLoading(false);
      return;
    }

    try {
      const serviceData = {
        professionalId,
        name: name.trim(),
        description: description.trim(),
        duration: Number(duration) || 0,
        price: Number(price) || 0,
        category: category || 'Geral', // Ensure category is present
        active: true,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        const docRef = doc(db, 'services', editingId);
        await updateDoc(docRef, serviceData);
        notify.success('Serviço atualizado com sucesso.');
      } else {
        const colRef = collection(db, 'services');
        await addDoc(colRef, {
          ...serviceData,
          createdAt: new Date().toISOString()
        });
        notify.success('Novo serviço adicionado com sucesso.');
      }
      closeModal();
    } catch (error: any) {
      console.error('[SERVICE SAVE] failed:', error);
      const errorMessage = getHumanError(error) || 'Não foi possível salvar o serviço. Verifique os dados e tente novamente.';
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete));
      notify.success('Serviço removido.');
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (error: any) {
      console.error('[ServicesDelete] Error:', error);
      notify.error('Não foi possível concluir agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setServiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const openEdit = (service: any) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setDuration(service.duration.toString());
    setPrice(service.price.toString());
    setCategory(service.category);
    setShowCustomDuration(![30, 45, 60, 90, 120].includes(Number(service.duration)));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setDuration('');
    setPrice('');
    setCategory('');
    setShowCustomDuration(false);
  };

  return (
    <AppLayout activeRoute="services">
      <PageErrorBoundary 
        title="Não foi possível carregar seus serviços." 
      >
      <FirstVisitTip 
        pageKey="services"
        title="Seus serviços"
        description="Cadastre tudo o que você oferece. Use a nossa IA para criar descrições que vendem mais."
      />
      <div className="p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Seus Serviços</h1>
            <p className="text-brand-stone text-sm font-light">Gerencie seus serviços, preços e durações.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-brand-espresso transition-all"
          >
            <Plus size={20} /> Novo Serviço
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {isInitialLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-brand-white p-10 rounded-[40px] border border-brand-mist/50 shadow-sm overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex-1 pr-6 space-y-4">
                      <Skeleton className="h-8 w-48" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="w-11 h-11 rounded-2xl" />
                      <Skeleton className="w-11 h-11 rounded-2xl" />
                    </div>
                  </div>
                  <div className="flex items-center gap-8 pt-8 border-t border-brand-mist/50">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              ))}
            </>
          ) : services.length > 0 ? (
            services.map(service => (
              <motion.div 
                key={service.id} 
                layout 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-white p-6 sm:p-8 rounded-[32px] border border-brand-mist shadow-sm group relative overflow-hidden flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-brand-linen/50 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16 transition-transform group-hover:scale-110" />
                
                <div className="flex justify-between items-start mb-6 sm:mb-8 relative z-10 gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-lg sm:text-xl font-serif text-brand-ink mb-1.5 sm:mb-2 group-hover:text-brand-terracotta transition-colors leading-snug">{service.name}</h3>
                    <p className="text-brand-stone text-xs sm:text-sm font-light leading-relaxed line-clamp-2">{service.description || 'Nenhuma descrição adicionada.'}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0 bg-white/80 backdrop-blur-sm p-1 rounded-2xl border border-brand-mist/30">
                    <button onClick={() => openEdit(service)} className="p-2 hover:bg-brand-parchment rounded-xl text-brand-stone/60 hover:text-brand-ink transition-all">
                      <Edit2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button onClick={() => confirmDelete(service.id)} className="p-2 hover:bg-brand-linen rounded-xl text-brand-stone/60 hover:text-brand-terracotta transition-all">
                      <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-5 sm:gap-6 pt-5 sm:pt-6 border-t border-brand-mist/50 relative z-10">
                  <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-medium text-brand-stone uppercase tracking-widest">
                    <Clock size={12} className="text-brand-terracotta sm:w-3.5 sm:h-3.5" /> {service.duration} min
                  </div>
                  <div className="flex items-center gap-1.5 text-[15px] sm:text-lg font-serif italic text-brand-terracotta">
                    <DollarSign size={14} className="sm:w-4 sm:h-4 opacity-70" /> {formatCurrency(service.price).replace('R$', '').trim()}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="lg:col-span-2 py-32 text-center bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist">
              <div className="w-24 h-24 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta mx-auto mb-8">
                <List size={40} />
              </div>
              <h3 className="text-2xl font-serif font-normal text-brand-ink mb-3">Adicione seu primeiro serviço</h3>
              <p className="text-brand-stone text-sm font-light mb-10 max-w-xs mx-auto">Você precisa de pelo menos um serviço ativo para aparecer na sua página profissional.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest shadow-xl hover:bg-brand-espresso transition-all"
              >
                Criar meu primeiro serviço
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-brand-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-brand-mist"
              >
                <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-mist">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-serif font-normal mb-2 text-brand-ink">Excluir Serviço?</h3>
                <p className="text-brand-stone text-sm mb-8 font-light">Esta ação não pode ser desfeita. O serviço será removido permanentemente da sua agenda.</p>
                
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-xl disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={loading}
                    className="w-full bg-brand-parchment text-brand-stone py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all border border-brand-mist"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[110] flex items-center justify-center p-0 sm:p-6 overflow-hidden">
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 20 }}
                className="bg-brand-white w-full h-[100dvh] sm:h-auto max-w-[min(100vw,560px)] sm:rounded-[40px] p-8 sm:p-12 shadow-2xl relative border-x sm:border-y border-brand-mist overflow-y-auto no-scrollbar box-border mx-auto flex flex-col"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-brand-terracotta shrink-0" />
                <button onClick={closeModal} className="absolute right-6 top-8 sm:right-10 sm:top-10 text-brand-stone hover:text-brand-ink transition-colors z-10"><X size={24} /></button>
                
                <div className="mb-8 sm:mb-10 pr-8 shrink-0">
                  <h2 className="text-2xl sm:text-3xl font-serif font-normal text-brand-ink mb-2">{editingId ? 'Editar Serviço' : 'Novo Serviço'}</h2>
                  <p className="text-brand-stone text-xs sm:text-sm font-light">Preencha os detalhes para valorizar seu trabalho.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 flex-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Nome do Serviço</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Design de Sobrancelhas" className="w-full px-5 sm:px-6 py-3.5 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-base font-light min-w-0 box-border" required />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">Descrição (Opcional)</label>
                      <button 
                        type="button"
                        onClick={generateAIDescription}
                        disabled={isGeneratingAI || !name || !profile}
                        className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-terracotta hover:text-brand-sienna transition-colors disabled:opacity-40"
                      >
                        {isGeneratingAI ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Gerando...
                          </>
                        ) : !profile ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Carregando...
                          </>
                        ) : (
                          <>
                            <Wand2 size={12} /> Gerar com IA
                          </>
                        )}
                      </button>
                    </div>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que torna este serviço especial?" className="w-full px-5 sm:px-6 py-3.5 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink h-24 sm:h-28 resize-none transition-all font-light text-sm min-w-0 box-border" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">
                        Duração do Atendimento <span className="text-brand-terracotta">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DURATION_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setDuration(opt.value.toString());
                              setShowCustomDuration(false);
                            }}
                            className={cn(
                              "px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                              Number(duration) === opt.value && !showCustomDuration
                                ? "bg-brand-terracotta border-brand-terracotta text-brand-white shadow-md font-extrabold"
                                : "border-brand-mist text-brand-stone hover:border-brand-ink"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setShowCustomDuration(!showCustomDuration)}
                          className={cn(
                            "px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                            showCustomDuration
                              ? "bg-brand-ink border-brand-ink text-brand-white"
                              : "border-brand-mist text-brand-stone hover:border-brand-ink shadow-sm"
                          )}
                        >
                          {showCustomDuration ? 'Voltar' : 'Personalizado'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {showCustomDuration && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative"
                          >
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={14} />
                            <input 
                              type="number" 
                              min="15"
                              max="480"
                              step="15"
                              value={duration} 
                              onChange={(e) => setDuration(e.target.value)} 
                              placeholder="60" 
                              className={cn(
                                "w-full pl-11 pr-4 py-3 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm min-w-0",
                                durationError ? "border-brand-terracotta" : "border-brand-mist"
                              )}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-stone uppercase tracking-widest">min</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {durationError && (
                        <div className="flex items-center gap-1.5 text-[10px] text-brand-terracotta font-bold uppercase tracking-wider ml-1">
                          <AlertCircle size={12} /> Informe a duração do serviço (15 a 480 min).
                        </div>
                      )}

                      <div className="bg-brand-linen/40 p-4 rounded-3xl border border-dashed border-brand-mist/50">
                        <p className="text-[9px] text-brand-stone font-medium uppercase tracking-wider leading-relaxed mb-1">
                          A duração define os horários disponíveis para suas clientes.
                        </p>
                        {Number(duration) > 0 && (
                          <p className="text-[9px] text-brand-stone font-light italic leading-relaxed">
                            {calculateSlots(Number(duration))} atendimentos possíveis por dia.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Preço (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={14} />
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="w-full pl-11 pr-4 py-3 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm min-w-0" required />
                      </div>
                    </div>
                  </div>

                  <div className="bg-brand-linen p-5 sm:p-6 rounded-2xl flex gap-4 items-start border border-brand-mist">
                    <Info size={18} className="text-brand-terracotta shrink-0 mt-0.5" />
                    <p className="text-[9px] sm:text-[10px] text-brand-stone font-medium uppercase leading-relaxed tracking-wider">
                      Serviços com descrições detalhadas e preços claros geram mais agendamentos imediatos.
                    </p>
                  </div>

                  <div className="pt-2 pb-[calc(140px+env(safe-area-inset-bottom))] sm:pb-0">
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="w-full bg-brand-ink text-brand-white py-5 sm:py-6 rounded-full text-[11px] font-medium uppercase tracking-widest shadow-xl hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                      {loading ? 'Salvando...' : editingId ? 'Atualizar Serviço' : 'Criar Serviço'} <ChevronRight size={18} />
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
      </PageErrorBoundary>
    </AppLayout>
  );
}
