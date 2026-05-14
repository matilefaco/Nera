import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { isCancelledStatus, isPendingStatus, isCompletedStatus, isConfirmedLikeStatus, isRevenueStatus } from '../constants/appointmentStatus';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { 
  DollarSign, TrendingUp, Calendar, Users, 
  ChevronDown, ChevronUp, Download, PieChart,
  ArrowUpRight, ArrowDownRight, Info, Plus
} from 'lucide-react';
import { formatCurrency, cn, formatDateKey } from '../lib/utils';
import { Appointment } from '../types';
import AppLayout from '../components/AppLayout';
import { PageErrorBoundary } from '../components/PageErrorBoundary';
import { exportFinancialCsv } from '../lib/exportCsv';
import { FinancialSkeleton } from '../components/ui/FinancialSkeleton';
import { notify } from '../lib/notify';
import { calculateFinancialMetrics, RevenueByService } from '../lib/financialMetrics';

interface MonthlyGroup {
  monthKey: string; // YYYY-MM
  monthLabel: string; // "Março 2024"
  revenue: number; // completed
  plannedRevenue: number; // confirmed+accepted
  pendingRevenue: number;
  cancelledRevenue: number;
  appointmentsCount: number; // totalValidAppointments
  ticketAverage: number;
  monthTotalRevenue: number; // monthlyRevenue (revenue + plannedRevenue)
  revenueByService: RevenueByService[];
  appointments: Appointment[];
}

interface FinancialAppointmentsCacheEntry {
  data: Appointment[];
  fetchedAt: number;
}

const FINANCIAL_CACHE_TTL_MS = 5 * 60 * 1000;
const financialAppointmentsCache = new Map<string, FinancialAppointmentsCacheEntry>();

export default function FinancialPage() {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;

    const fetchFinancialData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const past = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const startDateStr = formatDateKey(past);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const endDateStr = formatDateKey(end);

        const financialCacheKey = `${user.uid}:${startDateStr}:${endDateStr}`;
        const cached = financialAppointmentsCache.get(financialCacheKey);
        
        if (cached && Date.now() - cached.fetchedAt < FINANCIAL_CACHE_TTL_MS) {
          setAppointments(cached.data);
          if (isMounted) setLoading(false);
          return;
        }

        const q = query(
          collection(db, 'appointments'),
          where('professionalId', '==', user.uid),
          where('date', '>=', startDateStr),
          where('date', '<=', endDateStr)
        );

        const snapshot = await getDocs(q);
        if (!isMounted) return;
        
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        // Order in memory
        docs.sort((a, b) => b.date.localeCompare(a.date));
        
        financialAppointmentsCache.set(financialCacheKey, { data: docs, fetchedAt: Date.now() });
        setAppointments(docs);
      } catch (err: any) {
        if (!isMounted) return;
        if (err.message && err.message.includes('index')) {
          console.warn('[FinancialPage] Firestore index required: appointments professionalId ASC, date ASC');
        } else {
          console.error('[FinancialPage] Failed to load financial appointments', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFinancialData();
    
    return () => {
      isMounted = false;
    };
  }, [user]);

  const monthlyGroups = useMemo(() => {
    const rawGroups: Record<string, Appointment[]> = {};
    const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    appointments.forEach(appt => {
      if (!appt.date) return;
      const [year, month] = appt.date.split('-');
      const monthKey = `${year}-${month}`;
      
      if (!rawGroups[monthKey]) {
        rawGroups[monthKey] = [];
      }
      rawGroups[monthKey].push(appt);
    });

    const groups: MonthlyGroup[] = Object.keys(rawGroups).map(monthKey => {
      const appts = rawGroups[monthKey];
      const metrics = calculateFinancialMetrics(appts);
      const [year, month] = monthKey.split('-');
      
      return {
        monthKey,
        monthLabel: `${monthsNames[parseInt(month) - 1]} ${year}`,
        revenue: metrics.receivedRevenue,
        plannedRevenue: metrics.receivableRevenue,
        pendingRevenue: metrics.pendingConfirmationRevenue,
        cancelledRevenue: metrics.cancelledRevenue,
        appointmentsCount: metrics.totalValidAppointments,
        ticketAverage: metrics.averageTicket,
        monthTotalRevenue: metrics.monthlyRevenue,
        revenueByService: metrics.revenueByService,
        appointments: appts
      };
    });

    // Sort by date (desc)
    return groups.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [appointments]);

  const currentMonthData = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date();
    prevDate.setMonth(now.getMonth() - 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const current = monthlyGroups.find(g => g.monthKey === currentKey);
    const previous = monthlyGroups.find(g => g.monthKey === prevKey);

    return {
      current,
      previous,
      growth: previous && previous.revenue > 0 ? ((current?.revenue || 0) - previous.revenue) / previous.revenue * 100 : 0
    };
  }, [monthlyGroups]);

  const servicesRevenue = useMemo(() => {
    return currentMonthData.current?.revenueByService || [];
  }, [currentMonthData]);

  const handleExportCSV = (group: MonthlyGroup) => {
    if (profile?.plan === 'free' || !profile?.plan) {
      notify.error('Opa! Exportação de relatórios é um recurso Pro. Que tal fazer o upgrade?');
      return;
    }

    try {
      const headers = ['Data', 'Cliente', 'WhatsApp', 'Serviço', 'Preço', 'Taxa Deslocamento', 'Total', 'Status'];
      const rows = group.appointments.map(a => [
        a.date,
        `"${a.clientName.replace(/"/g, '""')}"`,
        a.clientWhatsapp,
        `"${a.serviceName.replace(/"/g, '""')}"`,
        a.price,
        a.travelFee || 0,
        (a.price || 0) + (a.travelFee || 0),
        a.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-nera-${group.monthKey}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify.success('Relatório exportado com sucesso!');
    } catch (err) {
      notify.error('Erro ao exportar relatório.');
    }
  };

  if (loading) {
    return <FinancialSkeleton />;
  }

  return (
    <AppLayout activeRoute="financial">
      <PageErrorBoundary 
        title="Não foi possível carregar seu financeiro." 
      >
      <div className="p-6 md:p-12 pb-40 max-w-5xl mx-auto w-full">
        <header className="mb-10 md:mb-14 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="max-w-md">
            <h1 className="text-3xl md:text-4xl font-serif text-brand-ink mb-2 md:mb-3 tracking-tight">Financeiro</h1>
            <p className="text-brand-stone font-light text-base md:text-lg">Tudo o que entra no seu negócio, em um só lugar.</p>
          </div>
          <div className="pt-0 md:pt-2">
            <button
              onClick={() => user && exportFinancialCsv(user.uid)}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-brand-mist/80 bg-white hover:bg-brand-linen/30 hover:border-brand-mist transition-all shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] w-full md:w-auto justify-center"
            >
              <Download size={14} className="text-brand-stone group-hover:text-brand-ink transition-colors" />
              <span className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Exportar CSV</span>
            </button>
          </div>
        </header>

        {monthlyGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-[#FCFBF9] rounded-[40px] border border-brand-mist/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)]">
            <div className="w-20 h-20 bg-brand-linen/60 rounded-full flex items-center justify-center text-brand-terracotta mb-8">
              <PieChart size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-serif text-brand-ink mb-3 px-2">Seu crescimento começa aqui</h3>
            <p className="text-base text-brand-stone max-w-md mx-auto font-light leading-relaxed px-4">
              Seus recebimentos vão aparecer aqui conforme sua agenda começar a movimentar.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Main Month Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 bg-[#FCFBF9] p-5 md:p-10 rounded-[32px] border border-[#F2EFEA] shadow-[0_8px_40px_-12px_rgba(137,103,88,0.06)] relative overflow-hidden flex flex-col justify-between min-h-[auto] md:min-h-[320px]"
              >
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-terracotta/[0.04] rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex md:items-center flex-col md:flex-row justify-between gap-4 md:gap-5 mb-6 md:mb-12">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-stone/80 mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta"></span>
                        Receita Realizada
                      </p>
                      <h4 className="text-2xl md:text-3xl font-serif text-brand-ink">Mês de {currentMonthData.current?.monthLabel.split(' ')[0] || 'Atual'}</h4>
                    </div>
                    {currentMonthData.growth !== 0 && (
                      <div className={cn(
                        "flex items-center self-start md:self-auto gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-bold",
                        currentMonthData.growth > 0 
                          ? "bg-[#F3F6F3] text-[#3D6B50]" 
                          : "bg-red-50 text-red-600 border border-red-100"
                      )}>
                        {currentMonthData.growth > 0 ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingUp size={12} strokeWidth={2.5} className="rotate-180" />}
                        <span className="relative top-[0.5px]">
                          {Math.abs(Math.round(currentMonthData.growth))}% {currentMonthData.growth > 0 ? "vs. mês anterior" : "vs. mês anterior"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col lg:flex-row lg:items-end gap-3 md:gap-8 lg:gap-10">
                    <div className="flex-1">
                      <p className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone mb-1 md:mb-2">
                        Recebido
                      </p>
                      <p className="text-3xl md:text-5xl lg:text-[64px] font-serif text-brand-ink tracking-tight leading-none">
                        {formatCurrency(currentMonthData.current?.revenue || 0)}
                      </p>
                    </div>
                    
                    <div className="hidden lg:block h-20 w-px bg-brand-mist/60" />
                    <div className="block lg:hidden h-px w-full bg-brand-mist/60" />
                    
                    <div className="flex-1 flex flex-col justify-end">
                      <p className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone mb-1 md:mb-2">
                        Previsto
                      </p>
                      <p className="text-xl md:text-3xl lg:text-4xl font-serif text-brand-ink/80 mb-1 md:mb-2 leading-none tracking-tight">
                        {formatCurrency(currentMonthData.current?.plannedRevenue || 0)}
                      </p>
                      <p className="text-[9px] md:text-[10px] text-brand-stone/70 font-light max-w-[200px] leading-relaxed">
                        Clientes já confirmadas para os próximos dias.
                      </p>
                    </div>

                    <div className="hidden lg:block h-20 w-px bg-brand-mist/60" />
                    <div className="block lg:hidden h-px w-full bg-brand-mist/60" />

                    <div className="flex-1 flex flex-col justify-end">
                      <p className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone mb-1 md:mb-2">
                        Aguardando
                      </p>
                      <p className="text-lg md:text-2xl lg:text-3xl font-serif text-brand-ink/60 mb-1 md:mb-2 leading-none tracking-tight">
                        {formatCurrency(currentMonthData.current?.pendingRevenue || 0)}
                      </p>
                      <p className="text-[9px] md:text-[10px] text-brand-stone/70 font-light max-w-[200px] leading-relaxed">
                        Solicitações pendentes de resposta.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-4 md:gap-5 lg:col-span-1">
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-brand-parchment/50 p-5 md:p-8 rounded-[32px] border border-brand-mist/50 shadow-sm flex-1 flex flex-col justify-center min-h-[130px] md:min-h-[150px]"
                >
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone flex items-center gap-2">
                      <PieChart size={12} className="text-brand-terracotta" /> Ticket Médio
                    </p>
                  </div>
                  <p className="text-3xl md:text-[40px] font-serif text-brand-ink tracking-tight mb-1.5 md:mb-2">
                    {formatCurrency(currentMonthData.current?.ticketAverage || 0)}
                  </p>
                  <p className="text-[10px] text-brand-stone italic font-light">Com base neste mês</p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-brand-parchment/50 p-5 md:p-8 rounded-[32px] border border-brand-mist/50 shadow-sm flex-1 flex flex-col justify-center min-h-[130px] md:min-h-[150px]"
                >
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone flex items-center gap-2">
                      <Users size={12} className="text-brand-terracotta" /> Atendimentos
                    </p>
                  </div>
                  <p className="text-3xl md:text-[40px] font-serif text-brand-ink tracking-tight mb-1.5 md:mb-2">
                    {currentMonthData.current?.appointmentsCount || 0}
                  </p>
                  <p className="text-[10px] text-brand-stone italic font-light">Realizados neste mês</p>
                </motion.div>
              </div>
            </div>

            {/* Receita por Serviço Section */}
            <div className="space-y-6 md:space-y-8 mt-12 md:mt-16 mb-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-serif text-brand-ink mb-2">Receita por serviço</h3>
                  <p className="text-sm md:text-base text-brand-stone font-light">Veja quais serviços mais movimentam seu mês.</p>
                </div>
              </div>

              {servicesRevenue.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {servicesRevenue.map((srv, idx) => (
                    <motion.div
                      key={srv.name + idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white p-5 md:p-7 rounded-[24px] border border-[#F2EFEA] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-md hover:border-brand-mist/80 transition-all group"
                    >
                      <div className="mb-5 md:mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone mb-2 line-clamp-1 group-hover:text-brand-ink transition-colors">
                          {srv.name}
                        </p>
                        <p className="text-2xl md:text-3xl font-serif text-brand-ink tracking-tight">
                          {formatCurrency(srv.revenue)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-brand-stone">
                        <span className="font-semibold bg-brand-linen/60 px-2.5 py-1 rounded text-brand-ink">
                          {srv.count} {srv.count === 1 ? 'agendamento' : 'agendamentos'}
                        </span>
                        {srv.count > 0 && (
                          <span className="italic font-light opacity-80">
                            Méd. {formatCurrency(srv.revenue / srv.count)}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#FCFBF9] p-10 rounded-[32px] border border-brand-mist/60 text-center shadow-sm">
                  <p className="text-brand-stone font-light max-w-sm mx-auto">
                    Assim que seus atendimentos forem confirmados, seus serviços mais fortes aparecerão aqui.
                  </p>
                </div>
              )}
            </div>

            {/* Monthly History Accordion */}
            <div className="space-y-4 md:space-y-6 pt-6 md:pt-8">
              <div className="flex items-center gap-4 mb-2">
                <h3 className="text-xl md:text-2xl font-serif text-brand-ink">
                  Histórico Mensal
                </h3>
                <div className="h-px bg-brand-mist/60 flex-1"></div>
              </div>
              
              <div className="space-y-4 md:space-y-5">
                {monthlyGroups.map((group, idx) => (
                  <motion.div 
                    key={group.monthKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-[24px] border border-[#F2EFEA] overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)]"
                  >
                    <button 
                      onClick={() => setExpandedMonth(expandedMonth === group.monthKey ? null : group.monthKey)}
                      className="w-full px-5 py-5 lg:px-8 lg:py-7 flex items-center justify-between text-left hover:bg-brand-parchment/30 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 flex-1">
                        <div className="min-w-[140px]">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-1">Mês</span>
                          <span className="text-xl font-serif text-brand-ink tracking-tight">{group.monthLabel}</span>
                        </div>
                        
                        <div className="min-w-[130px]">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta/80"></span> Recebido</span>
                          <span className="text-lg font-serif text-brand-ink tracking-tight">{formatCurrency(group.revenue)}</span>
                        </div>
                        
                        <div className="hidden sm:block min-w-[120px]">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-1">Previsto</span>
                          <span className="text-base font-medium text-brand-ink/80">{formatCurrency(group.plannedRevenue)}</span>
                        </div>
                        
                        <div className="hidden xl:block min-w-[140px]">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-1">Aguardando</span>
                          <span className="text-base font-medium text-brand-stone">{formatCurrency(group.pendingRevenue)}</span>
                        </div>
                        
                        <div className="hidden lg:block min-w-[100px]">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-1">Cancelado</span>
                          <span className="text-base font-medium text-brand-stone/60">{formatCurrency(group.cancelledRevenue)}</span>
                        </div>
                        
                        <div className="hidden md:block ml-auto text-right">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-stone block mb-2">Atendimentos</span>
                          <span className="text-[11px] font-bold text-brand-ink bg-[#FCFBF9] border border-brand-mist/60 px-3 py-1.5 rounded-full inline-block">{group.appointmentsCount} concluídos</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 ml-4">
                        <div className={`p-2 rounded-full transition-colors ${expandedMonth === group.monthKey ? 'bg-brand-mist/30 text-brand-ink' : 'text-brand-stone hover:bg-brand-mist/20'}`}>
                          {expandedMonth === group.monthKey ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedMonth === group.monthKey && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-brand-mist/40 bg-brand-parchment/20"
                        >
                          <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">Detalhes do Período</h5>
                              <button 
                                onClick={() => handleExportCSV(group)}
                                className={cn(
                                  "group flex items-center gap-2 px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border",
                                  profile?.plan === 'free' || !profile?.plan
                                    ? "bg-brand-stone/5 text-brand-stone/50 border-brand-mist/50 cursor-not-allowed"
                                    : "bg-white border-brand-mist hover:bg-brand-linen/30 hover:border-brand-mist/80 text-brand-ink shadow-sm"
                                )}
                              >
                                <Download size={12} className={profile?.plan === 'free' || !profile?.plan ? "text-brand-stone/50" : "text-brand-stone group-hover:text-brand-ink"} /> 
                                Exportar CSV
                                {(profile?.plan === 'free' || !profile?.plan) && <span className="ml-1 text-[7px] bg-brand-terracotta/20 text-brand-terracotta px-1.5 py-0.5 rounded-full">PRO</span>}
                              </button>
                            </div>

                            <div className="overflow-x-auto no-scrollbar -mx-8 px-8">
                              <table className="w-full text-left min-w-[600px]">
                                <thead>
                                  <tr className="border-b border-brand-mist">
                                    <th className="py-4 text-[9px] font-bold uppercase tracking-widest text-brand-stone">Data</th>
                                    <th className="py-4 text-[9px] font-bold uppercase tracking-widest text-brand-stone">Cliente</th>
                                    <th className="py-4 text-[9px] font-bold uppercase tracking-widest text-brand-stone">Serviço</th>
                                    <th className="py-4 text-[9px] font-bold uppercase tracking-widest text-brand-stone">Valor</th>
                                    <th className="py-4 text-[9px] font-bold uppercase tracking-widest text-brand-stone text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-mist/50">
                                  {group.appointments.map(appt => (
                                    <tr key={appt.id} className="group hover:bg-brand-linen/10 transition-colors">
                                      <td className="py-4">
                                        <span className="text-[11px] text-brand-ink font-medium">
                                          {new Date(appt.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                      </td>
                                      <td className="py-4">
                                        <div className="flex flex-col">
                                          <span className="text-[11px] text-brand-ink font-bold">{appt.clientName}</span>
                                          <span className="text-[9px] text-brand-stone italic">{appt.clientWhatsapp}</span>
                                        </div>
                                      </td>
                                      <td className="py-4">
                                        <span className="text-[11px] text-brand-stone">{appt.serviceName}</span>
                                      </td>
                                      <td className="py-4">
                                        <span className="text-[11px] text-brand-ink font-bold">
                                          {formatCurrency((appt.price || 0) + (appt.travelFee || 0))}
                                        </span>
                                      </td>
                                      <td className="py-4 text-right">
                                        <span className={cn(
                                          "px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest",
                                          isCompletedStatus(appt.status) ? "bg-green-50 text-green-600 border border-green-100" :
                                          isConfirmedLikeStatus(appt.status) ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                          isPendingStatus(appt.status) ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                          isCancelledStatus(appt.status) ? "bg-red-50 text-red-600 border border-red-100" :
                                          "bg-brand-linen text-brand-stone"
                                        )}>
                                          {isCompletedStatus(appt.status) ? 'Recebido' : 
                                           isConfirmedLikeStatus(appt.status) ? 'Previsto' : 
                                           isPendingStatus(appt.status) ? 'Aguardando confirmação' : 
                                           isCancelledStatus(appt.status) ? 'Cancelado' : appt.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      </PageErrorBoundary>
    </AppLayout>
  );
}
