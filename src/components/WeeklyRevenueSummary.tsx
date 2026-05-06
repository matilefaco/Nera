import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Calendar, Clock, Target, 
  ChevronRight, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, AlertCircle, Plus, X 
} from 'lucide-react';
import { formatCurrency, cn, getTodayLocale, parseLocalDate } from '../lib/utils';
import { Appointment, UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { notify } from '../lib/notify';
import { isRevenueStatus, isPendingStatus, isCompletedStatus, isConfirmedLikeStatus } from '../constants/appointmentStatus';

interface WeeklyRevenueSummaryProps {
  appointments: Appointment[];
  profile: UserProfile | null;
  userId: string;
  showOnlyToday?: boolean;
  hideTodayFlow?: boolean;
}

export default function WeeklyRevenueSummary({ 
  appointments, 
  profile, 
  userId, 
  showOnlyToday = false,
  hideTodayFlow = false
}: WeeklyRevenueSummaryProps) {
  const [isSettingGoal, setIsSettingGoal] = useState(false);
  const [goalValue, setGoalValue] = useState(profile?.monthlyRevenueGoal?.toString() || '');

  const todayStr = getTodayLocale();
  
  // Helper to get start of current week (Monday)
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(new Date());
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);
  
  const endOfPrevMonth = new Date(startOfMonth);
  endOfPrevMonth.setDate(0);

  // Calculations
  const metrics = appointments.reduce((acc, app) => {
    const appDate = new Date(app.date + 'T12:00:00');
    const appValue = (app.price || 0) + (app.travelFee || 0);

    // Today
    if (app.date === todayStr) {
      if (isRevenueStatus(app.status)) {
        acc.todayRevenue += appValue;
        acc.todayCount++;
      }
      acc.todayAll.push(app);
    }

    // This Week
    if (appDate >= startOfWeek) {
      if (isRevenueStatus(app.status)) {
        acc.weekRevenue += appValue;
        acc.weekCount++;
      }
      if (isPendingStatus(app.status)) {
        acc.weekProjected += appValue;
      }
    }

    // This Month
    if (appDate >= startOfMonth) {
      if (isRevenueStatus(app.status)) {
        acc.monthRevenue += appValue;
      }
    }

    // Prev Month
    if (appDate >= startOfPrevMonth && appDate <= endOfPrevMonth) {
      if (isRevenueStatus(app.status)) {
        acc.prevMonthRevenue += appValue;
      }
    }

    return acc;
  }, {
    todayRevenue: 0,
    todayCount: 0,
    todayAll: [] as Appointment[],
    weekRevenue: 0,
    weekCount: 0,
    weekProjected: 0,
    monthRevenue: 0,
    prevMonthRevenue: 0
  });

  const monthVariation = metrics.prevMonthRevenue > 0 
    ? ((metrics.monthRevenue - metrics.prevMonthRevenue) / metrics.prevMonthRevenue) * 100 
    : 0;

  const weekMetaProgress = profile?.monthlyRevenueGoal 
    ? (metrics.weekRevenue / (profile.monthlyRevenueGoal / 4)) * 100 
    : 0;

  const handleSetGoal = async () => {
    const value = parseFloat(goalValue);
    if (isNaN(value)) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), {
        monthlyRevenueGoal: value
      });
      notify.success('Meta mensal atualizada! 🎯');
      setIsSettingGoal(false);
    } catch (err) {
      notify.error('Erro ao salvar meta.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Cards 1-3 */}
      <div className={cn(
        "grid gap-6",
        showOnlyToday ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
      )}>
        {/* Today Card */}
        <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone font-serif">Fluxo Financeiro de Hoje</span>
            <div className="p-2 bg-brand-linen text-brand-ink rounded-lg"><Clock size={16} /></div>
          </div>
          <div>
            <p className="text-3xl font-serif text-brand-ink">{formatCurrency(metrics.todayRevenue)}</p>
            <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest mt-1">
              {metrics.todayCount} atendimentos confirmados/concluídos
            </p>
          </div>
        </div>

        {!showOnlyToday && (
          <>
            {/* Week Card */}
            <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone">Esta Semana</span>
                <div className="p-2 bg-brand-linen text-brand-ink rounded-lg"><TrendingUp size={16} /></div>
              </div>
              <div>
                <p className="text-2xl font-serif text-brand-ink">{formatCurrency(metrics.weekRevenue)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[9px] text-brand-stone font-bold uppercase tracking-widest">
                    Meta Semanal
                  </span>
                  <span className="text-[9px] text-brand-ink font-bold">
                    {Math.min(100, Math.round(weekMetaProgress))}%
                  </span>
                </div>
                <div className="h-1 bg-brand-linen rounded-full mt-1 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, weekMetaProgress)}%` }}
                    className="h-full bg-brand-terracotta"
                  />
                </div>
              </div>
            </div>

            {/* Month Card */}
            <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone">Este Mês</span>
                <div className="p-2 bg-brand-linen text-brand-ink rounded-lg"><Target size={16} /></div>
              </div>
              <div>
                <p className="text-2xl font-serif text-brand-ink">{formatCurrency(metrics.monthRevenue)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {monthVariation >= 0 ? (
                    <ArrowUpRight size={14} className="text-green-500" />
                  ) : (
                    <ArrowDownRight size={14} className="text-red-500" />
                  )}
                  <span className={cn(
                    "text-[10px] font-bold",
                    monthVariation >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {Math.abs(Math.round(monthVariation))}% vs mês anterior
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Goal Setting */}
      {!showOnlyToday && (
        <div className="flex justify-center">
          {isSettingGoal ? (
            <div className="flex items-center gap-2 bg-brand-white p-2 rounded-full border border-brand-mist shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone ml-3">R$</span>
              <input 
                type="number"
                value={goalValue}
                onChange={(e) => setGoalValue(e.target.value)}
                placeholder="Ex: 5000"
                className="bg-transparent outline-none text-xs font-bold text-brand-ink w-24"
              />
              <button 
                onClick={handleSetGoal}
                className="bg-brand-ink text-white px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
              >
                Confirmar
              </button>
              <button 
                onClick={() => setIsSettingGoal(false)}
                className="text-brand-stone hover:text-brand-ink p-1 mr-2"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsSettingGoal(true)}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
            >
              <span className="w-6 h-6 rounded-full border border-brand-mist flex items-center justify-center">
                <Plus size={12} />
              </span>
              {profile?.monthlyRevenueGoal ? 'Redefinir meta mensal' : 'Definir meta mensal'}
            </button>
          )}
        </div>
      )}

      {/* Today's Timeline (Hidden if showOnlyToday or hideTodayFlow is true) */}
      {!showOnlyToday && !hideTodayFlow && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-serif text-xl text-brand-ink italic">Fluxo de Hoje</h3>
            <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest">
              {metrics.todayCount} confirmados
            </p>
          </div>

          <div className="space-y-3">
            {metrics.todayAll.length > 0 ? (
              metrics.todayAll
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((app) => (
                  <div 
                    key={app.id}
                    className={cn(
                      "bg-brand-white p-5 rounded-[24px] border border-brand-mist flex items-center justify-between group transition-all",
                      isPendingStatus(app.status) && "opacity-60 grayscale-[0.5]"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-serif text-brand-ink">{app.time}</span>
                        <div className="w-0.5 h-6 bg-brand-linen my-1" />
                        <span className="text-[9px] text-brand-stone font-bold uppercase tracking-widest">
                          {app.status}
                        </span>
                      </div>
                      
                      <div>
                        <h4 className="text-[11px] font-bold text-brand-ink uppercase tracking-widest">{app.clientName}</h4>
                        <p className="text-[10px] text-brand-stone font-medium italic mt-0.5">{app.serviceName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-brand-ink">{formatCurrency(app.price + (app.travelFee || 0))}</p>
                        <p className="text-[8px] text-brand-stone font-bold uppercase tracking-widest">Final</p>
                      </div>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isCompletedStatus(app.status) ? "bg-green-50 text-green-600" :
                        isConfirmedLikeStatus(app.status) ? "bg-blue-50 text-blue-600" :
                        "bg-brand-linen text-brand-stone"
                      )}>
                        {isCompletedStatus(app.status) ? <CheckCircle2 size={18} /> : 
                         isPendingStatus(app.status) ? <AlertCircle size={18} /> :
                         <Calendar size={18} />}
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="py-12 bg-brand-parchment/30 rounded-[40px] border border-brand-mist border-dashed flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-brand-stone mb-4 shadow-sm">
                  <Calendar size={24} />
                </div>
                <p className="font-serif text-brand-ink italic text-lg">Sem agendamentos para hoje.</p>
                <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest mt-2 max-w-[200px]">
                  Aproveite o tempo para organizar seu portfólio ou prospectar novas clientes!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
