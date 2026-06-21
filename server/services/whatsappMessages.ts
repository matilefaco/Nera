
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
  serviceName: string, 
  date: string, 
  time: string, 
  professionalName: string 
}): string {
  return `✨ Sua reserva foi confirmada!

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}
Profissional: ${data.professionalName}

Te esperamos no horário combinado 💛`.trim();
}

export function buildBookingRejectedMessageForClient(data: {
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  professionalPageUrl: string
}): string {
  return `Oi, ${data.clientName}. Sua solicitação de reserva não pôde ser confirmada desta vez.

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}

Você pode escolher outro horário pela página da profissional:
${data.professionalPageUrl}`.trim();
}

export function buildCancellationByProMessageForClient(data: { 
  clientName: string, 
  serviceName: string, 
  date: string, 
  time: string, 
  professionalPageUrl: string 
}): string {
  return `Oi, ${data.clientName}. Sua reserva precisou ser cancelada pela profissional.

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}

Você pode escolher outro horário aqui:
${data.professionalPageUrl}`.trim();
}

export function buildRescheduledByProMessageForClient(data: {
  clientName: string,
  date: string,
  time: string,
  serviceName: string,
  professionalName: string
}): string {
  return `Oi, ${data.clientName}. Sua reserva foi reagendada.

Novo horário:
${data.date} às ${data.time}

Serviço: ${data.serviceName}
Profissional: ${data.professionalName}

Confira os detalhes no seu e-mail.`.trim();
}

export function buildReminderMessage24h(data: { 
  serviceName: string, 
  time: string, 
  professionalName: string
}): string {
  return `✨ Lembrete da sua reserva amanhã

Serviço: ${data.serviceName}
Horário: ${data.time}
Profissional: ${data.professionalName}

Até lá 💛`.trim();
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
