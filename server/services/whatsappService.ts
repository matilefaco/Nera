import admin from "firebase-admin";

interface WhatsAppMetadata {
  appointmentId?: string;
  userId: string; // Required for logging and filtering
  type?: string;
  clientName?: string;
  clientWhatsapp?: string;
  idempotencyKey?: string;
  [key: string]: any;
}

interface WhatsAppLog {
  id: string;
  phone: string;
  clientName?: string;
  clientWhatsapp?: string;
  message: string;
  messagePreview?: string;
  messageType?: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  appointmentId?: string;
  userId: string;
  createdAt: admin.firestore.Timestamp | admin.firestore.FieldValue;
  sentAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  metadata?: any;
}

/**
 * Normalizes any phone number into a standard format: 55XXXXXXXXXXX (12 or 13 digits)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 0, remove it
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

  // If it's just DDD + Number (10 or 11 digits), add 55
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  // If it starts with 55 but has 14+ digits (redundant prefix), try to fix it
  if (cleaned.startsWith('5555')) {
    cleaned = cleaned.substring(2);
  }

  return cleaned;
}

/**
 * Generates variations of a phone number to increase match probability in Firestore
 */
export function getPhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  const variations = new Set<string>();
  variations.add(normalized); // 55119... or 5511...
  
  // Variation without the '9' if it's there (Brazilian mobile numbers)
  if (normalized.startsWith('55') && normalized.length === 13) {
    const withoutNine = '55' + normalized.substring(2, 4) + normalized.substring(5);
    variations.add(withoutNine);
  }

  // Variation WITH the '9' if it's missing
  if (normalized.startsWith('55') && normalized.length === 12) {
    const withNine = '55' + normalized.substring(2, 4) + '9' + normalized.substring(4);
    variations.add(withNine);
  }

  // Version with '+' prefix
  variations.add('+' + normalized);
  
  // Versions without 55
  if (normalized.startsWith('55')) {
    const withoutDDI = normalized.substring(2);
    variations.add(withoutDDI);
    if (withoutDDI.length === 11) {
      // without DDI and without 9
      variations.add(withoutDDI.substring(0, 2) + withoutDDI.substring(3));
    } else if (withoutDDI.length === 10) {
      // without DDI and with 9 added
      variations.add(withoutDDI.substring(0, 2) + '9' + withoutDDI.substring(2));
    }
  }

  return Array.from(variations);
}

/**
 * Validates if it's a likely Brazilian phone number format (with 55)
 */
export function validateBrazilPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized.startsWith('55') && (normalized.length === 12 || normalized.length === 13);
}

/**
 * Unified logger for WhatsApp messages
 */
export async function logWhatsAppMessage(
  db: admin.firestore.Firestore,
  data: {
    userId: string;
    phone: string;
    message: string;
    type?: string;
    status: 'pending' | 'sent' | 'failed';
    error?: string;
    appointmentId?: string;
    clientName?: string;
    clientWhatsapp?: string;
    idempotencyKey?: string;
    metadata?: any;
    zapiResponse?: any;
    metaResponse?: any;
  }
) {
  const normalizedPhone = normalizePhone(data.phone);
  const idempotencyKey = data.idempotencyKey || `${normalizedPhone}_${Buffer.from(data.message).toString('base64').substring(0, 32)}`;
  
  const logId = data.idempotencyKey ? 
    (await db.collection('whatsapp_logs').where('idempotencyKey', '==', data.idempotencyKey).limit(1).get()).docs[0]?.id : 
    null;

  if (logId) {
    const updateData: any = {
      status: data.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (data.status === 'sent') updateData.sentAt = admin.firestore.FieldValue.serverTimestamp();
    if (data.error) updateData.error = data.error;
    if (data.zapiResponse) updateData.zapiResponse = data.zapiResponse;
    if (data.metaResponse) updateData.metaResponse = data.metaResponse;
    
    await db.collection('whatsapp_logs').doc(logId).update(updateData);
    return logId;
  } else {
    const logRef = db.collection('whatsapp_logs').doc();
    const logData: any = {
      id: logRef.id,
      phone: normalizedPhone,
      clientName: data.clientName || null,
      clientWhatsapp: data.clientWhatsapp || normalizedPhone,
      message: data.message,
      messagePreview: data.message.substring(0, 100) + (data.message.length > 100 ? '...' : ''),
      messageType: data.type || 'generic',
      status: data.status,
      appointmentId: data.appointmentId || null,
      userId: data.userId,
      idempotencyKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: data.metadata || {}
    };
    if (data.status === 'sent') logData.sentAt = admin.firestore.FieldValue.serverTimestamp();
    if (data.error) logData.error = data.error;
    
    await logRef.set(logData);
    return logRef.id;
  }
}

/**
 * Sends a WhatsApp message via Z-API
 */
export async function sendWhatsApp(
  db: admin.firestore.Firestore,
  phone: string,
  message: string,
  metadata: WhatsAppMetadata
) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_INSTANCE_TOKEN || process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const baseUrl = process.env.ZAPI_BASE_URL || 'https://api.z-api.io';

  if (!instanceId || !token) {
    console.error('[WhatsAppService] Missing Z-API credentials');
    return { success: false, error: 'Missing Z-API credentials' };
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // Idempotency Check
  const idempotencyKey = metadata.idempotencyKey || `${normalizedPhone}_${Buffer.from(message).toString('base64').substring(0, 32)}`;
  
  try {
    const recentLogs = await db.collection('whatsapp_logs')
      .where('idempotencyKey', '==', idempotencyKey)
      .where('createdAt', '>', new Date(Date.now() - 5 * 60 * 1000))
      .limit(1)
      .get();

    if (!recentLogs.empty) {
      console.log(`[WhatsAppService] Duplicate message detected for ${normalizedPhone}, skipping.`);
      return { success: true, duplicate: true, logId: recentLogs.docs[0].id };
    }

    const logId = await logWhatsAppMessage(db, {
      userId: metadata.userId,
      phone: normalizedPhone,
      message,
      type: metadata.type,
      clientName: metadata.clientName,
      clientWhatsapp: metadata.clientWhatsapp,
      appointmentId: metadata.appointmentId,
      status: 'pending',
      idempotencyKey,
      metadata
    });

    let lastError = null;
    const MAX_RETRIES = 1;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const url = `${baseUrl}/instances/${instanceId}/token/${token}/send-text`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(clientToken ? { 'Client-Token': clientToken } : {})
          },
          body: JSON.stringify({ phone: normalizedPhone, message }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
          const result = await response.json();
          await logWhatsAppMessage(db, {
            userId: metadata.userId,
            phone: normalizedPhone,
            message,
            status: 'sent',
            idempotencyKey,
            zapiResponse: result
          });
          return { success: true, logId };
        } else {
          const errorBody = await response.text();
          throw new Error(`Z-API Error ${response.status}: ${errorBody}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[WhatsAppService] Attempt ${attempt + 1} failed for ${normalizedPhone}:`, err.message);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    await logWhatsAppMessage(db, {
      userId: metadata.userId,
      phone: normalizedPhone,
      message,
      status: 'failed',
      idempotencyKey,
      error: lastError?.message || 'Unknown error'
    });
    return { success: false, error: lastError?.message };

  } catch (err: any) {
    console.error('[WhatsAppService] Fatal error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Detects the intent of a WhatsApp message
 */
export function detectWhatsAppIntent(message: string): 'confirm' | 'reschedule' | 'cancel' | 'help' | 'unknown' {
  const m = message.toLowerCase().trim();
  
  // Mapping: 1 -> Reschedule, 2 -> Cancel, 3 -> Help. Confirming by keywords.
  const confirmPatterns = ['sim', 'confirmo', 'confirmado', 'ok', 'vou', 'vou sim', 'estarei lá', 'pode confirmar', 'claro'];
  const reschedulePatterns = ['1', 'remarcar', 'reagendar', 'mudar horário', 'trocar horário', 'outro horário', 'não posso nesse horário'];
  const cancelPatterns = ['2', 'cancelar', 'cancela', 'não vou', 'não posso ir', 'desmarcar'];
  const helpPatterns = ['3', 'ajuda', 'opções', 'menu', 'não entendi'];

  if (confirmPatterns.some(p => m === p || m.includes(p))) return 'confirm';
  if (reschedulePatterns.some(p => m === p || m.includes(p))) return 'reschedule';
  if (cancelPatterns.some(p => m === p || m.includes(p))) return 'cancel';
  if (helpPatterns.some(p => m === p || m.includes(p))) return 'help';
  
  return 'unknown';
}

/**
 * Handle Inbound Message logic
 */
export async function handleInboundMessage(db: admin.firestore.Firestore, phone: string, message: string, rawPayload: any) {
  const normalizedPhone = normalizePhone(phone);
  const phoneVariations = getPhoneVariations(phone);
  const intent = detectWhatsAppIntent(message);
  
  const logRef = db.collection('whatsapp_inbound_logs').doc();
  const logData: any = {
    id: logRef.id,
    phone: normalizedPhone,
    phoneVariations,
    rawMessage: message,
    normalizedMessage: message.trim(),
    intent,
    status: 'received',
    rawPayload,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await logRef.set(logData);

  console.log(`[WhatsApp-Inbound] Incoming: ${phone}. Normalized: ${normalizedPhone}. Variations: ${phoneVariations.join(', ')}`);

  try {
    // Search for appointments in multiple formats
    const apptsSnap = await db.collection('appointments')
      .where('clientWhatsapp', 'in', phoneVariations)
      .where('status', 'in', ['pending_confirmation', 'confirmed', 'scheduled', 'pending'])
      .get();

    console.log(`[WhatsApp-Inbound] Candidate appointments found: ${apptsSnap.docs.length}`);

    const now = new Date();
    const futureAppts = apptsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(a => {
        const apptDate = new Date(`${a.date}T${a.time}`);
        // Consider appointments for today (even if started 2 hours ago) or future
        return apptDate > new Date(now.getTime() - 120 * 60 * 1000);
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateA - dateB;
      });

    const targetAppt = futureAppts[0];
    
    if (!targetAppt) {
      console.warn(`[WhatsApp-Inbound] No active appointment for variants of ${normalizedPhone}`);
      await logRef.update({ 
        status: 'ignored', 
        error: 'No active appointment found',
        diagnostics: { phoneVariations, totalFound: apptsSnap.docs.length }
      });
      await sendWhatsApp(db, normalizedPhone, "Não encontrei um agendamento ativo vinculado a este número. Acesse sua página de agendamento ou fale com a profissional.", {
        userId: 'system',
        type: 'inbound_error'
      });
      return { success: false, reason: 'no_appointment' };
    }

    await logRef.update({ appointmentId: targetAppt.id });

    const baseUrl = process.env.BASE_URL || 'https://nera.app';
    const profileLink = `${baseUrl}/p/${targetAppt.professionalSlug || 'app'}`;

    switch (intent) {
      case 'confirm':
        if (targetAppt.attendanceConfirmed) {
          await sendWhatsApp(db, normalizedPhone, "Sua presença já estava confirmada ✨", {
            userId: targetAppt.professionalId,
            appointmentId: targetAppt.id,
            type: 'inbound_confirm_duplicate'
          });
        } else {
          await db.collection('appointments').doc(targetAppt.id).update({
            attendanceConfirmed: true,
            attendanceConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
            attendanceConfirmedVia: 'whatsapp',
            status: 'confirmed'
          });
          const formattedDate = targetAppt.date.split('-').reverse().join('/');
          await sendWhatsApp(db, normalizedPhone, `Presença confirmada ✨\nTe esperamos no dia ${formattedDate} às ${targetAppt.time} 💛`, {
            userId: targetAppt.professionalId,
            appointmentId: targetAppt.id,
            type: 'inbound_confirm_success'
          });
        }
        break;

      case 'reschedule':
        await db.collection('appointments').doc(targetAppt.id).update({
          rescheduleRequested: true,
          rescheduleRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
          rescheduleRequestedVia: 'whatsapp'
        });
        await sendWhatsApp(db, normalizedPhone, `Claro ✨ Você pode escolher um novo horário aqui:\n${profileLink}\n\nAssim que remarcar, avisaremos por aqui.`, {
          userId: targetAppt.professionalId,
          appointmentId: targetAppt.id,
          type: 'inbound_reschedule_link'
        });
        break;

      case 'cancel':
        await db.collection('appointments').doc(targetAppt.id).update({
          status: 'cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancelledBy: 'client',
          cancelledVia: 'whatsapp'
        });
        await sendWhatsApp(db, normalizedPhone, `Seu agendamento foi cancelado com sucesso. Se quiser, você pode agendar novamente por aqui:\n${profileLink}`, {
          userId: targetAppt.professionalId,
          appointmentId: targetAppt.id,
          type: 'inbound_cancel_confirmation'
        });
        
        const proDoc = await db.collection('users').doc(targetAppt.professionalId).get();
        const proData = proDoc.data();
        if (proData?.whatsapp) {
          const formattedDate = targetAppt.date.split('-').reverse().join('/');
          const proMsg = `Cancelamento recebido pelo WhatsApp.\n\n*Cliente:* ${targetAppt.clientName}\n*Serviço:* ${targetAppt.serviceName}\n*Data:* ${formattedDate}\n*Hora:* ${targetAppt.time}`;
          await sendWhatsApp(db, proData.whatsapp, proMsg, {
            appointmentId: targetAppt.id,
            userId: targetAppt.professionalId,
            type: 'professional_cancellation_notification'
          });
        }
        break;

      case 'help':
      case 'unknown':
        await sendWhatsApp(db, normalizedPhone, "Como posso te ajudar? ✨\n\nResponda:\n1 — Reagendar\n2 — Cancelar\n*Sim* — Confirmar presença", {
          userId: targetAppt?.professionalId || 'system',
          appointmentId: targetAppt?.id,
          type: 'inbound_help'
        });
        break;
    }

    await logRef.update({ status: 'processed', processedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, intent, appointmentId: targetAppt.id };

  } catch (err: any) {
    console.error('[WhatsAppService] Error handling inbound:', err);
    await logRef.update({ status: 'failed', error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Admin test function
 */
export async function sendTestWhatsApp(db: admin.firestore.Firestore, phone: string, message: string) {
  return sendWhatsApp(db, phone, message, { userId: 'admin', type: 'test' });
}
