
import { Appointment, WorkingHours, BlockedSchedule } from '../types.js';

export interface DayAvailability {
  availableSlots: string[];
  availableCount: number;
  confirmedCount: number;
  pendingCount: number;
  blockedCount: number;
  nextAvailableSlot: string | null;
  isToday: boolean;
  date: string;
}

interface TimeRange {
  start: number; // minutos desde 00:00
  end: number;
  type?: 'appointment' | 'block';
  status?: string;
  id?: string;
  reason?: string;
}

/**
 * Converte bloqueios brutos em ranges de minutos para um dia específico.
 */
export function getBlockedRanges(selectedDate: string, blockedSchedules: BlockedSchedule[]): TimeRange[] {
  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();

  return blockedSchedules
    .filter(b => {
      const isFixed = b.date === selectedDate;
      const isRecurring = b.isRecurring && b.recurringDays?.includes(dayOfWeek);
      return isFixed || isRecurring;
    })
    .map(b => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return {
        start: sh * 60 + sm,
        end: eh * 60 + em,
        type: 'block',
        reason: b.reason,
        id: b.id
      };
    });
}

/**
 * Mescla ranges que se sobrepõem para otimizar cálculos e evitar redundâncias.
 */
export function mergeBlockedRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length <= 1) return ranges;

  // Ordenar por início
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    if (current.start <= last.end) {
      // Sobreposição encontrada, expandir o fim do anterior
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Aplica os bloqueios mesclados e agendamentos à lista de slots gerados.
 * Internamente usado no motor de cálculo.
 */
export function applyBlocksToAvailability(
  current: number, 
  proposedEnd: number, 
  occupiedSegments: TimeRange[]
): boolean {
  return occupiedSegments.some(seg => {
    return Math.max(current, seg.start) < Math.min(proposedEnd, seg.end);
  });
}

/**
 * Retorna a string YYYY-MM-DD na data local (não UTC).
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converte string YYYY-MM-DD para objeto Date local.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Função Mestra de Validação de Reserva
 * Responde se UM horário específico pode ser reservado.
 */
export function canBookSlot({
  date,
  time,
  workingHours,
  appointments,
  blockedSchedules,
  serviceDuration = 60,
  now = new Date()
}: {
  date: string;
  time: string;
  workingHours: WorkingHours;
  appointments: Appointment[];
  blockedSchedules: BlockedSchedule[];
  serviceDuration?: number;
  now?: Date;
}): { canBook: boolean; reason?: string } {
  const slots = getBookableSlotsForDate({
    date,
    workingHours,
    appointments,
    blockedSchedules,
    serviceDuration,
    now
  });

  if (slots.includes(time)) {
    return { canBook: true };
  }

  // Identificar motivo para o debug
  const dateObj = parseLocalDate(date);
  const dayOfWeek = dateObj.getDay();
  if (!workingHours.workingDays.includes(dayOfWeek)) return { canBook: false, reason: "Não é dia de trabalho" };

  const todayStr = getLocalDateStr(now);
  if (date === todayStr) {
    const [h, m] = time.split(':').map(Number);
    const slotMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (slotMinutes <= nowMinutes + 40) return { canBook: false, reason: "Horário já passou (margem 40min)" };
  }

  return { canBook: false, reason: "Conflito com reserva, bloqueio ou fora do expediente" };
}

/**
 * Função Central de Disponibilidade do Nera (Public Presence)
 * Esta é a ÚNICA fonte da verdade para o badge e para a agenda.
 * Retorna APENAS os horários que devem aparecer como botões clicáveis.
 */
export function getBookableSlotsForDate({
  date,
  workingHours,
  appointments,
  blockedSchedules,
  serviceDuration = 60,
  now = new Date()
}: {
  date: string;
  workingHours: WorkingHours;
  appointments: Appointment[];
  blockedSchedules: BlockedSchedule[];
  serviceDuration?: number;
  now?: Date;
}): string[] {
  if (!date || !workingHours) return [];
  
  const startTime = workingHours.startTime || '09:00';
  const endTime = workingHours.endTime || '18:00';
  const workingDays = workingHours.workingDays || [1, 2, 3, 4, 5];

  // 1. Verificar se é dia de trabalho
  const dateObj = parseLocalDate(date);
  const dayOfWeek = dateObj.getDay();
  if (!workingDays.includes(dayOfWeek)) return [];

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  const occupiedSegments: TimeRange[] = [];

  // 2. Appointments (Confirmados, pendentes, concluídos e aceitos bloqueiam publicamente)
  // Regra de Produto Nera: Se existe qualquer reserva no horário (inclusive pendente), o slot não aparece como livre.
  appointments.forEach(appt => {
    if (appt.date === date && ['confirmed', 'completed', 'accepted', 'pending'].includes(appt.status)) {
      const [h, m] = appt.time.split(':').map(Number);
      const start = h * 60 + m;
      const duration = Number(appt.duration) || 60;
      occupiedSegments.push({ start, end: start + duration, type: 'appointment' });
    }
  });

  // 3. Bloqueios Profissionais
  const rawBlocks = getBlockedRanges(date, blockedSchedules);
  const mergedBlocks = mergeBlockedRanges(rawBlocks);
  occupiedSegments.push(...mergedBlocks);

  const freeSlots: string[] = [];
  const todayStr = getLocalDateStr(now);
  const isToday = date === todayStr;
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();
  const step = 30; // Granularidade de busca
  
  for (let current = startTotalMinutes; current < endTotalMinutes; current += step) {
    const proposedEnd = current + serviceDuration;
    if (proposedEnd > endTotalMinutes) break;

    // Regra: Se for hoje, não mostrar horários passados (margem de 40min)
    if (isToday && current <= currentMinutesNow + 40) continue; 

    const hasOverlap = applyBlocksToAvailability(current, proposedEnd, occupiedSegments);

    if (!hasOverlap) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      freeSlots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    }
  }

  return Array.from(new Set(freeSlots)).sort();
}

export interface GetAvailableSlotsParams {
  selectedDate: string; // YYYY-MM-DD
  serviceDuration: number; // em minutos
  workingHours: WorkingHours;
  appointments: Appointment[];
  blockedSchedules?: BlockedSchedule[];
  includePastSlots?: boolean;
  mergedBlocks?: TimeRange[]; 
}

/**
 * Motor de Legado (mantido para compatibilidade, agora roteando para a fonte da verdade)
 */
export function getDayAvailability(params: GetAvailableSlotsParams): DayAvailability {
  const slots = getBookableSlotsForDate({
    date: params.selectedDate,
    workingHours: params.workingHours,
    appointments: params.appointments,
    blockedSchedules: params.blockedSchedules || [],
    serviceDuration: params.serviceDuration
  });

  return {
    availableSlots: slots,
    availableCount: slots.length,
    confirmedCount: params.appointments.filter(a => a.date === params.selectedDate && ['confirmed', 'completed'].includes(a.status)).length,
    pendingCount: params.appointments.filter(a => a.date === params.selectedDate && a.status === 'pending').length,
    blockedCount: getBlockedRanges(params.selectedDate, params.blockedSchedules || []).length,
    nextAvailableSlot: slots[0] || null,
    isToday: params.selectedDate === getLocalDateStr(),
    date: params.selectedDate
  };
}

export function getAvailableSlots(params: GetAvailableSlotsParams): string[] {
  return getBookableSlotsForDate({
    date: params.selectedDate,
    workingHours: params.workingHours,
    appointments: params.appointments,
    blockedSchedules: params.blockedSchedules || [],
    serviceDuration: params.serviceDuration
  });
}

/**
 * Helper unificado para encontrar o próximo slot disponível na semana.
 * Garante paridade total entre a vitrine (badge) e a agenda.
 */
export function getNextAvailableSlot({
  workingHours,
  appointments,
  blockedSchedules,
  serviceDuration = 60,
  daysToLookAhead = 14
}: {
  workingHours: WorkingHours;
  appointments: Appointment[];
  blockedSchedules: BlockedSchedule[];
  serviceDuration?: number;
  daysToLookAhead?: number;
}): { date: string; time: string; totalWeeklySlots: number } | null {
  let firstSlot: { date: string; time: string } | null = null;
  let totalCounter = 0;
  const now = new Date();
  
  console.log(`[BADGE NEXT SLOT] Starting search for next 14 days. duration=${serviceDuration}`);

  for (let i = 0; i < daysToLookAhead; i++) {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + i);
    const dateStr = getLocalDateStr(targetDate);
    
    const slots = getBookableSlotsForDate({
      date: dateStr,
      workingHours,
      appointments,
      blockedSchedules,
      serviceDuration,
      now
    });
    
    totalCounter += slots.length;
    
    // LOGS DE DEBUG RECURSIVOS (PEDIDO PELO USUÁRIO)
    if (i < 7) {
      console.log(`[BADGE NEXT SLOT] date checked: ${dateStr}`);
      console.log(`[BADGE NEXT SLOT] slots from getBookableSlotsForDate: ${slots.length}`);
    }

    if (slots.length > 0 && !firstSlot) {
      console.log(`[BADGE NEXT SLOT] chosen: ${slots[0]} for date ${dateStr}`);
      firstSlot = { date: dateStr, time: slots[0] };
    }
  }
  
  if (!firstSlot) return null;
  return { ...firstSlot, totalWeeklySlots: totalCounter };
}

