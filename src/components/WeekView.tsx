import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Clock, Lock, Info, ChevronRight, AlertCircle, Plus, ChevronLeft } from 'lucide-react';
import { cn, formatLocalDate, formatDateKey } from '../lib/utils';
import { Appointment } from '../types';

interface WeekViewProps {
  appointments: Appointment[];
  blockedSchedules: any[];
  workingHours: any;
  weekStart: Date;
  onSelectAppointment: (appt: Appointment) => void;
  onSelectSlot: (date: string, time: string) => void;
  onSelectDay: (date: string) => void;
}

export default function WeekView({
  appointments,
  blockedSchedules,
  workingHours,
  weekStart,
  onSelectAppointment,
  onSelectSlot,
  onSelectDay
}: WeekViewProps) {
  
  // Create array of 7 days
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const [focusedIndex, setFocusedIndex] = useState(() => {
    const today = formatDateKey(new Date());
    const idx = days.findIndex(d => formatDateKey(d) === today);
    return idx === -1 ? 0 : idx;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const scrollToDay = (idx: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth;
      scrollRef.current.scrollTo({ left: width * idx, behavior: 'smooth' });
    }
    setFocusedIndex(idx);
  };

  // Time slots from 07:00 to 21:00
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 7; h <= 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const nowLineY = useMemo(() => {
    const h = currentTime.getHours();
    const m = currentTime.getMinutes();
    if (h < 7 || h > 21) return null;
    const minutesSinceStart = (h - 7) * 60 + m;
    // Each 30min slot is h-20 (80px)
    return (minutesSinceStart / 30) * 80;
  }, [currentTime]);

  const getAppointmentsForDayAndTime = (dateKey: string, time: string) => {
    return appointments.filter(a => a.date === dateKey && a.time === time);
  };

  const getBlockForDayAndTime = (dateKey: string, time: string, dayOfWeek: number) => {
    return blockedSchedules.find(b => {
      const isToday = b.date === dateKey;
      const isRecurringToday = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      if (!(isToday || isRecurringToday)) return false;
      
      const blockStart = b.startTime;
      const blockEnd = b.endTime;
      return time >= blockStart && time < blockEnd;
    });
  };

  return (
    <div className="w-full relative">
      {/* Boundary Fades */}
      <div className="fixed top-[64px] left-0 right-0 h-8 bg-gradient-to-b from-brand-linen/40 to-transparent pointer-events-none z-30" />

      {/* Sticky Header with Navigation */}
      <div className="sticky top-0 z-40 bg-brand-linen/80 backdrop-blur-md border-b border-brand-mist shadow-sm">
        <div className="flex items-center">
          <div className="w-12 border-r border-brand-mist flex items-center justify-center py-4 bg-brand-linen/10">
             <Clock size={14} className="text-brand-stone opacity-30" />
          </div>
          
          <div className="flex-1 flex overflow-x-auto no-scrollbar">
            {days.map((day, i) => {
              const dateKey = formatDateKey(day);
              const isToday = formatDateKey(new Date()) === dateKey;
              const isSelected = i === focusedIndex;
              
              return (
                <button 
                  key={dateKey} 
                  onClick={() => scrollToDay(i)}
                  className={cn(
                    "flex-1 min-w-[20%] md:min-w-[100px] py-4 text-center transition-all relative border-r border-brand-mist/30",
                    isSelected ? "bg-white" : "hover:bg-brand-white/50"
                  )}
                >
                  <p className={cn(
                    "text-[8px] font-bold uppercase tracking-widest mb-0.5",
                    isToday ? "text-brand-terracotta" : "text-brand-stone opacity-50"
                  )}>
                    {formatLocalDate(dateKey, { weekday: 'short' })}
                  </p>
                  <p className={cn(
                    "text-sm font-serif",
                    isToday ? "text-brand-terracotta font-bold" : "text-brand-ink",
                    isSelected && !isToday && "text-brand-ink"
                  )}>
                    {day.getDate()}
                  </p>
                  {isSelected && (
                    <motion.div 
                      layoutId="activeDay"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-terracotta"
                    />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Mobile Navigation Arrows */}
          <div className="md:hidden flex border-l border-brand-mist divide-x divide-brand-mist/30">
            <button 
              onClick={() => scrollToDay(Math.max(0, focusedIndex - 1))}
              disabled={focusedIndex === 0}
              className="p-4 text-brand-stone disabled:opacity-20"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => scrollToDay(Math.min(6, focusedIndex + 1))}
              disabled={focusedIndex === 6}
              className="p-4 text-brand-stone disabled:opacity-20"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid Content (Natural Scroll) */}
      <div className="bg-brand-white border-x border-b border-brand-mist shadow-sm overflow-hidden min-h-screen">
        <div className="flex relative">
          {/* Time Legend Column */}
          <div className="w-12 border-r border-brand-linen bg-brand-linen/5 shrink-0 sticky left-0 z-20">
            {timeSlots.map((time, i) => (
              <div key={time} className="h-20 border-b border-brand-linen/30 px-2 py-1 flex items-start justify-center">
                <span className="text-[8px] font-bold text-brand-stone opacity-30">{i % 2 === 0 ? time : ''}</span>
              </div>
            ))}
          </div>

          {/* Days Columns Columns */}
          <div 
            ref={scrollRef}
            onScroll={(e) => {
              const target = e.currentTarget;
              const idx = Math.round(target.scrollLeft / target.offsetWidth);
              if (idx !== focusedIndex && window.innerWidth < 768) {
                setFocusedIndex(idx);
              }
            }}
            className="flex flex-1 divide-x divide-brand-linen overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
          >
            {days.map((day, i) => {
              const dateKey = formatDateKey(day);
              const dayOfWeek = day.getDay();
              const isToday = formatDateKey(new Date()) === dateKey;

              return (
                <div key={dateKey} className={cn(
                  "flex-1 min-w-full md:min-w-[100px] relative bg-white snap-start", 
                  isToday && "bg-brand-terracotta/[0.01]"
                )}>
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
                    const appts = getAppointmentsForDayAndTime(dateKey, time);
                    const block = getBlockForDayAndTime(dateKey, time, dayOfWeek);
                    const [h, m] = time.split(':').map(Number);
                    const now = new Date();
                    const isPast = isToday && (h * 60 + m < now.getHours() * 60 + now.getMinutes());
                    
                    return (
                      <div 
                        key={`${dateKey}-${time}`} 
                        className={cn(
                          "h-20 border-b border-brand-linen/20 relative group active:bg-brand-linen/10 transition-colors",
                          isPast && "bg-brand-parchment/5"
                        )}
                        onClick={() => !block && appts.length === 0 && onSelectSlot(dateKey, time)}
                      >
                        {/* Empty slot interaction */}
                        {!block && appts.length === 0 && (
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-brand-linen/10 flex items-center justify-center transition-opacity cursor-pointer">
                            <Plus size={14} className="text-brand-terracotta/20" />
                          </div>
                        )}

                        {/* Block representation */}
                        {block && (
                          <div className="absolute inset-x-1 inset-y-1 rounded-lg bg-brand-stone/5 border border-brand-stone/10 flex flex-col items-center justify-center overflow-hidden">
                            <Lock size={10} className="text-brand-stone/20" />
                          </div>
                        )}

                        {/* Appointments representation */}
                        {appts.map((app, idx) => (
                          <motion.div
                            key={app.id}
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAppointment(app);
                            }}
                            className={cn(
                              "absolute inset-x-1 inset-y-1 rounded-xl p-2 cursor-pointer shadow-sm border overflow-hidden flex flex-col justify-center transition-all hover:shadow-md",
                              app.status === 'confirmed' || app.status === 'completed'
                                ? "bg-brand-ink text-white border-brand-ink"
                                : "bg-red-50 text-brand-ink border-red-200",
                              idx > 0 && "translate-x-1 translate-y-1 opacity-90 z-10 shadow-lg"
                            )}
                          >
                            <p className="text-[10px] font-bold truncate leading-tight uppercase tracking-tight">
                              {app.clientName.split(' ')[0]}
                            </p>
                            <p className={cn(
                              "text-[7px] truncate uppercase tracking-widest mt-0.5",
                              app.status === 'confirmed' || app.status === 'completed' ? "text-white/40" : "text-brand-stone"
                            )}>
                              {app.serviceName}
                            </p>
                            {app.status === 'pending' && (
                              <div className="absolute top-1 right-1">
                                <AlertCircle size={8} className="text-red-500" />
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Continuity Indicator */}
      <div className="pb-32 text-center">
         <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone opacity-30 italic">Fim da visualização semanal</p>
      </div>
    </div>
  );
}
