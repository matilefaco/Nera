export function buildNewBookingMessageForPro(data) {
    return `✨ Nova reserva, ${data.profissionalNome}!

📋 ${data.servicoNome}
📅 ${data.data} às ${data.horario}
👤 ${data.clienteNome}
📱 ${data.clienteWhatsApp}
📍 ${data.local}

→ Confirme ou recuse em: ${data.linkManage}`.trim();
}
export function buildBookingConfirmedMessageForClient(data) {
    return `Sua reserva está confirmada, ${data.clienteNome}! 🎉

✂️ ${data.servicoNome} com ${data.profissionalNome}
📅 ${data.data} às ${data.horario}
📍 ${data.local}

Se precisar reagendar ou cancelar:
→ ${data.linkManage}

Nos vemos em breve! 💫`.trim();
}
export function buildReminderMessage24h(data) {
    return `Oi, ${data.clienteNome}! Amanhã é o seu dia ✨

📅 ${data.diaSemana}, ${data.data} às ${data.horario}
✂️ ${data.servicoNome} com ${data.profissionalNome}
📍 ${data.local}

Confirme sua presença:
→ ${data.linkConfirmar}

Precisa remarcar? Avise com antecedência:
→ ${data.linkManage}`.trim();
}
export function buildWaitlistInviteMessage(data) {
    return `${data.clienteNome}, abriu uma vaga pra você! 🌟

${data.profissionalNome} tem uma disponibilidade em:
📅 ${data.data} às ${data.horario}
✂️ ${data.servicoNome}

Isso vale por ${data.tempoExpira}h. Garanta agora:
→ ${data.linkAgendar}`.trim();
}
export function buildCancellationMessage(data) {
    return `Oi, ${data.clienteNome}. Seu agendamento foi cancelado.

✂️ ${data.servicoNome}
📅 ${data.data} às ${data.horario}
${data.motivoCancelamento ? `\nMotivo: ${data.motivoCancelamento}` : ''}

Sentimos muito pelo inconveniente.`.trim();
}
export function buildReviewRequestMessage(data) {
    return `Oi, ${data.clienteNome}! Como foi seu atendimento com ${data.profissionalNome}? ✨

Gostaríamos muito de saber sua opinião sobre o serviço ${data.servicoNome}.

Deixe sua avaliação aqui:
→ ${data.linkReview}

Sua opinião é muito importante para nós!`.trim();
}
