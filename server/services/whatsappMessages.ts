
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
  return `Nova solicitação de agendamento na Nera ✨

Cliente: ${data.clienteNome}
Serviço: ${data.servicoNome}
Data: ${data.data}
Horário: ${data.horario}

Acesse o painel para confirmar ou recusar:
${data.linkManage}`.trim();
}

export function buildBookingConfirmedMessageForClient(data: { 
  serviceName: string, 
  date: string, 
  time: string, 
  professionalName: string,
  local: string,
  linkManage: string
}): string {
  let msg = `✨ Sua reserva foi confirmada!

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}
Profissional: ${data.professionalName}

Se precisar alterar seu horário, você pode fazer isso por aqui:
${data.linkManage}

Te esperamos no horário combinado 💛`;

  if (data.local && data.local !== "Estúdio") {
    msg += `\nLocal: ${data.local}`;
  }
  
  return msg;
}

export function buildBookingRejectedMessageForClient(data: {
  clientName: string,
  serviceName: string,
  date: string,
  time: string,
  professionalPageUrl: string
}): string {
  return `Oi, ${data.clientName}.\n\nInfelizmente sua solicitação de reserva não pôde ser confirmada desta vez.\n\nServiço: ${data.serviceName}\nData: ${data.date}\nHorário: ${data.time}\n\nVocê pode escolher outro horário por aqui:\n${data.professionalPageUrl}`.trim();
}

export function buildCancellationByProMessageForClient(data: { 
  clientName: string, 
  serviceName: string, 
  date: string, 
  time: string, 
  professionalPageUrl: string,
  cancellationReason?: string
}): string {
  let msg = `Oi, ${data.clientName}.\n\nInfelizmente sua reserva precisou ser cancelada pela profissional.\n\nServiço: ${data.serviceName}\nData: ${data.date}\nHorário: ${data.time}\n`;
  if (data.cancellationReason) {
    msg += `\n${data.cancellationReason}\n\n`;
  } else {
    msg += `\n`;
  }
  msg += `Você pode escolher outro horário por aqui:\n${data.professionalPageUrl}`;
  return msg.trim();
}

export function buildCancellationMessage(data: {
  serviceName: string,
  date: string,
  time: string,
  professionalPageUrl: string
}): string {
  return `Seu horário foi cancelado com sucesso.

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}

Se quiser agendar novamente, sua profissional continua disponível por aqui:
${data.professionalPageUrl}`.trim();
}

export function buildWaitlistInviteMessage(data: {
  serviceName: string,
  date: string,
  time: string,
  professionalName: string,
  waitlistInviteUrl: string
}): string {
  return `Boa notícia ✨

Abriu uma vaga para o horário que você queria.

Serviço: ${data.serviceName}
Data: ${data.date}
Horário: ${data.time}
Profissional: ${data.professionalName}

Essa vaga fica reservada por alguns minutos.

Confirme por aqui:
${data.waitlistInviteUrl}`.trim();
}

export function buildRescheduledByProMessageForClient(data: {
  clientName: string,
  date: string,
  time: string,
  serviceName: string,
  professionalName: string,
  oldDate?: string,
  oldTime?: string,
  manageBookingUrl: string
}): string {
  let msg = `✨ Seu horário foi atualizado\n\nServiço: ${data.serviceName}\n\n`;
  if (data.oldDate && data.oldTime) {
    msg += `De:\n${data.oldDate} às ${data.oldTime}\n\nPara:\n${data.date} às ${data.time}\n\n`;
  } else {
    msg += `Novo horário:\n${data.date} às ${data.time}\n\n`;
  }

  msg += `Profissional: ${data.professionalName}\n\nSe precisar fazer uma nova alteração:\n${data.manageBookingUrl}`;
  return msg.trim();
}

export function buildReminderMessage24h(data: { 
  serviceName: string, 
  time: string, 
  professionalName: string,
  manageBookingUrl: string
}): string {
  return `✨ Passando para lembrar do seu atendimento amanhã

Serviço: ${data.serviceName}
Horário: ${data.time}
Profissional: ${data.professionalName}

Se precisar alterar seu horário:
${data.manageBookingUrl}

Até amanhã 💛`.trim();
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
