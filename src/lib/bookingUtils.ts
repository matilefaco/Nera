
/**
 * Calcula os horários disponíveis para um agendamento.
 * Baseia-se no expediente da profissional, duração do serviço e bloqueios existentes.
 */

import { Appointment, WorkingHours, BlockedSchedule } from '../types';

interface GetAvailableSlotsParams {
  selectedDate: string; // YYYY-MM-DD
  serviceDuration: number; // em minutos
  workingHours: WorkingHours;
  appointments: Appointment[];
  blockedSchedules?: BlockedSchedule[]; // Refatorado para múltiplos tipos de bloqueio
}

/**
 * Calcula os horários disponíveis para um agendamento.
 * Refatorado para ser tecnicamente robusto, evitando sobreposições e respeitando durações.
 */
export function getAvailableSlots({
  selectedDate,
  serviceDuration,
  workingHours,
  appointments,
  blockedSchedules = []
}: GetAvailableSlotsParams): string[] {
  // 1. Validação básica de entrada
  if (!selectedDate || !serviceDuration || !workingHours) return [];
  
  const startTime = workingHours.startTime || '09:00';
  const endTime = workingHours.endTime || '18:00';
  const workingDays = workingHours.workingDays || [1, 2, 3, 4, 5];

  // 2. Verificar se o dia da semana é trabalhado
  const date = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = date.getDay();
  if (!workingDays.includes(dayOfWeek)) {
    return [];
  }

  // 3. Converter horários de expediente para minutos totais desde 00:00
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  // 4. Mapear janelas ocupadas (appointments ativos + bloqueios manuais)
  const occupiedSegments: { start: number; end: number }[] = [];

  // Adicionar appointments (apenas os que estão confirmados ou concluídos)
  appointments.forEach(appt => {
    if (['confirmed', 'completed', 'pending'].includes(appt.status)) { // Incluímos pending para evitar overbooking durante confirmação
      const [h, m] = appt.time.split(':').map(Number);
      const start = h * 60 + m;
      const duration = Number(appt.duration) || 60;
      occupiedSegments.push({ start, end: start + duration });
    }
  });

  // Adicionar bloqueios da nova estrutura BlockedSchedule
  blockedSchedules.forEach(schedule => {
    // Verificar se o bloqueio se aplica a este dia (recorrência ou data fixa)
    const isTodayBlock = schedule.date === selectedDate;
    const isRecurringMatch = schedule.isRecurring && schedule.recurringDays?.includes(dayOfWeek);

    if (isTodayBlock || isRecurringMatch) {
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      const [eh, em] = schedule.endTime.split(':').map(Number);
      occupiedSegments.push({ 
        start: sh * 60 + sm, 
        end: eh * 60 + em 
      });
    }
  });

  const freeSlots: string[] = [];
  const now = new Date();
  const isToday = selectedDate === now.toISOString().split('T')[0];
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

  // 5. Gerar slots baseados na duração (step) e validar
  const step = 30; // Slots começam a cada 30min por padrão para flexibilidade, mas respeitam a duração do serviço
  
  for (let current = startTotalMinutes; current < endTotalMinutes; current += step) {
    const proposedEnd = current + serviceDuration;

    // REGRA: O serviço deve terminar antes do fim do expediente
    if (proposedEnd > endTotalMinutes) break;

    // REGRA: Não mostrar horários passados se for hoje
    if (isToday && current <= currentMinutesNow + 40) continue; // +40min de margem para agendamento

    // REGRA: O slot não pode sobrepor nenhuma janela ocupada
    const hasOverlap = occupiedSegments.some(seg => {
      // Condição de sobreposição: max(start1, start2) < min(end1, end2)
      return Math.max(current, seg.start) < Math.min(proposedEnd, seg.end);
    });

    if (!hasOverlap) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      freeSlots.push(timeString);
    }
  }

  return Array.from(new Set(freeSlots)).sort();
}
