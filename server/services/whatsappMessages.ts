
export function buildNewBookingMessageForPro(data: { 
  profissionalNome: string, 
  servicoNome: string, 
  data: string, 
  horario: string, 
  clienteNome: string, 
  clienteWhatsApp: string, 
  local: string, 
  linkManage: string 
}): string {
  return `✨ Nova reserva, ${data.profissionalNome}!

📋 ${data.servicoNome}
📅 ${data.data} às ${data.horario}
👤 ${data.clienteNome}
📱 ${data.clienteWhatsApp}
📍 ${data.local}

→ Confirme ou recuse em: ${data.linkManage}`.trim();
}

export function buildBookingConfirmedMessageForClient(data: { 
  clienteNome: string, 
  servicoNome: string, 
  profissionalNome: string, 
  data: string, 
  horario: string, 
  local: string, 
  linkManage: string 
}): string {
  return `Sua reserva está confirmada, ${data.clienteNome}! 🎉

✂️ ${data.servicoNome} com ${data.profissionalNome}
📅 ${data.data} às ${data.horario}
📍 ${data.local}

Se precisar reagendar ou cancelar:
→ ${data.linkManage}

Nos vemos em breve! 💫`.trim();
}

export function buildReminderMessage24h(data: { 
  clienteNome: string, 
  diaSemana: string, 
  data: string, 
  horario: string, 
  servicoNome: string, 
  profissionalNome: string, 
  local: string, 
  linkConfirmar: string, 
  linkManage: string 
}): string {
  return `Oi, ${data.clienteNome}! Amanhã é o seu dia ✨

📅 ${data.diaSemana}, ${data.data} às ${data.horario}
✂️ ${data.servicoNome} com ${data.profissionalNome}
📍 ${data.local}

Confirme sua presença:
→ ${data.linkConfirmar}

Precisa remarcar? Avise com antecedência:
→ ${data.linkManage}`.trim();
}

export function buildWaitlistInviteMessage(data: { 
  clienteNome: string, 
  profissionalNome: string, 
  data: string, 
  horario: string, 
  servicoNome: string, 
  tempoExpira: number, 
  linkAgendar: string 
}): string {
  return `${data.clienteNome}, abriu uma vaga pra você! 🌟

${data.profissionalNome} tem uma disponibilidade em:
📅 ${data.data} às ${data.horario}
✂️ ${data.servicoNome}

Isso vale por ${data.tempoExpira}h. Garanta agora:
→ ${data.linkAgendar}`.trim();
}

export function buildCancellationMessage(data: { 
  clienteNome: string, 
  servicoNome: string, 
  data: string, 
  horario: string, 
  motivoCancelamento?: string 
}): string {
  return `Oi, ${data.clienteNome}. Seu agendamento foi cancelado.

✂️ ${data.servicoNome}
📅 ${data.data} às ${data.horario}
${data.motivoCancelamento ? `\nMotivo: ${data.motivoCancelamento}` : ''}

Sentimos muito pelo inconveniente.`.trim();
}

export function buildLastMinuteCancellationMessage(data: { 
  clienteNome: string, 
  servicoNome: string, 
  horario: string,
  hoursUntil: number
}): string {
  return `🚨 *Aviso de última hora*\n\nInfelizmente, ${data.clienteNome} cancelou o serviço (${data.servicoNome}) agendado para às ${data.horario}.\n\nComo o cancelamento foi feito com apenas ${data.hoursUntil}h de antecedência, o horário já foi liberado novamente para você.`.trim();
}

export function buildReviewRequestMessage(data: { 
  clienteNome: string, 
  profissionalNome: string, 
  servicoNome: string, 
  linkReview: string 
}): string {
  return `Oi, ${data.clienteNome}! Como foi seu atendimento com ${data.profissionalNome}? ✨

Gostaríamos muito de saber sua opinião sobre o serviço ${data.servicoNome}.

Deixe sua avaliação aqui:
→ ${data.linkReview}

Sua opinião é muito importante para nós!`.trim();
}
