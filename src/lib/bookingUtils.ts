
/**
 * Calcula os horários disponíveis para um agendamento.
 * Baseia-se no expediente da profissional, duração do serviço e bloqueios existentes.
 */

import { Appointment, WorkingHours } from '../types';

interface GetAvailableSlotsParams {
  selectedDate: string; // YYYY-MM-DD
  serviceDuration: number; // em minutos
  workingHours: WorkingHours;
  appointments: Appointment[];
  manualBlockedSlots?: string[]; // HH:mm (opcional)
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
  manualBlockedSlots = []
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
    if (['confirmed', 'completed'].includes(appt.status)) {
      const [h, m] = appt.time.split(':').map(Number);
      const start = h * 60 + m;
      const duration = Number(appt.duration) || 60;
      occupiedSegments.push({ start, end: start + duration });
    }
  });

  // Adicionar bloqueios manuais (considerados como janelas de 30min ou pontos de bloqueio)
  manualBlockedSlots.forEach(timeStr => {
    const [h, m] = timeStr.split(':').map(Number);
    const start = h * 60 + m;
    occupiedSegments.push({ start, end: start + 30 });
  });

  const freeSlots: string[] = [];
  const now = new Date();
  const isToday = selectedDate === now.toISOString().split('T')[0];
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

  // 5. Gerar slots baseados na duração (step) e validar
  // A regra solicita que os slots avancem de acordo com a duração (ex: 14:00, 15:00 para 60min)
  const step = serviceDuration;
  
  for (let current = startTotalMinutes; current < endTotalMinutes; current += step) {
    const proposedEnd = current + serviceDuration;

    // REGRA: O serviço deve terminar antes do fim do expediente
    if (proposedEnd > endTotalMinutes) break;

    // REGRA: Não mostrar horários passados se for hoje
    if (isToday && current <= currentMinutesNow + 30) continue; // +30min de margem para agendamento

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

  // Garantir unicidade e ordenação (embora o loop já garanta por natureza)
  return Array.from(new Set(freeSlots)).sort();
}
