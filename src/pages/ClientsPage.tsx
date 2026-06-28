import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { isRevenueStatus, isCancelledStatus, APPOINTMENT_STATUS } from '../constants/appointmentStatus';
import { db, updateClientSummaryFromAppointment } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, getDoc, startAfter, QueryDocumentSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Users, Search, MessageCircle, 
  TrendingUp, Calendar, ChevronRight, Star,
  X, AlertCircle, RefreshCw, ChevronDown, Lock, Zap
} from 'lucide-react';
import { formatCurrency, buildWhatsappLink, cn } from '../lib/utils';
import AppLayout from '../components/AppLayout';
import { ListCardSkeleton } from '../components/ui/ListCardSkeleton';
import { ClientSummary, Appointment } from '../types';
import PremiumButton from '../components/PremiumButton';
import { notify } from '../lib/notify';
import { exportClientsCsv } from '../lib/exportCsv';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

const PAGE_SIZE = 50;

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import UpgradeModal from '../components/UpgradeModal';
import { PageErrorBoundary } from '../components/PageErrorBoundary';

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));
const devLog = (...args: any[]) => isDev && console.log(...args);

const ClientNotes = ({
  client,
  onSave
}: {
  client: ClientSummary;
  onSave: (clientId: string, notes: string) => Promise<void>;
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState(client.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    if (client.notes !== undefined) {
      setNotes(client.notes);
      return;
    }
    
    let isMounted = true;
    const fetchNote = async () => {
      if (!user) return;
      setLoadingNotes(true);
      try {
        const noteDoc = await getDoc(doc(db, 'users', user.uid, 'client_notes', client.id));
        if (isMounted) {
          if (noteDoc.exists()) {
            setNotes(noteDoc.data().notes || '');
          }
        }
      } catch (err) {
        if (isDev) console.error("Failed to load client note:", err);
      } finally {
        if (isMounted) setLoadingNotes(false);
      }
    };
    fetchNote();
    
    return () => {
      isMounted = false;
    };
  }, [client.id, client.notes, user]);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaving(true);
    setSaved(false);
    try {
      if (typeof notes !== 'string') {
        throw new Error('Notas inválidas');
      }
      await onSave(client.id, notes || '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      notify.error(e.message || 'Erro interno ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-brand-mist/60 space-y-3.5 animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest text-brand-stone/80">
          Notas privadas
        </label>
        {saved && (
          <span className="text-[10px] text-green-600 font-medium animate-in fade-in">
            Salvo
          </span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ex: alérgica a produto X, prefere manhã, aniversário em março..."
        className="w-full bg-brand-linen/30 border border-brand-mist rounded-xl p-3.5 text-sm text-brand-ink placeholder:text-brand-stone/40 focus:outline-none focus:border-brand-stone focus:ring-1 focus:ring-brand-stone min-h-[80px] resize-y"
      />
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-brand-stone/70 italic">
          Visível apenas para você.
        </span>
        <button
          onClick={handleSave}
          disabled={isSaving || (client.id.startsWith('derived_'))}
          className={cn(
            "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
            isSaving 
              ? "bg-brand-mist text-brand-stone opacity-70"
              : "bg-brand-ink text-brand-white hover:bg-brand-stone shadow-sm"
          )}
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};

interface ClientsCacheEntry {
  data: ClientSummary[];
  fetchedAt: number;
}

interface EnrichedClient extends Omit<ClientSummary, 'segment'> {
  segment: 'vip' | 'recurring' | 'new' | 'at_risk' | 'inactive' | 'active';
  appts90: number;
  daysSince: number;
}

const CLIENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const clientsPageCache = new Map<string, ClientsCacheEntry>();

export default function ClientsPage() {
  const { user, profile } = useAuth();
  const { 
    isUpgradeModalOpen, 
    upgradeFeature, 
    usageCount, 
    closeUpgradeModal, 
    checkFeatureAccess 
  } = useUpgradeTriggers();

  const { plan, isProPlan } = usePlanFeatures();

  const [clientsStatus, setClientsStatus] = useState<'idle' | 'loading' | 'loaded' | 'stalled' | 'error'>(() => {
    return user && clientsPageCache.has(user.uid) ? 'loaded' : 'loading';
  });
  const [clients, setClients] = useState<ClientSummary[]>(() => {
    return user ? (clientsPageCache.get(user.uid)?.data || []) : [];
  });
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [isIntelligenceExpanded, setIsIntelligenceExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // Reset progressive loading when filters or search change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm, filterService, filterStatus]);



  const handleUpdateNotes = async (clientId: string, newNotes: string) => {
    if (!user || clientId.startsWith('derived_')) {
      if (clientId.startsWith('derived_')) {
        notify.info('Este é um cliente derivado de agendamentos antigos e não possui cadastro completo para notas. Sincronize o histórico primeiro.');
      }
      throw new Error('derived_client');
    }
    try {
      const safeNotes = newNotes || '';
      await setDoc(
        doc(db, 'users', user.uid, 'client_notes', clientId),
        { 
          clientId, 
          notes: safeNotes, 
          updatedAt: serverTimestamp() 
        },
        { merge: true }
      );
      setClients(prev => prev.map(c => {
        if (c.id === clientId) {
          return { ...c, notes: safeNotes };
        }
        return c;
      }));
    } catch (err: any) {
      const isPermissionErr = err.message && (
        err.message.includes('permission') || 
        err.message.includes('not authorized') || 
        err.message.includes('Missing or insufficient')
      );
      if (isPermissionErr) {
        throw new Error('Sem permissão para salvar esta nota.');
      }
      throw new Error('Erro ao salvar notas no banco.');
    }
  };

  const uniqueServices = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c: any) => {
      if (c.services && Array.isArray(c.services)) {
        c.services.forEach((srv: string) => {
          if (srv && typeof srv === 'string' && srv.trim().length > 0) s.add(srv.trim());
        });
      } else if (c.lastServiceName && typeof c.lastServiceName === 'string' && c.lastServiceName.trim().length > 0) {
        s.add(c.lastServiceName.trim());
      }
    });
    return Array.from(s).sort();
  }, [clients]);

  const isActive = (c: ClientSummary) => {
    if (!c.lastAppointmentDate) return false;
    return getDaysSinceLastVisit(c.lastAppointmentDate) <= 30;
  };

  // Helper to calculate days since last visit
  const getDaysSinceLastVisit = (dateStr: string) => {
    if (!dateStr) return 999;
    const today = new Date();
    const parseString = dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr;
    const last = new Date(parseString);
    if (isNaN(last.getTime())) return 999;
    const diffTime = Math.abs(today.getTime() - last.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    vip: 0,
    risk: 0
  });

  const fetchClients = useCallback(async (isLoadMore = false) => {
    if (!user) {
      setClientsStatus('error');
      return;
    }
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setClientsStatus(prev => prev === 'loaded' ? 'loaded' : 'loading');
    }

    // Fallback to clear stall state
    const stallTimeout = !isLoadMore ? setTimeout(() => {
      setClientsStatus(prev => prev === 'loading' ? 'stalled' : prev);
    }, 2000) : null;

    try {
      const collRef = collection(db, 'client_summaries');

      let finalQ;
      if (isLoadMore && lastVisible) {
        finalQ = query(
          collRef,
          where('professionalId', '==', user.uid),
          orderBy('lastAppointmentDate', 'desc'),
          startAfter(lastVisible),
          limit(50)
        );
      } else {
        finalQ = query(
          collRef,
          where('professionalId', '==', user.uid),
          orderBy('lastAppointmentDate', 'desc'),
          limit(50)
        );
      }

      const snapshot = await getDocs(finalQ);
      
      if (stallTimeout) clearTimeout(stallTimeout);
      
      const newDocs = snapshot.docs.map(docSnap => {
        const data = docSnap.data() as any;
        return { 
          id: docSnap.id,
          ...data,
          clientName: data.clientName || 'Cliente',
          clientPhone: data.clientPhone || '',
          totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 0,
          totalAppointments: typeof data.totalAppointments === 'number' ? data.totalAppointments : 0,
          lastAppointmentDate: data.lastAppointmentDate ? new Date(data.lastAppointmentDate).toISOString() : new Date().toISOString()
        } as ClientSummary;
      });
      
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      setHasMore(snapshot.docs.length === 50);

      setClients(prev => {
        const result = isLoadMore ? [...prev, ...newDocs] : newDocs;
        // Optional caching only for initial load
        if (!isLoadMore) {
          clientsPageCache.set(user.uid, { data: result, fetchedAt: Date.now() });
        }
        return result;
      });
      setClientsStatus('loaded');
    } catch (err: any) {
      if (stallTimeout) clearTimeout(stallTimeout);
      if (isDev) console.error('[ClientsPage] Failed to load clients', err);
      if (err.message && err.message.includes('index')) {
        if (isDev) console.log('[ClientsPage] Composite index required for client_summaries: professionalId ASC, lastAppointmentDate DESC.');
      } else {
        notify.error('Erro ao carregar clientes. Tente novamente mais tarde.');
      }
      if (!isLoadMore) {
        setHasMore(false);
        setClientsStatus('error');
      }
    } finally {
      setLoadingMore(false);
    }
  }, [user, lastVisible]);

  useEffect(() => {
    let isMounted = true;
    
    // Fallback de segurança para garantir que a tela não fique presa no skeleton
    // se o Firebase demorar para responder (falta de índice ou lentidão extrema)
    const timeout = setTimeout(() => {
      if (isMounted) setClientsStatus('loaded');
    }, 5000);

    fetchClients(false).finally(() => {
      if (isMounted) {
        clearTimeout(timeout);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [user]);

  const handleMigrate = async () => {
    if (!user) return;
    setIsMigrating(true);
    notify.info('Iniciando atualização inteligente da base de clientes...', {
      description: 'Isso pode processar dados. Por favor, aguarde.'
    });

    try {
      let count = 0;
      const MAX_MIGRATION_DOCS = 3000;
      
      const batchMap = new Map<string, any>();
      
      const q = query(
        collection(db, 'appointments'), 
        where('professionalId', '==', user.uid)
      );

      const snap = await getDocs(q);
      
      if (snap.empty) {
        notify.info('Não há agendamentos para migrar.');
        setIsMigrating(false);
        return;
      }

      let appointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      appointments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      
      if (appointments.length > MAX_MIGRATION_DOCS) {
        appointments = appointments.slice(0, MAX_MIGRATION_DOCS);
        notify.warning('Muitos registros encontrados', {
          description: `Sincronizamos os mais recentes (${MAX_MIGRATION_DOCS}). Para uma migração total de histórico gigante, use uma rotina administrativa fora do app.`
        });
      }

      for (const appt of appointments as Array<Appointment & { clientPhone?: string; customerPhone?: string; customerEmail?: string }>) {
        if (!appt.clientName || !appt.date) continue;
        
        const phone = appt.clientWhatsapp || appt.clientPhone || appt.customerPhone || '';
        const key = phone ? phone.replace(/\D/g, '') : appt.clientName.toLowerCase().trim();
        const summaryId = `${user.uid}_${key}`;
        
        const serviceNames = appt.additionalServices?.length > 0 
          ? [appt.serviceName, ...appt.additionalServices.map((s:any) => s.name)].join(" e ")
          : appt.serviceName || '';
          
        const existing = batchMap.get(summaryId) || {
          professionalId: user.uid,
          clientKey: key,
          clientName: appt.clientName || 'Cliente',
          clientPhone: phone,
          clientEmail: appt.clientEmail || appt.customerEmail || '',
          totalAppointments: 0,
          confirmedAppointments: 0,
          cancelledAppointments: 0,
          noShowCount: 0,
          totalSpent: 0,
          firstAppointmentDate: appt.date,
          lastAppointmentDate: appt.date,
          lastServiceId: appt.serviceId || '',
          lastServiceName: serviceNames,
          segment: 'new',
          notes: '',
          services: []
        };
        
        const isConfirmed = isRevenueStatus(appt.status);
        const isCancelled = isCancelledStatus(appt.status);
        const isNoShow = appt.status === APPOINTMENT_STATUS.NO_SHOW;
        
        if (isConfirmed || isCancelled || isNoShow) {
          existing.totalAppointments += 1;
        }

        if (isConfirmed) {
          existing.confirmedAppointments += 1;
          existing.totalSpent += (appt.totalPrice ?? appt.finalPrice ?? ((Number(appt.price) || 0) + (Number(appt.travelFee) || 0)));
        }
        if (isNoShow) existing.noShowCount += 1;
        if (isCancelled) existing.cancelledAppointments += 1;
        
        if (!existing.services) existing.services = [];
        if (!existing.services.includes(serviceNames) && serviceNames) {
          existing.services.push(serviceNames);
        }
        
        if (appt.date > existing.lastAppointmentDate) {
          existing.lastAppointmentDate = appt.date;
          existing.lastServiceId = appt.serviceId || '';
          existing.lastServiceName = serviceNames;
        }
        if (appt.date < existing.firstAppointmentDate) {
          existing.firstAppointmentDate = appt.date;
        }
        
        batchMap.set(summaryId, existing);
        count++;
      }
      
      // Write to Firestore in batches
      const { writeBatch, doc } = await import('firebase/firestore');
      const chunks = Array.from(batchMap.entries()).reduce((resultArray, item, index) => { 
        const chunkIndex = Math.floor(index/500);
        if(!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = []; // start a new chunk
        }
        resultArray[chunkIndex].push(item);
        return resultArray;
      }, [] as [string, any][][]);
      
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(([id, data]) => {
          const ref = doc(db, 'client_summaries', id);
          batch.set(ref, data, { merge: true });
        });
        await batch.commit();
      }

      notify.success('Base de clientes sincronizada!', {
        description: `${batchMap.size} clientes únicos processados a partir de ${count} reservas resgatadas.`
      });
      
      // Refresh the page data
      setClients([]);
      fetchClients(); // Refresh
    } catch (err) {
      if (isDev) console.error('[Migration] Failed:', err);
      notify.error('Falha na migração automática.');
    } finally {
      setIsMigrating(false);
    }
  };

  const segmentationThresholds = useMemo(() => {
    if (clients.length === 0) return { threshold20: 0, avgTicket: 0 };
    
    const ltvs = clients.map(c => c.totalSpent).sort((a, b) => b - a);
    // Para top 20%, precisamos pegar o índice correspondente à quantidade (teto) e subtrair 1
    // Ex: 5 clientes. top 20% = 1 cliente. Índice [0].
    const idx20 = Math.max(0, Math.ceil(ltvs.length * 0.2) - 1);
    const threshold20 = ltvs[idx20] || 0;
    
    const totalLTV = ltvs.reduce((acc, val) => acc + val, 0);
    const totalAppts = clients.reduce((acc, c) => acc + (c.confirmedAppointments || 0), 0);
    const avgTicket = totalAppts > 0 ? totalLTV / totalAppts : 0;
    
    return { threshold20, avgTicket };
  }, [clients]);

  const enrichedClients = useMemo<EnrichedClient[]>(() => {
    return clients.map(c => {
      const daysSince = c.lastAppointmentDate ? getDaysSinceLastVisit(c.lastAppointmentDate) : 999;
      
      // Segmentation Logic
      let segment: any = 'new';
      
      const hasBaseForVip = clients.length >= 5;
      
      // Regras de segmentação baseadas na lógica de negócio refinada
      if (hasBaseForVip && c.totalSpent > 0 && c.totalSpent >= segmentationThresholds.threshold20) {
        // VIP: Pelo menos 5 clientes na base, e faturamento no top 20%. Sem rigidez cega de número de agendamentos.
        segment = 'vip';
      } else if (c.confirmedAppointments >= 2 && daysSince <= 60) {
        // FREQUENTE: Recorrência real recente (2+ atendimentos, retorno em até 60 dias)
        segment = 'recurring';
      } else if (c.confirmedAppointments >= 1 && daysSince > 120) {
        // AUSENTE: Sem retorno há mais de 120 dias
        // TODO: Num futuro próximo, este threshold deve ser dinâmico por especialidade (ex: Tranças = 90d, Sobrancelhas = 30d)
        segment = 'inactive';
      } else if (c.confirmedAppointments >= 1 && daysSince > 60) {
        // ESFRIANDO: Histórico anterior, sem retorno num período moderado (entre 60 e 120 dias)
        segment = 'at_risk';
      } else if (c.confirmedAppointments === 1 && daysSince <= 60) {
        // NOVA: Apenas 1 atendimento recente
        segment = 'new';
      } else {
        segment = 'active';
      }

      // We rely on confirmedAppointments for 'appts90' proxy in UI since we don't fetch all appts to filter precisely by 90 days.
      const appts90 = c.confirmedAppointments;

      return { ...c, segment, appts90, daysSince } as EnrichedClient;
    });
  }, [clients, segmentationThresholds]);

  const filteredClients = useMemo(() => {
    return enrichedClients
      .filter(client => {
        const matchSearch = (client.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (client.clientPhone || '').includes(searchTerm);
        
        let matchService = true;
        if (filterService) {
          const normalizedFilterService = filterService.toLowerCase().trim();
          const hasInServices = client.services && Array.isArray(client.services) && 
            client.services.some(s => typeof s === 'string' && s.toLowerCase().trim() === normalizedFilterService);
          const hasInLastService = typeof client.lastServiceName === 'string' && 
            client.lastServiceName.toLowerCase().trim() === normalizedFilterService;
          
          matchService = Boolean(hasInServices || hasInLastService);
        }
        
        const matchStatus = filterStatus === "all" || client.segment === filterStatus;
          
        return matchSearch && matchService && matchStatus;
      })
      .sort((a, b) => {
        const nameA = a.clientName || '';
        const nameB = b.clientName || '';
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [enrichedClients, searchTerm, filterService, filterStatus]);

  const visibleClients = useMemo(() => {
    return filteredClients.slice(0, visibleCount);
  }, [filteredClients, visibleCount]);

  const groupedClients = useMemo(() => {
    const groups: { [key: string]: EnrichedClient[] } = {};
    visibleClients.forEach(client => {
      const name = client.clientName || 'Cliente';
      const firstLetter = name[0]
        ? name[0].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        : 'A';
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(client);
    });
    return groups;
  }, [visibleClients]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedClients).sort();
  }, [groupedClients]);

  const handleLoadMore = useCallback(() => {
    const hasMoreInLocal = filteredClients.length > visibleCount;
    if (hasMoreInLocal) {
      setVisibleCount(prev => prev + 10);
    } else if (hasMore) {
      fetchClients(true);
      setVisibleCount(prev => prev + 10);
    }
  }, [filteredClients.length, visibleCount, hasMore, fetchClients]);

      if ((clientsStatus === 'loading' || clientsStatus === 'stalled') && clients.length === 0) {
        return (
          <AppLayout activeRoute="clients">
            <div className="relative p-6 md:p-12 pb-32 max-w-5xl mx-auto w-full animate-in fade-in duration-700">
              {clientsStatus === 'stalled' && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white shadow-xl rounded-2xl p-4 flex gap-3 items-center text-brand-ink text-sm border border-brand-mist animate-in fade-in duration-300">
                     <AlertCircle size={16} className="text-brand-terracotta" />
                     <span className="font-serif">Sincronizando clientes...</span>
                 </div>
              )}
              <header className="mb-12">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#FAF9F8] border border-brand-mist/40 rounded-xl text-brand-stone/40">
                    <Users size={24} />
                  </div>
                  <h1 className="text-4xl font-serif text-brand-ink">Seus Clientes</h1>
                </div>
              </header>
              <div className="flex flex-col gap-4 opacity-70">
                {[1, 2, 3, 4, 5].map((i) => (
                  <ListCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </AppLayout>
        );
      }

  return (
    <AppLayout activeRoute="clients">
      <PageErrorBoundary 
        title="Não foi possível carregar seus clientes." 
      >
      <div className="p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Clientes</h1>
            <p className="text-brand-stone font-light text-sm">Veja quem voltou, quem sumiu e quem vale chamar de novo.</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            {clients.length > 0 && (
              <button 
                data-capture-hide="true"
                onClick={() => {
                  if (plan === 'free') {
                    checkFeatureAccess('exportCsv');
                    return;
                  }
                  user && exportClientsCsv(user.uid);
                }}
                className={cn(
                  "px-6 py-4 text-[10px] font-bold uppercase tracking-widest border rounded-full transition-all flex items-center justify-center gap-2",
                  plan === 'free' 
                    ? "bg-brand-white text-brand-stone border-brand-mist hover:bg-brand-mist/20" 
                    : "bg-brand-white text-brand-ink hover:border-brand-mist border-brand-mist shadow-sm"
                )}
              >
                {plan === 'free' && <Lock size={12} className="text-brand-stone" />} Exportar CSV
              </button>
            )}
            {clients.length === 0 && clientsStatus === 'loaded' && (
              <PremiumButton 
                onClick={handleMigrate} 
                disabled={isMigrating}
                variant="linen" 
                className="text-[10px] py-4 px-6 flex items-center gap-2"
              >
                {isMigrating ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sincronizar Base Histórica
              </PremiumButton>
            )}
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-10">
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[10px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Total de Clientes</p>
            <p className="text-2xl sm:text-3xl font-serif text-brand-ink leading-none">{clients.length}{hasMore ? '+' : ''}</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[10px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Novas Atendidas (30D)</p>
            <p className="text-2xl sm:text-3xl font-serif text-brand-ink leading-none">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) < 30 && c.confirmedAppointments === 1).length}</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[10px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Atendidas Recentemente</p>
            <p className="text-2xl sm:text-3xl font-serif text-green-600/90 leading-none">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) < 30).length}</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[10px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Ticket Médio Geral</p>
            <p className="text-xl sm:text-2xl font-serif text-brand-ink leading-none">{formatCurrency((clients.reduce((acc, curr) => acc + curr.totalSpent, 0) / Math.max(1, clients.reduce((acc, curr) => acc + curr.confirmedAppointments, 0))))}</p>
          </div>
        </div>

        {/* Inteligência de Clientes - Compact & Expandable */}
        <div className="mb-8">
          {isProPlan() ? (() => {
            const atRisk = enrichedClients.filter(c => c.segment === 'at_risk' || c.segment === 'inactive');
            const potentialRev = atRisk.reduce((acc, curr) => acc + ((curr.totalSpent / curr.confirmedAppointments) || 0), 0);
            const vip = enrichedClients.filter(c => c.segment === 'vip');
            const recent = enrichedClients.filter(c => c.confirmedAppointments >= 1 && c.daysSince < 30);
            const topOpps = [...atRisk].sort((a,b) => b.totalSpent - a.totalSpent).slice(0, 3);
            
            const hasEnoughData = enrichedClients.filter(c => c.confirmedAppointments >= 1).length >= 3;
            
            if (!hasEnoughData) {
              return (
                <div className="p-4 rounded-[20px] border border-dashed border-brand-mist/80 bg-brand-white/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-linen rounded-full hidden sm:flex items-center justify-center shrink-0">
                       <TrendingUp size={16} className="text-brand-terracotta" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-ink mb-1">Em breve você verá oportunidades de crescimento aqui</h3>
                      <p className="text-xs text-brand-stone leading-relaxed">
                        Continue registrando atendimentos pela Nera. Quando houver histórico suficiente, você começará a descobrir quais clientes podem voltar, onde existe faturamento parado e quais horários podem virar novas reservas.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-4">
                {/* Compact Card */}
                <div 
                  className="p-4 rounded-[20px] border border-brand-terracotta/20 bg-[#FFF4F0]/40 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:bg-[#FFF4F0]/60 transition-colors shadow-sm"
                  onClick={() => setIsIntelligenceExpanded(!isIntelligenceExpanded)}
                >
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 border border-brand-terracotta/10 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                        <Zap size={16} className="text-brand-terracotta" />
                     </div>
                     <div>
                        <h3 className="text-sm font-bold text-brand-ink uppercase tracking-widest flex items-center gap-2 mb-1">
                          Inteligência de Clientes
                        </h3>
                        <p className="text-xs text-brand-stone leading-relaxed">
                          <span className="font-bold text-brand-terracotta">{atRisk.length} clientes</span> para chamar de volta • <span className="font-bold text-brand-terracotta">{formatCurrency(potentialRev)}</span> em faturamento parado
                        </p>
                     </div>
                  </div>
                  <button className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest px-4 py-2 bg-white rounded-full border border-brand-terracotta/20 hover:bg-brand-terracotta hover:text-white transition-colors shrink-0">
                    {isIntelligenceExpanded ? 'Fechar análise' : 'Ver oportunidades'}
                  </button>
                </div>

                {/* Expanded View */}
                {isIntelligenceExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden"
                  >
                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#FFF4F0]/60 p-5 rounded-[20px] border border-brand-terracotta/10 flex flex-col justify-between">
                        <p className="text-[10px] font-bold text-brand-terracotta uppercase tracking-widest mb-3">Faturamento Parado</p>
                        <div>
                          <p className="text-3xl font-serif text-brand-ink leading-none mb-1">{formatCurrency(potentialRev)}</p>
                          <p className="text-[10px] text-brand-stone font-light">Até este valor pode ser recuperado se as {atRisk.length} clientes em risco voltarem.</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-rows-2 gap-4">
                        <div className="bg-brand-white p-5 rounded-[20px] border border-brand-mist/60 flex items-center justify-between shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)]">
                          <div>
                            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Clientes VIP</p>
                            <p className="text-xl font-serif text-brand-ink leading-none">{vip.length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-brand-ink/5 flex items-center justify-center">
                            <Star size={16} className="text-brand-ink" />
                          </div>
                        </div>
                        <div className="bg-brand-white p-5 rounded-[20px] border border-brand-mist/60 flex items-center justify-between shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)]">
                          <div>
                            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Voltas Recentes</p>
                            <p className="text-xl font-serif text-green-600 leading-none">{recent.length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                            <TrendingUp size={16} className="text-green-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-brand-ink text-white p-5 rounded-[20px] flex flex-col shadow-md">
                      <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-4">Clientes para chamar de volta</p>
                      {topOpps.length > 0 ? (
                        <div className="flex flex-col gap-3 flex-1">
                          {topOpps.map(opp => {
                            const avgTicket = opp.totalSpent / Math.max(1, opp.confirmedAppointments);
                            return (
                              <div key={opp.id} className="bg-white/10 p-3 rounded-[12px] flex flex-col gap-1.5 border border-white/5 hover:bg-white/20 transition-colors">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold truncate max-w-[120px]">{opp.clientName}</span>
                                  <span className="text-[10px] text-brand-terracotta font-bold">{formatCurrency(avgTicket)}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                  <span className="text-[10px] text-white/50 leading-tight">Última vez há {getDaysSinceLastVisit(opp.lastAppointmentDate)} dias</span>
                                  <span className="text-[10px] uppercase tracking-widest text-brand-terracotta bg-brand-terracotta/10 px-2 py-0.5 rounded border border-brand-terracotta/20">Oportunidade</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-center">
                           <span className="text-sm font-light text-white/50">Você não tem clientes em risco no momento. Ótimo trabalho!</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })() : (
            <div className="p-4 rounded-[20px] border border-brand-mist/60 bg-brand-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-brand-linen rounded-full hidden sm:flex items-center justify-center shrink-0">
                    {plan === 'free' ? <Users size={16} className="text-brand-terracotta" /> : <Zap size={16} className="text-brand-terracotta" />}
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-brand-ink uppercase tracking-widest flex items-center gap-2 mb-1">
                      {plan === 'free' ? 'Organize sua lista de clientes' : 'Segmentação de Clientes'}
                    </h3>
                    <p className="text-xs text-brand-stone leading-relaxed">
                      {plan === 'free'
                        ? "Nos planos pagos, a Nera ajuda você a entender quem voltou, quem sumiu e quem mais movimenta seu faturamento."
                        : "Veja quem são suas melhores clientes, quem voltou, quem sumiu e quem mais compra."}
                    </p>
                 </div>
              </div>
              {plan === 'free' ? (
                <PremiumButton onClick={() => checkFeatureAccess('crm')} className="w-full sm:w-auto px-6 py-2.5 text-[10px] whitespace-nowrap shrink-0">
                   Conhecer planos →
                </PremiumButton>
              ) : (
                <button onClick={() => {
                   document.getElementById('clients-filters-section')?.scrollIntoView({ behavior: 'smooth' });
                }} className="w-full sm:w-auto px-6 py-2.5 text-[10px] font-bold text-brand-terracotta uppercase tracking-widest border border-brand-terracotta/20 rounded-full hover:bg-brand-terracotta/5 transition-colors shrink-0">
                   Usar filtros →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search & Advanced Filters */}
        <div id="clients-filters-section" className="space-y-6 mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por nome, serviço ou telefone..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 py-6 bg-brand-white rounded-[28px] border border-brand-mist outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light shadow-sm text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between px-2 w-full md:w-auto">
              <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">
                Mostrando {Math.min(visibleCount, filteredClients.length)} de {filteredClients.length} clientes
              </span>
              {(filterService || filterStatus !== 'all' || searchTerm) && (
                <button 
                  onClick={() => {
                    setFilterService(null);
                    setFilterStatus('all');
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-brand-terracotta uppercase tracking-widest hover:underline ml-4"
                >
                  <X size={12} /> Limpar filtros
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'Todas', advanced: false },
                { id: 'new', label: 'Novas', advanced: false },
                { id: 'vip', label: 'VIP', advanced: true },
                { id: 'recurring', label: 'Frequentes', advanced: true },
                { id: 'at_risk', label: 'Esfriando', advanced: true },
                { id: 'inactive', label: 'Ausentes', advanced: true }
              ].map(f => {
                const isLocked = plan === 'free' && f.advanced;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (isLocked) {
                        checkFeatureAccess('analytics');
                        return;
                      }
                      setFilterStatus(f.id as typeof filterStatus);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap flex items-center gap-1",
                      filterStatus === f.id
                        ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                        : isLocked 
                          ? "bg-brand-mist/10 text-brand-stone/60 border-brand-mist/40 hover:bg-brand-mist/20"
                          : "bg-brand-white text-brand-stone/80 border-brand-mist/60 hover:border-brand-stone/50 hover:text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]"
                    )}
                  >
                    {isLocked && <Lock size={10} className="text-brand-stone/50" />}
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">
                  Serviços Realizados
                </span>
              </div>
              {uniqueServices.length > 0 && (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                  <button
                    onClick={() => setFilterService(null)}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider border whitespace-nowrap transition-all",
                      !filterService
                        ? "bg-brand-terracotta text-white border-brand-terracotta shadow-sm"
                        : "bg-brand-white text-brand-stone/70 border-brand-mist/50 hover:border-brand-mist hover:text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]"
                    )}
                  >
                    Todos os Serviços
                  </button>
                  {uniqueServices.map(service => (
                    <button
                      key={service}
                      onClick={() => setFilterService(service === filterService ? null : service)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider border whitespace-nowrap transition-all",
                        filterService === service
                          ? "bg-brand-terracotta text-white border-brand-terracotta shadow-sm"
                          : "bg-brand-white text-brand-stone/70 border-brand-mist/50 hover:border-brand-mist hover:text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]"
                      )}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clients List */}
        <div className="space-y-8">
          {filteredClients.length > 0 ? (
            <>
              {sortedGroupKeys.map((letter) => (
                <div key={letter} className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-4 pt-4 first:pt-0">
                    <span className="font-serif text-2xl text-brand-stone/60 font-light select-none">{letter}</span>
                    <div className="h-[1px] flex-1 bg-brand-mist/40" />
                  </div>
                  <div className="space-y-4">
                    {groupedClients[letter].map((client) => {
                      const flatIndex = visibleClients.findIndex(c => c.id === client.id);
                      return (
                        <motion.div 
                          key={client.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(flatIndex * 0.02, 0.5) }}
                          className="bg-brand-white p-5 md:p-6 rounded-[32px] border border-brand-mist flex flex-col gap-4 hover:border-brand-stone transition-all shadow-sm group"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div 
                              className="flex items-center gap-4 md:gap-6 overflow-hidden cursor-pointer flex-1"
                              onClick={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
                            >
                              <div className="flex-shrink-0 w-14 h-14 rounded-[20px] bg-brand-linen flex items-center justify-center text-brand-terracotta border border-brand-mist">
                                <span className="font-serif text-xl">{client.clientName?.[0] || 'C'}</span>
                              </div>
                              <div className="overflow-hidden">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="font-serif text-lg md:text-xl text-brand-ink truncate">{client.clientName}</h4>
                                  
                                  {/* Intelligent Tags */}
                                  {plan !== 'free' && client.segment === 'vip' && (
                                    <div className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 text-[10px] font-bold flex items-center gap-1">
                                      <Star size={8} className="fill-amber-600" /> VIP
                                    </div>
                                  )}
                                  {plan !== 'free' && client.segment === 'recurring' && (
                                    <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 text-[10px] font-bold">
                                      FREQUENTE
                                    </div>
                                  )}
                                  {plan !== 'free' && client.segment === 'new' && (
                                    <div className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 text-[10px] font-bold">
                                      NOVA
                                    </div>
                                  )}
                                  {plan !== 'free' && client.segment === 'at_risk' && (
                                    <div className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 text-[10px] font-bold">
                                      ESFRIANDO
                                    </div>
                                  )}
                                  {plan !== 'free' && client.segment === 'inactive' && (
                                    <div className="bg-brand-linen/50 text-brand-stone px-2 py-0.5 rounded-full border border-brand-mist text-[10px] font-bold flex items-center gap-1">
                                      AUSENTE ({getDaysSinceLastVisit(client.lastAppointmentDate)} DIAS)
                                    </div>
                                  )}
                                  {client.noShowCount > 0 && (
                                    <div className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 text-[10px] font-bold flex items-center gap-1">
                                      <AlertCircle size={8} /> {client.noShowCount} FALTAS
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-brand-stone font-medium uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><Calendar size={12} className="text-brand-terracotta"/> {client.confirmedAppointments} atendimentos</span>
                                  <span className="text-brand-ink font-semibold">{formatCurrency(client.totalSpent)} valor total</span>
                                  {plan !== 'free' && client.segment === 'recurring' && <span className="text-blue-600 font-bold">{client.appts90}x em 90 dias</span>}
                                  <span className="italic text-brand-stone/60 truncate max-w-[200px]">
                                    último atendimento: {client.lastServiceName} ({new Date(client.lastAppointmentDate.length === 10 ? client.lastAppointmentDate + 'T12:00:00' : client.lastAppointmentDate).toLocaleDateString('pt-BR')})
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {(() => {
                                const isInactive = getDaysSinceLastVisit(client.lastAppointmentDate) >= 30;
                                const hasPhone = !!client.clientPhone && client.clientPhone.length >= 10;
                                const profileUrl = profile?.slug ? `https://usenera.com/p/${profile.slug}` : 'https://usenera.com';
                                const firstName = (client.clientName || 'Cliente').split(' ')[0];
                                const templates = [
                                  `Oi, ${firstName} 🤎\nPassei aqui pra te avisar que minha agenda está aberta novamente ✨\nSe quiser reservar um horário, você pode agendar por aqui:\n${profileUrl}`,
                                  `Oi, ${firstName} ✨\nFaz um tempinho desde o seu último atendimento e lembrei de você 🤎\nMinha agenda está disponível:\n${profileUrl}`,
                                  `Oi, ${firstName} ✨\nAgenda aberta da semana. Se quiser escolher um horário com calma, deixei meu link aqui:\n${profileUrl}`
                                ];
                                const msg = isInactive ? templates[(client.clientName || 'Cliente').length % templates.length] : `Oi, ${firstName} ✨ tudo bem?`;
                                
                                return (
                                  <a 
                                    href={hasPhone ? buildWhatsappLink(client.clientPhone, msg) : '#'}
                                    target={hasPhone ? "_blank" : undefined}
                                    rel={hasPhone ? "noopener noreferrer" : undefined}
                                    className={cn(
                                      "p-3 md:p-4 rounded-2xl transition-all border flex items-center gap-2",
                                      !hasPhone ? "opacity-50 cursor-not-allowed text-brand-stone bg-brand-linen border-brand-mist" :
                                      isInactive 
                                        ? "bg-brand-terracotta/10 text-brand-terracotta border-brand-terracotta/30 hover:bg-brand-terracotta/20"
                                        : "text-brand-ink hover:bg-brand-linen border-transparent hover:border-brand-mist"
                                    )}
                                    title={!hasPhone ? "Cliente sem telefone cadastrado" : isInactive ? "Reativar cliente via WhatsApp" : "Enviar mensagem no WhatsApp"}
                                    onClick={(e) => {
                                      if (!hasPhone) e.preventDefault();
                                    }}
                                  >
                                    <MessageCircle size={20} />
                                    {isInactive && (
                                      <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Reativar</span>
                                    )}
                                  </a>
                                );
                              })()}
                            </div>
                          </div>

                          {expandedClientId === client.id && (
                            <ClientNotes client={client as any} onSave={handleUpdateNotes} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {(filteredClients.length > visibleCount || hasMore) && (
                <div className="pt-8 text-center">
                  {(searchTerm || filterService || filterStatus !== 'all') && hasMore && (
                    <p className="text-[11px] text-brand-stone/70 mb-4 px-4 font-medium opacity-80">
                      Exibindo resultados baseados nos registros já carregados. Carregue mais para ampliar a busca.
                    </p>
                  )}
                  <button 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="text-[10px] font-bold text-brand-stone hover:text-brand-ink uppercase tracking-widest px-8 py-3.5 border border-brand-mist rounded-full hover:border-brand-stone transition-all bg-brand-white/80 backdrop-blur-sm shadow-sm mx-auto flex items-center gap-2"
                  >
                    <ChevronDown size={14} className={cn(loadingMore && "animate-spin")} />
                    {loadingMore ? 'Carregando...' : 'Ver mais clientes'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist px-6">
              <Users size={40} className="text-brand-mist mx-auto mb-6 opacity-40" />
              {(searchTerm || filterService || filterStatus !== 'all') ? (
                <>
                  <p className="text-brand-stone font-serif italic text-lg mb-2">Nenhum resultado encontrado</p>
                  <p className="text-[10px] text-brand-stone/60 uppercase tracking-widest max-w-xs mx-auto mb-6">
                    {hasMore 
                      ? "A busca exibe clientes já em memória. Carregue mais para procurar no histórico." 
                      : "Sua busca não retornou clientes."}
                  </p>
                  {hasMore && (
                    <PremiumButton 
                      onClick={() => fetchClients(true)} 
                      variant="linen" 
                      className="text-[10px] py-3 px-8 flex items-center gap-2 mx-auto"
                    >
                      <ChevronDown size={14} />
                      {loadingMore ? 'Carregando...' : 'Carregar mais clientes'}
                    </PremiumButton>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xl font-serif text-brand-ink mb-1 italic">Tudo pronto para começar</p>
                  <p className="text-[10px] text-brand-stone font-light max-w-xs mx-auto uppercase tracking-widest leading-relaxed">As clientes que reservarem com você aparecerão aqui.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <UpgradeModal 
        open={isUpgradeModalOpen} 
        onClose={closeUpgradeModal}
        feature={upgradeFeature}
        count={usageCount}
      />
      </PageErrorBoundary>
    </AppLayout>
  );
}
