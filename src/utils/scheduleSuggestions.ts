
import { Appointment, WorkingHours, BlockedSchedule } from '../types';

interface SuggestionParams {
  date: string;
  serviceDuration: number;
  appointments: Appointment[];
  blockedSchedules: BlockedSchedule[];
  workingHours: WorkingHours;
}

export interface ScoredSlot {
  time: string;
  score: number;
}

export interface IntelligentFit {
  time: string;
  type: 'direct' | 'adjustment';
  adjustment?: {
    appointmentId: string;
    clientName: string;
    originalTime: string;
    newTime: string;
    shift: number; // minutes
    type: 'earlier' | 'later';
  };
}

interface SuggestionResult {
  bestSlot: ScoredSlot | null;
  otherSlots: ScoredSlot[];
  intelligentFits: IntelligentFit[];
}

/**
 * Sugere horários livres para um determinado dia e serviço com ranking de qualidade.
 * Fase 2: Cálculo de score para reduzir "buracos" na agenda.
 */
export function getAvailableSlots({
  date,
  serviceDuration,
  appointments,
  blockedSchedules,
  workingHours
}: SuggestionParams): SuggestionResult {
  if (!date || !workingHours || !serviceDuration) return { bestSlot: null, otherSlots: [], intelligentFits: [] };

  const startTime = workingHours.startTime || '09:00';
  const endTime = workingHours.endTime || '18:00';
  const workingDays = workingHours.workingDays || [];

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  if (workingDays.length > 0 && !workingDays.includes(dayOfWeek)) return { bestSlot: null, otherSlots: [], intelligentFits: [] };

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  const occupiedSegments: { start: number; end: number }[] = [];

  appointments.forEach(appt => {
    if (appt.date === date && !['cancelled', 'cancelled_by_client', 'cancelled_by_professional', 'rejected', 'expired'].includes(appt.status)) {
      const [h, m] = appt.time.split(':').map(Number);
      const start = h * 60 + m;
      const duration = appt.duration || 60;
      occupiedSegments.push({ start, end: start + duration });
    }
  });

  blockedSchedules.forEach(block => {
    const isDateMatch = block.date === date;
    const isRecurringToday = block.isRecurring && block.recurringDays?.includes(dayOfWeek);
    if (isDateMatch || isRecurringToday) {
      const [sh, sm] = block.startTime.split(':').map(Number);
      const [eh, em] = block.endTime.split(':').map(Number);
      occupiedSegments.push({ start: sh * 60 + sm, end: eh * 60 + em });
    }
  });

  // Sort segments to make gap calculation easier
  occupiedSegments.sort((a, b) => a.start - b.start);

  const scoredSlots: ScoredSlot[] = [];
  const now = new Date();
  const todayStr = getTodayLocale();
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();
  
  const step = 30;

  for (let current = startTotalMinutes; current < endTotalMinutes; current += step) {
    const proposedEnd = current + serviceDuration;
    if (proposedEnd > endTotalMinutes) break;
    if (date === todayStr && current <= currentMinutesNow + 15) continue;

    const hasOverlap = occupiedSegments.some(seg => 
      Math.max(current, seg.start) < Math.min(proposedEnd, seg.end)
    );

    if (!hasOverlap) {
      // --- HEURÍSTICA DE SCORE ---
      let score = 100;

      // 1. Verificar vizinhos (priorizar encostar em outros agendamentos/bloqueios)
      const prevSegment = [...occupiedSegments].reverse().find(s => s.end <= current);
      const nextSegment = occupiedSegments.find(s => s.start >= proposedEnd);

      // Distância do início (gap anterior)
      const prevGap = prevSegment ? current - prevSegment.end : current - startTotalMinutes;
      // Distância do fim (gap posterior)
      const nextGap = nextSegment ? nextSegment.start - proposedEnd : endTotalMinutes - proposedEnd;

      // Bonus por encaixe perfeito (sem gap)
      if (prevGap === 0) score += 30;
      if (nextGap === 0) score += 30;

      // Penalidade por "buracos pequenos" inúteis (ex: 15 ou 20 min sobrando)
      // Se o gap resultante for > 0 mas < 30 min, penaliza muito
      if (prevGap > 0 && prevGap < 30) score -= 50;
      if (nextGap > 0 && nextGap < 30) score -= 50;

      // Proximidade do horário comercial (priorizar manhãs ou início de turnos)
      // score -= Math.floor(current / 120); // Leve penalidade conforme o dia passa

      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      scoredSlots.push({ 
        time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        score 
      });
    }
  }

  // Ordenar por score descrescente, depois por horário
  scoredSlots.sort((a, b) => b.score - a.score || a.time.localeCompare(b.time));

  const finalSlots = scoredSlots.slice(0, 5);
  
  // --- PHASE 4: INTELLIGENT FITS ---
  const intelligentFits: IntelligentFit[] = [];
  
  // Helper to find gaps
  const findGaps = () => {
    const gaps: { start: number; end: number; duration: number; prevId?: string; nextId?: string; prevName?: string; nextName?: string }[] = [];
    
    // Day segments including working bounds
    const daySegments = [
      { start: startTotalMinutes, end: startTotalMinutes, type: 'boundary' },
      ...occupiedSegments.map(s => ({ ...s, type: 'occupied' })),
      { start: endTotalMinutes, end: endTotalMinutes, type: 'boundary' }
    ];

    for (let i = 0; i < daySegments.length - 1; i++) {
      const current = daySegments[i];
      const next = daySegments[i+1];
      const gapDuration = next.start - current.end;
      
      if (gapDuration > 0) {
        // Get original appointment info for adjustments
        const prevAppt = appointments.find(a => {
          const [h, m] = a.time.split(':').map(Number);
          return a.date === date && h * 60 + m + (a.duration || 60) === current.end;
        });
        const nextAppt = appointments.find(a => {
          const [h, m] = a.time.split(':').map(Number);
          return a.date === date && h * 60 + m === next.start;
        });

        gaps.push({ 
          start: current.end, 
          end: next.start, 
          duration: gapDuration,
          prevId: prevAppt?.id,
          prevName: prevAppt?.clientName,
          nextId: nextAppt?.id,
          nextName: nextAppt?.clientName
        });
      }
    }
    return gaps;
  };

  const dayGaps = findGaps();

  dayGaps.forEach(gap => {
    // 1. Direct fits (already in suggestions probably, but let's highlight)
    if (gap.duration >= serviceDuration) {
      const hours = Math.floor(gap.start / 60);
      const mins = gap.start % 60;
      intelligentFits.push({
        time: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
        type: 'direct'
      });
    } else {
      // 2. Adjustment fits (Simulate adjustments up to 15min)
      const diff = serviceDuration - gap.duration;
      if (diff <= 15) {
        // Try adjusting previous earlier (if exists and is appointment)
        if (gap.prevId) {
          const originalTime = minutesToTime(gap.start - (serviceDuration - gap.duration + (gap.duration - (serviceDuration - (gap.start))))); 
          // Simplified: If we move prev back by 'diff', we start at current.end - diff
          const newStart = gap.start - diff;
          if (newStart >= startTotalMinutes) {
             // Check if moving prev wouldn't hit its own predecessor
             // For simplify in Phase 4: we only check if it fits in the working hours and the previous gap
             // In a real app we'd check the entire chain.
             intelligentFits.push({
               time: minutesToTime(newStart),
               type: 'adjustment',
               adjustment: {
                 appointmentId: gap.prevId,
                 clientName: gap.prevName || 'Cliente',
                 originalTime: minutesToTime(gap.start - (getApptDuration(gap.prevId, appointments))),
                 newTime: minutesToTime(newStart - (getApptDuration(gap.prevId, appointments))),
                 shift: diff,
                 type: 'earlier'
               }
             });
          }
        }
        
        // Try adjusting next later (if exists and is appointment)
        if (gap.nextId && intelligentFits.length < 3) {
          const newTime = gap.start; // We start at the same gap start
          intelligentFits.push({
            time: minutesToTime(newTime),
            type: 'adjustment',
            adjustment: {
              appointmentId: gap.nextId,
              clientName: gap.nextName || 'Cliente',
              originalTime: minutesToTime(gap.end),
              newTime: minutesToTime(gap.end + diff),
              shift: diff,
              type: 'later'
            }
          });
        }
      }
    }
  });

  if (finalSlots.length === 0 && intelligentFits.length === 0) return { bestSlot: null, otherSlots: [], intelligentFits: [] };

  return {
    bestSlot: finalSlots[0] || null,
    otherSlots: finalSlots.slice(1),
    intelligentFits: intelligentFits.slice(0, 3)
  };
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getApptDuration(id: string, appointments: Appointment[]): number {
  return appointments.find(a => a.id === id)?.duration || 60;
}

function getTodayLocale(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
