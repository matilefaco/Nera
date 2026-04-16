
/**
 * Calcula os horários disponíveis para um agendamento.
 * Baseia-se no expediente da profissional, duração do serviço e bloqueios existentes.
 */

interface GetAvailableSlotsParams {
  selectedDate: string; // YYYY-MM-DD
  selectedService: {
    duration: number; // em minutos
  } | null;
  profile: {
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    workingDays: number[]; // [0, 1, 2, 3, 4, 5, 6] onde 0 é domingo
  } | null;
  blockedSlots: string[]; // ['09:00', '10:30', ...]
}

export function getAvailableSlots({
  selectedDate,
  selectedService,
  profile,
  blockedSlots
}: GetAvailableSlotsParams): string[] {
  if (!selectedDate || !selectedService || !profile) return [];

  const date = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = date.getDay();

  const startTime = profile.startTime || '09:00';
  const endTime = profile.endTime || '18:00';
  const workingDays = profile.workingDays || [1, 2, 3, 4, 5];

  // REGRA A: Não exibir dia indisponível
  if (!workingDays.includes(dayOfWeek)) {
    return [];
  }

  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;
  const serviceDuration = Number(selectedService.duration);

  // Gerar slots de 30 em 30 minutos
  for (let current = startTotalMinutes; current < endTotalMinutes; current += 30) {
    // REGRA B & D: O serviço deve terminar antes do fim do expediente
    if (current + serviceDuration > endTotalMinutes) {
      break;
    }

    const hours = Math.floor(current / 60);
    const minutes = current % 60;
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // REGRA C: Remover horários bloqueados
    // Verificamos se o slot inicial ou qualquer intervalo de 30min dentro da duração do serviço está bloqueado
    let isBlocked = false;
    for (let check = current; check < current + serviceDuration; check += 30) {
      const checkH = Math.floor(check / 60);
      const checkM = check % 60;
      const checkStr = `${checkH.toString().padStart(2, '0')}:${checkM.toString().padStart(2, '0')}`;
      
      if (blockedSlots.includes(checkStr)) {
        isBlocked = true;
        break;
      }
    }

    if (!isBlocked) {
      slots.push(timeString);
    }
  }

  return slots;
}
