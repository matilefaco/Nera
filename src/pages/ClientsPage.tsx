import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { isRevenueStatus, isCancelledStatus, APPOINTMENT_STATUS } from '../constants/appointmentStatus';
import { db, updateClientSummaryFromAppointment } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Users, Search, MessageCircle, 
  TrendingUp, Calendar, ChevronRight, Star,
  X, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import { formatCurrency, buildWhatsappLink, cn } from '../lib/utils';
import AppLayout from '../components/AppLayout';
import { ListCardSkeleton } from '../components/ui/ListCardSkeleton';
import { ClientSummary, Appointment } from '../types';
import PremiumButton from '../components/PremiumButton';
import { notify } from '../lib/notify';
import { exportClientsCsv } from '../lib/exportCsv';

const PAGE_SIZE = 50;

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import UpgradeModal from '../components/UpgradeModal';
import { PageErrorBoundary } from '../components/PageErrorBoundary';

const ClientNotes = ({
  client,
  onSave
}: {
  client: ClientSummary;
  onSave: (clientId: string, notes: string) => Promise<void>;
}) => {
  const [notes, setNotes] = useState(client.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(client.notes || '');
  }, [client.notes]);

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
    <div className="mt-2 pt-4 border-t border-brand-mist animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-stone">
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
        className="w-full bg-brand-linen/30 border border-brand-mist rounded-xl p-3 text-sm text-brand-ink placeholder:text-brand-stone/40 focus:outline-none focus:border-brand-stone focus:ring-1 focus:ring-brand-stone min-h-[80px] resize-y"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-brand-stone/60 italic">
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

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [isMigrating, setIsMigrating] = useState(false);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

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

  const fetchClients = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const clientsCacheKey = user.uid;
    const cached = clientsPageCache.get(clientsCacheKey);
    if (cached && Date.now() - cached.fetchedAt < CLIENTS_CACHE_TTL_MS) {
      setClients(cached.data);
      setLoading(false);
      return;
    }

    const mergeNotes = async (clientDocs: ClientSummary[]) => {
      try {
        const notesQ = query(collection(db, 'users', user.uid, 'client_notes'));
        const notesSnap = await getDocs(notesQ);
        const notesMap = new Map();
        notesSnap.forEach(doc => notesMap.set(doc.id, doc.data().notes));
        return clientDocs.map(d => ({ ...d, notes: notesMap.get(d.id) || d.notes || '' }));
      } catch (err) {
        return clientDocs;
      }
    };

    try {
      const q = query(
        collection(db, 'client_summaries'),
        where('professionalId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      let docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id,
          ...data,
          clientName: data.clientName || 'Cliente',
          clientPhone: data.clientPhone || '',
          totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 0,
          totalAppointments: typeof data.totalAppointments === 'number' ? data.totalAppointments : 0,
          lastAppointmentDate: data.lastAppointmentDate ? new Date(data.lastAppointmentDate).toISOString() : new Date().toISOString()
        } as ClientSummary;
      });
      
      docs.sort((a, b) => new Date(b.lastAppointmentDate).getTime() - new Date(a.lastAppointmentDate).getTime());
      
      docs = await mergeNotes(docs);
      
      setClients(docs);
      clientsPageCache.set(clientsCacheKey, { data: docs, fetchedAt: Date.now() });
      setHasMore(false);

      // Removido throw new Error('empty_summaries') que acionava fallback caro
    } catch (err: any) {
      console.error('[ClientsPage] Failed to load clients', err);
      if (err.message && err.message.includes('index')) {
        console.warn('[ClientsPage] Composite index required for client_summaries: professionalId ASC, lastAppointmentDate DESC.');
        // We no longer fallback automatically to avoid expensive queries on large databases.
      } else {
        notify.error('Erro ao carregar clientes. Tente novamente mais tarde.');
      }
      setClients([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    
    // Fallback de segurança para garantir que a tela não fique presa no skeleton
    // se o Firebase demorar para responder (falta de índice ou lentidão extrema)
    const timeout = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 5000);

    fetchClients().finally(() => {
      if (isMounted) {
        clearTimeout(timeout);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [fetchClients]);

  useEffect(() => {
    setVisibleLimit(30);
  }, [searchTerm, filterService, filterStatus]);

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
          lastServiceName: appt.serviceName || '',
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
          existing.totalSpent += (Number(appt.price) || 0);
        }
        if (isNoShow) existing.noShowCount += 1;
        if (isCancelled) existing.cancelledAppointments += 1;
        
        if (!existing.services) existing.services = [];
        if (!existing.services.includes(appt.serviceName || '') && appt.serviceName) {
          existing.services.push(appt.serviceName);
        }
        
        if (appt.date > existing.lastAppointmentDate) {
          existing.lastAppointmentDate = appt.date;
          existing.lastServiceId = appt.serviceId || '';
          existing.lastServiceName = appt.serviceName || '';
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
      console.error('[Migration] Failed:', err);
      notify.error('Falha na migração automática.');
    } finally {
      setIsMigrating(false);
    }
  };

  const segmentationThresholds = useMemo(() => {
    if (clients.length === 0) return { threshold20: 0, avgTicket: 0 };
    
    const ltvs = clients.map(c => c.totalSpent).sort((a, b) => b - a);
    const idx20 = Math.floor(ltvs.length * 0.2);
    const threshold20 = ltvs[idx20] || 0;
    
    const totalLTV = ltvs.reduce((acc, val) => acc + val, 0);
    const totalAppts = clients.reduce((acc, c) => acc + (c.confirmedAppointments || 0), 0);
    const avgTicket = totalAppts > 0 ? totalLTV / totalAppts : 0;
    
    return { threshold20, avgTicket };
  }, [clients]);

  const enrichedClients = useMemo(() => {
    return clients.map(c => {
      const daysSince = c.lastAppointmentDate ? getDaysSinceLastVisit(c.lastAppointmentDate) : 999;
      
      // Segmentation Logic
      let segment = 'new';
      
      if (c.totalSpent >= segmentationThresholds.threshold20 || c.totalSpent >= (segmentationThresholds.avgTicket * 3)) {
        segment = 'vip';
      } else if (daysSince > 60) {
        segment = 'inactive';
      } else if (daysSince >= 30) {
        segment = 'at_risk';
      } else if (c.confirmedAppointments >= 3) {
        segment = 'recurring';
      } else if (c.confirmedAppointments > 1) {
        segment = 'active';
      } else {
        segment = 'new';
      }

      // We rely on confirmedAppointments for 'appts90' proxy in UI since we don't fetch all appts to filter precisely by 90 days.
      const appts90 = c.confirmedAppointments;

      return { ...c, segment, appts90, daysSince };
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
        // Sort priority: Segment (VIP first), then LTV
        const segmentWeight = { vip: 0, recurring: 1, active: 2, new: 3, at_risk: 4, inactive: 5 };
        const weightA = segmentWeight[a.segment as keyof typeof segmentWeight] ?? 10;
        const weightB = segmentWeight[b.segment as keyof typeof segmentWeight] ?? 10;
        
        if (weightA !== weightB) return weightA - weightB;
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      });
  }, [enrichedClients, searchTerm, filterService, filterStatus]);

  const visibleClients = useMemo(() => {
    return filteredClients.slice(0, visibleLimit);
  }, [filteredClients, visibleLimit]);

  const hasMoreVisual = filteredClients.length > visibleLimit;

      if (loading && clients.length === 0) {
        return (
          <AppLayout activeRoute="clients">
            <div className="p-6 md:p-12 pb-32 max-w-5xl mx-auto w-full">
              <header className="mb-12">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-brand-linen rounded-xl text-brand-terracotta">
                    <Users size={24} />
                  </div>
                  <h1 className="text-4xl font-serif text-brand-ink">Seus Clientes</h1>
                </div>
                <p className="text-brand-stone font-light italic">Carregando seus relacionamentos...</p>
              </header>
              <div className="flex flex-col gap-4">
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
                onClick={() => user && exportClientsCsv(user.uid)}
                className="px-6 py-4 bg-brand-white text-brand-ink text-[10px] font-bold uppercase tracking-widest hover:border-brand-mist border-brand-mist shadow-sm border rounded-full transition-all flex items-center justify-center gap-2"
              >
                Exportar CSV
              </button>
            )}
            {clients.length === 0 && !loading && (
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

        {/* Opportunity Card */}
        {clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 p-8 bg-brand-ink text-white rounded-[40px] shadow-xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] block">Oportunidade de Receita</span>
                <h3 className="text-2xl font-serif">
                  Você tem {clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).length} clientes sem voltar há 30+ dias.
                </h3>
                <p className="text-white/60 text-xs font-light">Um convite personalizado pode recuperar até {formatCurrency(clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).reduce((acc, curr) => acc + (curr.totalSpent / curr.confirmedAppointments || 0), 0))} em faturamento hoje.</p>
              </div>
              <button 
                onClick={() => setFilterStatus('inactive')}
                className="px-8 py-4 bg-brand-terracotta text-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg whitespace-nowrap"
              >
                Chamar cliente
              </button>
            </div>
          </motion.div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-10">
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Clientes</p>
            <p className="text-2xl sm:text-3xl font-serif text-brand-ink leading-none">{clients.length}{hasMore ? '+' : ''}</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Retorno Estimado</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-serif text-brand-terracotta leading-none truncate">{formatCurrency(clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).reduce((acc, curr) => acc + (curr.totalSpent / curr.confirmedAppointments || 0), 0))}</p>
            <p className="text-[8px] text-brand-stone/60 mt-1 truncate">clientes ausentes</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Sumidas há 30D</p>
            <p className="text-2xl sm:text-3xl font-serif text-brand-ink leading-none">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).length}</p>
          </div>
          <div className="bg-brand-white p-4 sm:p-5 rounded-[24px] border border-brand-mist/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-center">
            <p className="text-[8px] sm:text-[9px] font-bold text-brand-stone/80 uppercase tracking-widest mb-1.5 truncate">Atendidas recentemente</p>
            <p className="text-2xl sm:text-3xl font-serif text-green-600/90 leading-none">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) < 30).length}</p>
          </div>
        </div>

        {/* Search & Advanced Filters */}
        <div className="space-y-6 mb-10">
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
            
            {(filterService || filterStatus !== 'all' || searchTerm || hasMoreVisual) ? (
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">
                  Exibindo {visibleClients.length} de {filteredClients.length} clientes
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
            ) : (
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">
                  {filteredClients.length} clientes
                </span>
              </div>
            )}

            {clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).length > 0 && (
              <PremiumButton
                onClick={() => {
                  if (!checkFeatureAccess('analytics')) return;
                  
                  const top10 = clients
                    .filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30)
                    .sort((a,b) => b.totalSpent - a.totalSpent)
                    .slice(0, 10);
                  
                  notify.info(`Iniciando reativação de ${top10.length} clientes VIP...`, {
                    description: "Abriremos o WhatsApp de cada uma com uma mensagem personalizada."
                  });

                  // Sequence them (opening multiple tabs at once might be blocked, but we'll try or provide a list)
                  top10.forEach((c, i) => {
                    setTimeout(() => {
                      const profileUrl = profile?.slug ? `https://usenera.com/p/${profile.slug}` : 'https://usenera.com';
                      const msg = `Oi, ${c.clientName.split(' ')[0]} ✨\nFaz um tempinho desde o seu último atendimento e lembrei de você 🤎\nMinha agenda está disponível:\n${profileUrl}`;
                      window.open(buildWhatsappLink(c.clientPhone, msg), '_blank');
                    }, i * 1500);
                  });
                }}
                variant="linen"
                className="text-[10px] py-6 px-8 flex items-center gap-2 whitespace-nowrap"
              >
                <RefreshCw size={14} className="text-brand-terracotta" />
                Reativar Top 10 VIP
              </PremiumButton>
            )}
          </div>

          <div className="space-y-6">
            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'vip', label: 'VIP' },
                { id: 'recurring', label: 'Frequentes' },
                { id: 'at_risk', label: 'Esfriando' },
                { id: 'inactive', label: 'Ausentes' },
                { id: 'new', label: 'Novas' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id as typeof filterStatus)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap",
                    filterStatus === f.id
                      ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                      : "bg-brand-white text-brand-stone/80 border-brand-mist/60 hover:border-brand-stone/50 hover:text-brand-ink shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)]"
                  )}
                >
                  {f.label}
                </button>
              ))}
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
                      "px-4 py-2 rounded-full text-[9px] font-semibold uppercase tracking-wider border whitespace-nowrap transition-all",
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
                        "px-4 py-2 rounded-full text-[9px] font-semibold uppercase tracking-wider border whitespace-nowrap transition-all",
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
        <div className="space-y-4">
          {filteredClients.length > 0 ? (
            <>
              {visibleClients.map((client, idx) => (
                <motion.div 
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
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
                        {client.segment === 'vip' && (
                          <div className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 text-[8px] font-bold flex items-center gap-1">
                            <Star size={8} className="fill-amber-600" /> VIP
                          </div>
                        )}
                        {client.segment === 'recurring' && (
                          <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100 text-[8px] font-bold">
                            FREQUENTE
                          </div>
                        )}
                        {client.segment === 'new' && (
                          <div className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 text-[8px] font-bold">
                            NOVA
                          </div>
                        )}
                        {client.segment === 'at_risk' && (
                          <div className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100 text-[8px] font-bold">
                            ESFRIANDO
                          </div>
                        )}
                        {(client.segment === 'inactive' || getDaysSinceLastVisit(client.lastAppointmentDate) >= 30) && (
                          <div className="bg-brand-linen/50 text-brand-stone px-2 py-0.5 rounded-full border border-brand-mist text-[8px] font-bold flex items-center gap-1">
                            AUSENTE ({getDaysSinceLastVisit(client.lastAppointmentDate)} DIAS)
                          </div>
                        )}
                        {client.noShowCount > 0 && (
                          <div className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 text-[8px] font-bold flex items-center gap-1">
                            <AlertCircle size={8} /> {client.noShowCount} FALTAS
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] md:text-[10px] text-brand-stone font-medium uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-brand-terracotta"/> {client.confirmedAppointments} atendimentos</span>
                        <span className="text-brand-ink font-semibold">{formatCurrency(client.totalSpent)} valor total</span>
                        {client.segment === 'recurring' && <span className="text-blue-600 font-bold">{client.appts90}x em 90 dias</span>}
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
                      const templates = [
                        `Oi, ${client.clientName.split(' ')[0]} 🤎\nPassei aqui pra te avisar que minha agenda está aberta novamente ✨\nSe quiser reservar um horário, você pode agendar por aqui:\n${profileUrl}`,
                        `Oi, ${client.clientName.split(' ')[0]} ✨\nFaz um tempinho desde o seu último atendimento e lembrei de você 🤎\nMinha agenda está disponível:\n${profileUrl}`,
                        `Oi, ${client.clientName.split(' ')[0]} ✨\nAgenda aberta da semana. Se quiser escolher um horário com calma, deixei meu link aqui:\n${profileUrl}`
                      ];
                      const msg = isInactive ? templates[client.clientName.length % templates.length] : `Oi, ${client.clientName.split(' ')[0]} ✨ tudo bem?`;
                      
                      return (
                        <a 
                          href={hasPhone ? buildWhatsappLink(client.clientPhone, msg) : '#'}
                          target={hasPhone ? "_blank" : undefined}
                          rel={hasPhone ? "noopener noreferrer" : undefined}
                          className={cn(
                            "p-3 md:p-4 rounded-2xl transition-all border flex items-center gap-2",
                            !hasPhone ? "opacity-50 cursor-not-allowed text-brand-stone bg-brand-linen border-brand-mist" :
                            isInactive 
                              ? "bg-brand-terracotta text-white border-brand-terracotta shadow-md hover:bg-brand-sienna hover:scale-105"
                              : "text-brand-ink hover:bg-brand-linen border-transparent hover:border-brand-mist"
                          )}
                          title={!hasPhone ? "Cliente sem telefone cadastrado" : isInactive ? "Reativar cliente via WhatsApp" : "Enviar mensagem no WhatsApp"}
                          onClick={(e) => {
                            if (!hasPhone) e.preventDefault();
                          }}
                        >
                          <MessageCircle size={20} />
                          {isInactive && (
                            <span className="text-[8px] font-bold uppercase tracking-widest hidden md:inline">Chamar cliente</span>
                          )}
                        </a>
                      );
                    })()}
                  </div>
                  </div>

                  {expandedClientId === client.id && (
                    <ClientNotes client={client} onSave={handleUpdateNotes} />
                  )}
                </motion.div>
              ))}
              
              {hasMoreVisual && (
                <div className="pt-8 text-center">
                  <PremiumButton 
                    onClick={() => setVisibleLimit(prev => prev + 30)} 
                    variant="linen" 
                    className="text-[10px] py-4 px-10 flex items-center gap-2 mx-auto"
                  >
                    <ChevronDown size={14} />
                    Carregar mais clientes
                  </PremiumButton>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-24 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist px-6">
              <Users size={40} className="text-brand-mist mx-auto mb-6 opacity-40" />
              <p className="text-brand-stone font-serif italic text-lg mb-2">Nenhum cliente encontrado.</p>
              <p className="text-[10px] text-brand-stone uppercase tracking-widest max-w-xs mx-auto">Tente ajustar seus filtros ou busca.</p>
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
