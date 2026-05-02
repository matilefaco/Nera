import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, updateClientSummaryFromAppointment } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { 
  Users, Search, MessageCircle, 
  TrendingUp, Calendar, ChevronRight, Star,
  X, AlertCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import { formatCurrency, buildWhatsappLink, cn } from '../lib/utils';
import AppLayout from '../components/AppLayout';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { ClientSummary, Appointment } from '../types';
import PremiumButton from '../components/PremiumButton';
import { toast } from 'sonner';

const PAGE_SIZE = 50;

import { useUpgradeTriggers } from '../hooks/useUpgradeTriggers';
import UpgradeModal from '../components/UpgradeModal';

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  // Fetch appointments to get unique services and enrich client data
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(appts);
    });
    return () => unsubscribe();
  }, [user]);

  const uniqueServices = useMemo(() => {
    const s = new Set<string>();
    appointments.forEach(a => {
      if (a.serviceName) s.add(a.serviceName);
    });
    return Array.from(s).sort();
  }, [appointments]);

  const isActive = (c: ClientSummary) => {
    if (!c.lastAppointmentDate) return false;
    return getDaysSinceLastVisit(c.lastAppointmentDate) <= 30;
  };

  // Helper to calculate days since last visit
  const getDaysSinceLastVisit = (dateStr: string) => {
    const today = new Date();
    const last = new Date(dateStr + 'T12:00:00');
    const diffTime = Math.abs(today.getTime() - last.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    vip: 0,
    risk: 0
  });

  const fetchClients = useCallback(async (isNextPage = false) => {
    if (!user) return;
    if (isNextPage) setLoadingMore(true);
    else setLoading(true);

    try {
      let q = query(
        collection(db, 'client_summaries'),
        where('professionalId', '==', user.uid),
        orderBy('lastAppointmentDate', 'desc'),
        limit(PAGE_SIZE)
      );

      if (isNextPage && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientSummary));
      
      if (isNextPage) {
        setClients(prev => [...prev, ...docs]);
      } else {
        setClients(docs);
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);

      // If no clients found, maybe we need migration?
      if (!isNextPage && snapshot.empty) {
        // Check if there are any appointments at all
        const apptQuery = query(collection(db, 'appointments'), where('professionalId', '==', user.uid), limit(1));
        const apptSnap = await getDocs(apptQuery);
        if (!apptSnap.empty) {
          console.warn('[ClientsPage] Summary collection is empty but appointments exist. Suggesting migration.');
        }
      }
    } catch (err) {
      console.error('[ClientsPage] Fetch error:', err);
      toast.error('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, lastVisible]);

  useEffect(() => {
    fetchClients();
  }, [user]);

  // Handle migration
  const handleMigrate = async () => {
    if (!user) return;
    setIsMigrating(true);
    toast.info('Iniciando atualização inteligente da base de clientes...', {
      description: 'Isso pode levar alguns instantes.'
    });

    try {
      // Fetch all appointments for this professional
      const q = query(collection(db, 'appointments'), where('professionalId', '==', user.uid));
      const snap = await getDocs(q);
      const appointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

      let count = 0;
      // We process them one by one or in small batches to avoid transaction overload if it was a real migration tool, 
      // but here we have the helper.
      for (const appt of appointments) {
        await updateClientSummaryFromAppointment(appt);
        count++;
      }

      toast.success('Base de clientes sincronizada!', {
        description: `${count} agendamentos processados.`
      });
      fetchClients(); // Refresh
    } catch (err) {
      console.error('[Migration] Failed:', err);
      toast.error('Falha na migração automática.');
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
    const today = new Date();
    const last90Days = new Date();
    last90Days.setDate(today.getDate() - 90);
    const last90DaysStr = last90Days.toISOString().split('T')[0];

    return clients.map(c => {
      const clientAppts = appointments.filter(a => 
        (a.clientWhatsapp && a.clientWhatsapp === c.clientPhone) || 
        (a.clientEmail && a.clientEmail === c.clientEmail)
      );
      
      const services = Array.from(new Set(clientAppts.map(a => a.serviceName)));
      const appts90 = clientAppts.filter(a => a.date >= last90DaysStr && ['confirmed', 'completed', 'paid'].includes(a.status)).length;
      const daysSince = c.lastAppointmentDate ? getDaysSinceLastVisit(c.lastAppointmentDate) : 999;
      
      // Segmentation Logic
      let segment = 'new';
      
      if (c.totalSpent >= segmentationThresholds.threshold20 || c.totalSpent >= (segmentationThresholds.avgTicket * 3)) {
        segment = 'vip';
      } else if (appts90 >= 3) {
        segment = 'recurring';
      } else if (daysSince > 60) {
        segment = 'inactive';
      } else if (daysSince >= 30) {
        segment = 'at_risk';
      } else if (c.confirmedAppointments > 1) {
        segment = 'active';
      } else {
        segment = 'new';
      }

      return { ...c, services, segment, appts90, daysSince };
    });
  }, [clients, appointments, segmentationThresholds]);

  const filteredClients = useMemo(() => {
    return enrichedClients
      .filter(client => {
        const matchSearch = (client.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (client.clientPhone || '').includes(searchTerm);
        
        const matchService = !filterService || (client.services && client.services.includes(filterService));
        
        const matchStatus = filterStatus === "all" || client.segment === filterStatus;
          
        return matchSearch && matchService && matchStatus;
      })
      .sort((a, b) => {
        // Sort priority: Segment (VIP first), then LTV
        const segmentWeight = { vip: 0, recurring: 1, active: 2, new: 3, at_risk: 4, inactive: 5 };
        const weightA = (segmentWeight as any)[a.segment] ?? 10;
        const weightB = (segmentWeight as any)[b.segment] ?? 10;
        
        if (weightA !== weightB) return weightA - weightB;
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      });
  }, [enrichedClients, searchTerm, filterService, filterStatus]);

  if (loading && clients.length === 0) {
    return (
      <AppLayout activeRoute="clients">
        <AppLoadingScreen message="Sincronizando seus relacionamentos..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout activeRoute="clients">
      <div className="p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Relacionamentos</h1>
            <p className="text-brand-stone font-light text-sm">Base inteligente de clientes com histórico e LTV.</p>
          </div>
          
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
                Reativar agora
              </button>
            </div>
          </motion.div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Total</p>
            <p className="text-3xl font-serif text-brand-ink">{clients.length}{hasMore ? '+' : ''}</p>
          </div>
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Recuperável</p>
            <p className="text-3xl font-serif text-brand-terracotta">{formatCurrency(clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).reduce((acc, curr) => acc + (curr.totalSpent / curr.confirmedAppointments || 0), 0))}</p>
          </div>
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Inativos (30d+)</p>
            <p className="text-3xl font-serif text-brand-ink">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) >= 30).length}</p>
          </div>
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-1">Ativos (Recent)</p>
            <p className="text-3xl font-serif text-green-600">{clients.filter(c => getDaysSinceLastVisit(c.lastAppointmentDate) < 30).length}</p>
          </div>
        </div>

        {/* Search & Advanced Filters */}
        <div className="space-y-6 mb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-16 pr-6 py-6 bg-brand-white rounded-[28px] border border-brand-mist outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light shadow-sm text-sm"
              />
            </div>
            
            {(filterService || filterStatus !== 'all' || searchTerm) && (
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest">
                  {filteredClients.length} de {clients.length} clientes
                </span>
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
                  
                  toast.info(`Iniciando reativação de ${top10.length} clientes VIP...`, {
                    description: "Abriremos o WhatsApp de cada uma com uma mensagem personalizada."
                  });

                  // Sequence them (opening multiple tabs at once might be blocked, but we'll try or provide a list)
                  top10.forEach((c, i) => {
                    setTimeout(() => {
                      const msg = `Oi ${c.clientName.split(' ')[0]} 💛 tudo bem? Faz um tempinho que você não vem nos visitar. Que tal garantir um horário essa semana para renovar seu autocuidado?`;
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
                { id: 'recurring', label: 'Recorrentes' },
                { id: 'at_risk', label: 'Em Risco' },
                { id: 'inactive', label: 'Inativas' },
                { id: 'new', label: 'Novas' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id as any)}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap",
                    filterStatus === f.id
                      ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                      : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink shadow-sm"
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
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  <button
                    onClick={() => setFilterService(null)}
                    className={cn(
                      "px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all",
                      !filterService
                        ? "bg-brand-terracotta text-white border-brand-terracotta"
                        : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink shadow-sm"
                    )}
                  >
                    Todos os Serviços
                  </button>
                  {uniqueServices.map(service => (
                    <button
                      key={service}
                      onClick={() => setFilterService(service === filterService ? null : service)}
                      className={cn(
                        "px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all",
                        filterService === service
                          ? "bg-brand-terracotta text-white border-brand-terracotta"
                          : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink shadow-sm"
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
              {filteredClients.map((client, idx) => (
                <motion.div 
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  className="bg-brand-white p-5 md:p-6 rounded-[32px] border border-brand-mist flex items-center justify-between hover:border-brand-stone transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-4 md:gap-6 overflow-hidden">
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
                            RECORRENTE
                          </div>
                        )}
                        {client.segment === 'new' && (
                          <div className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 text-[8px] font-bold">
                            NOVA
                          </div>
                        )}
                        {client.segment === 'at_risk' && (
                          <div className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100 text-[8px] font-bold">
                            EM RISCO
                          </div>
                        )}
                        {client.segment === 'inactive' && (
                          <div className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 text-[8px] font-bold">
                            INATIVA
                          </div>
                        )}
                        {client.noShowCount > 0 && (
                          <div className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 text-[8px] font-bold flex items-center gap-1">
                            <AlertCircle size={8} /> {client.noShowCount} FALTAS
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] md:text-[10px] text-brand-stone font-medium uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-brand-terracotta"/> {client.confirmedAppointments} visitas</span>
                        <span className="text-brand-ink font-semibold">{formatCurrency(client.totalSpent)} LTV</span>
                        {client.segment === 'recurring' && <span className="text-blue-600 font-bold">{client.appts90}x em 90 dias</span>}
                        <span className="italic text-brand-stone/60 truncate max-w-[200px]">
                          Último: {client.lastServiceName} ({new Date(client.lastAppointmentDate + 'T12:00:00').toLocaleDateString('pt-BR')})
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a 
                      href={buildWhatsappLink(client.clientPhone, getDaysSinceLastVisit(client.lastAppointmentDate) >= 30 ? `Oi ${client.clientName.split(' ')[0]} 💛 faz um tempinho desde seu último atendimento. Se quiser, posso te mostrar horários disponíveis esta semana.` : `Oi ${client.clientName.split(' ')[0]} ✨ tudo bem?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "p-3 md:p-4 rounded-2xl transition-all border flex items-center gap-2",
                        getDaysSinceLastVisit(client.lastAppointmentDate) >= 30 
                          ? "bg-brand-terracotta text-white border-brand-terracotta shadow-md hover:bg-brand-sienna hover:scale-105"
                          : "text-brand-ink hover:bg-brand-linen border-transparent hover:border-brand-mist"
                      )}
                    >
                      <MessageCircle size={20} />
                      {getDaysSinceLastVisit(client.lastAppointmentDate) >= 30 && (
                        <span className="text-[8px] font-bold uppercase tracking-widest hidden md:inline">Reativar</span>
                      )}
                    </a>
                  </div>
                </motion.div>
              ))}
              
              {hasMore && (
                <div className="pt-8 text-center">
                  <PremiumButton 
                    onClick={() => fetchClients(true)} 
                    disabled={loadingMore}
                    variant="linen" 
                    className="text-[10px] py-4 px-10 flex items-center gap-2 mx-auto"
                  >
                    {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />}
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
    </AppLayout>
  );
}
