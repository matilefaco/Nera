import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, Lock, Info, Plus, AlertCircle } from 'lucide-react';
import { cn, formatLocalDate, formatDateKey } from '../lib/utils';
import { Appointment } from '../types';

interface DayViewProps {
  appointments: Appointment[];
  blockedSchedules: any[];
  date: string;
  onSelectAppointment: (appt: Appointment) => void;
  onSelectSlot: (time: string) => void;
}

export default function DayView({
  appointments,
  blockedSchedules,
  date,
  onSelectAppointment,
  onSelectSlot
}: DayViewProps) {
  
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const getAppointmentsForTime = (time: string) => {
    return appointments.filter(a => a.time === time);
  };

  const getBlockForTime = (time: string) => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    return blockedSchedules.find(b => {
      const isDateMatch = b.date === date;
      const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      if (!(isDateMatch || isRecurringToday)) return false;
      return time >= b.startTime && time < b.endTime;
    });
  };

  const dayStats = useMemo(() => {
    const confirmed = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length;
    const pending = appointments.filter(a => a.status === 'pending').length;
    return { confirmed, pending };
  }, [appointments]);

  const isToday = formatDateKey(new Date()) === date;

  const nowLineY = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < 7 || h > 21) return null;
    const minutesSinceStart = (h - 7) * 60 + m;
    // Each 30min slot is h-20 (80px)
    return (minutesSinceStart / 30) * 80;
  }, [isToday]);

  return (
    <div className="w-full relative">
      {/* Boundary Fades */}
      <div className="fixed top-[64px] left-0 right-0 h-8 bg-gradient-to-b from-brand-linen/40 to-transparent pointer-events-none z-30" />
      
      {/* 1. STICKY HEADER */}
      <div className="sticky top-0 z-40 bg-brand-linen/80 backdrop-blur-md px-6 py-5 border-b border-brand-mist flex items-center justify-between shadow-sm">
        <div>
           <h3 className="text-sm font-serif text-brand-ink">
             {formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
           </h3>
           <div className="flex gap-3 mt-1">
              <span className="text-[8px] font-bold uppercase tracking-widest text-brand-stone">
                {dayStats.confirmed} Confirmados
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-red-500">
                {dayStats.pending} Pendentes
              </span>
           </div>
        </div>
        {isToday && (
          <span className="bg-brand-terracotta text-white text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
            Hoje
          </span>
        )}
      </div>

      {/* 2. TIMELINE (Natural Body Scroll) */}
      <div className="bg-brand-white border-x border-b border-brand-mist shadow-sm overflow-hidden min-h-screen mb-20">
        <div className="flex relative">
          {/* Time Legend Column */}
          <div className="w-16 border-r border-brand-linen bg-brand-linen/5 shrink-0 sticky left-0 z-10">
            {timeSlots.map((time, i) => (
              <div key={time} className="h-20 border-b border-brand-linen/30 px-2 py-1 flex items-start justify-center">
                <span className="text-[10px] font-bold text-brand-stone opacity-30">{i % 2 === 0 ? time : ''}</span>
              </div>
            ))}
          </div>

          {/* Single Day Column */}
          <div className="flex-1 relative bg-white">
            {/* Current Time Indicator Line */}
            {isToday && nowLineY !== null && (
              <div 
                className="absolute left-0 right-0 z-10 border-t-2 border-brand-terracotta pointer-events-none flex items-center"
                style={{ top: `${nowLineY}px` }}
              >
                <div className="w-2 h-2 rounded-full bg-brand-terracotta -ml-1 shadow-sm" />
                <span className="ml-2 bg-brand-terracotta text-white text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest shadow-sm">
                  Agora
                </span>
              </div>
            )}

            {timeSlots.map((time) => {
              const appts = getAppointmentsForTime(time);
              const block = getBlockForTime(time);
              const now = new Date();
              const [h, m] = time.split(':').map(Number);
              const isPast = isToday && (h * 60 + m < now.getHours() * 60 + now.getMinutes());

              return (
                <div 
                  key={time} 
                  className={cn(
                    "h-20 border-b border-brand-linen/30 relative group active:bg-brand-linen/10 transition-colors",
                    isPast && "bg-brand-parchment/10"
                  )}
                  onClick={() => !block && appts.length === 0 && onSelectSlot(time)}
                >
                  {!block && appts.length === 0 && (
                    <div className="absolute inset-x-2 inset-y-1 opacity-0 group-hover:opacity-100 bg-brand-linen/20 rounded-xl flex items-center justify-center transition-opacity cursor-pointer">
                      <div className="flex items-center gap-1.5 text-brand-terracotta/40">
                         <Plus size={16} />
                         <span className="text-[8px] font-bold uppercase tracking-widest">Liberar Horário</span>
                      </div>
                    </div>
                  )}

                  {block && (
                    <div className="absolute inset-x-2 inset-y-1 rounded-xl bg-brand-stone/5 border border-brand-stone/10 flex items-center gap-3 px-4 overflow-hidden">
                      <Lock size={14} className="text-brand-stone/30" />
                      <p className="text-[8px] font-bold uppercase tracking-widest text-brand-stone/40">
                        {block.reason || 'Bloqueado'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 p-1 h-full">
                    {appts.map((app) => (
                      <motion.div
                        key={app.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAppointment(app);
                        }}
                        className={cn(
                          "flex-1 rounded-xl p-3 cursor-pointer shadow-sm border flex items-center justify-between group transition-all",
                          app.status === 'confirmed' || app.status === 'completed'
                            ? "bg-brand-ink text-white border-brand-ink"
                            : "bg-red-50 text-brand-ink border-red-200"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm shrink-0",
                            app.status === 'confirmed' || app.status === 'completed' ? "bg-white/10" : "bg-red-100"
                          )}>
                            {app.clientName[0]}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold leading-tight truncate">{app.clientName}</p>
                            <p className={cn(
                              "text-[8px] uppercase tracking-widest mt-0.5 truncate",
                              app.status === 'confirmed' || app.status === 'completed' ? "text-white/60" : "text-brand-stone"
                            )}>
                              {app.serviceName}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest">{app.time}</p>
                          {app.status === 'pending' && <AlertCircle size={10} className="text-red-500 mt-1" />}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Continuity Indicator */}
      <div className="pb-32 text-center">
         <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone opacity-30 italic">Fim dos horários do dia</p>
      </div>
    </div>
  );
}
