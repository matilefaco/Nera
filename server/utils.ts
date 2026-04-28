import { db } from "./firebaseAdmin.js";
import admin from "firebase-admin";
import { logWhatsAppMessage, normalizePhone } from "./services/whatsappService.js";

// Helper to format Brazilian phone numbers for WhatsApp Cloud API
export function formatBRNumber(phone: string): string {
  return normalizePhone(phone);
}

/**
 * Validates if a string is a valid Brazilian WhatsApp number.
 * Must have 10 or 11 digits and start with a valid Brazilian DDD.
 */
export function isValidWhatsapp(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  
  // Basic length check
  if (cleaned.length !== 10 && cleaned.length !== 11) return false;
  
  // DDD check (11 to 99)
  const ddd = parseInt(cleaned.slice(0, 2));
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;
  
  // If 11 digits, must start with 9 after DDD (mobile convention)
  // Some old regions might not have 9, but for WhatsApp 11 digits is always mobile with 9.
  if (cleaned.length === 11 && cleaned[2] !== '9') return false;
  
  return true;
}

/**
 * Unified Email Guard
 * Prevents duplicate emails for the same event on an appointment.
 */
export async function shouldSendEmail(appointmentId: string, eventKey: string): Promise<boolean> {
  if (!appointmentId) return true; // Can't track if no ID
  
  try {
    const doc = await db.collection('appointments').doc(appointmentId).get();
    if (!doc.exists) return true;
    
    const data = doc.data();
    if (data?.emailEvents?.[eventKey]) {
      console.log(`[EMAIL_SKIP_DUPLICATE] Event ${eventKey} already sent for ${appointmentId}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EMAIL_GUARD_ERROR]', err);
    return true; 
  }
}

export async function markEmailSent(appointmentId: string, eventKey: string) {
  if (!appointmentId) return;
  try {
    await db.collection('appointments').doc(appointmentId).update({
      [`emailEvents.${eventKey}`]: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('[EMAIL_MARK_ERROR]', err);
  }
}

// WhatsApp Notification Handler (Official Meta Cloud API)
export async function sendWhatsAppMeta(to: string, message: string, metadata: { userId?: string, appointmentId?: string, type?: string, clientName?: string, clientWhatsapp?: string } = {}) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn('[WhatsApp-Meta] Configuration missing (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)');
    return false;
  }

  const formattedTo = formatBRNumber(to);
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  // Idempotency: skip logging if userId is missing (e.g. system internal tests)
  let logId = null;
  if (metadata.userId) {
    logId = await logWhatsAppMessage(db, {
      userId: metadata.userId,
      phone: formattedTo,
      message,
      type: metadata.type || 'meta_official',
      status: 'pending',
      appointmentId: metadata.appointmentId,
      clientName: metadata.clientName,
      clientWhatsapp: metadata.clientWhatsapp,
      metadata
    });
  }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedTo,
        type: "text",
        text: {
          body: message
        }
      })
    });

    if (resp.ok) {
      if (logId && metadata.userId) {
        await logWhatsAppMessage(db, {
          userId: metadata.userId,
          phone: formattedTo,
          message,
          status: 'sent',
          metaResponse: await resp.json()
        });
      }
      return true;
    } else {
      const errorText = await resp.text();
      if (logId && metadata.userId) {
        await logWhatsAppMessage(db, {
          userId: metadata.userId,
          phone: formattedTo,
          message,
          status: 'failed',
          error: errorText
        });
      }
      return false;
    }
  } catch (err: any) {
    console.warn('[WhatsApp-Meta] Request failed:', err);
    if (logId && metadata.userId) {
      await logWhatsAppMessage(db, {
        userId: metadata.userId,
        phone: formattedTo,
        message,
        status: 'failed',
        error: err.message
      });
    }
    return false;
  }
}

// Legacy WhatsApp Notification Handler (CallMeBot)
export async function sendWhatsAppNotification(phone: string, message: string, apiKey: string) {
  try {
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${apiKey}`;
    const resp = await fetch(url);
    return resp.ok;
  } catch (err) {
    console.warn('[WhatsApp] CallMeBot notification failed:', err);
    return false;
  }
}

// AI Rate Limiter state
export const aiRateLimit = new Map<string, { count: number, lastReset: number }>();
export const RATE_LIMIT_WINDOW = 60 * 1000;
export const MAX_REQUESTS = 10;

// NVIDIA AI Helper
export async function callNvidiaAI(messages: any[], options: { model?: string, temperature?: number, max_tokens?: number } = {}) {
  const model = options.model || "meta/llama-3.1-8b-instruct";
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const startTime = Date.now();
  
  if (!nvidiaKey) throw new Error("Missing NVIDIA_API_KEY");

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${nvidiaKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 512
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latency = Date.now() - startTime;

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`NVIDIA Status ${response.status}: ${body}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      console.log(`[NVIDIA] model used: ${model}`);
      console.log(`[NVIDIA] latency: ${latency}ms`);
      console.log(`[NVIDIA] success: true`);
      
      return content;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      const isTimeout = err.name === 'AbortError';
      console.warn(`[NVIDIA] error (Attempt ${attempt + 1}):`, isTimeout ? "Timeout" : err.message);
      if (attempt === 0) console.log(`[NVIDIA] Retrying...`);
    }
  }

  console.error(`[NVIDIA] final failure:`, lastError.message);
  throw lastError;
}

export async function getServiceDescriptionWithFallback(
  serviceName: string, 
  specialty: string, 
  duration: any, 
  price: any, 
  tone: string
) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const nameLow = serviceName.toLowerCase();
  
  // 1. Semantic Categorization for guard
  const isUnhas = /unha|gel|porcelana|manicure|pedicure|esmaltação|blindagem|nail/.test(nameLow);
  const isCabelo = /cabelo|corte|escova|mecha|tintura|química|fios/.test(nameLow);
  const isSobrancelhaCilio = /sobrancelha|cílio|fio a fio|lash|microbound|henna/.test(nameLow);
  const isEstetica = /pele|limpeza|massagem|estética|facial|corporal/.test(nameLow);

  if (nvidiaKey) {
    try {
      const prompt = `Você é um redator de marketing para profissionais de beleza premium no Brasil.
Gere uma descrição atraente, clara e natural para o serviço "${serviceName}".

REGRAS:
- Máximo 140 caracteres.
- Tom premium e profissional, sem exageros.
- Não use frases genéricas como "obra de arte", "experiência exclusiva" ou "transforme seu olhar".
- Seja específico ao serviço:
  * Se for UNHAS: fale de acabamento, durabilidade, resistência, naturalidade ou cuidado.
  * Se for CABELO: fale de fios, brilho, movimento ou técnica.
  * Se for SOBRANCELHAS/CÍLIOS: pode falar de olhar e harmonia.
  * Se for ESTÉTICA: fale de cuidado com a pele, bem-estar ou resultados.
- Não use emojis.
- Responda apenas com o texto da descrição.`;

      const content = await callNvidiaAI([
        { role: "user", content: prompt }
      ], { 
        model: "meta/llama-3.1-8b-instruct",
        temperature: 0.7,
        max_tokens: 150
      });

      if (content) {
        const contentLow = content.toLowerCase();
        let rejected = false;

        // 2. Semantic Guard: Unhas should not talk about "olhar", etc.
        if (isUnhas && /(olhar|sobrancelha|cílio|pele|cabelo|maquiagem)/.test(contentLow)) {
          console.log(`[AI SERVICE] description rejected by semantic guard: unhas talking about unrelated area. Content: "${content}"`);
          rejected = true;
        }

        if (!rejected) {
          console.log(`[AI SERVICE] NVIDIA success for ${serviceName}`);
          return { success: true, source: "nvidia", description: content };
        }
      }
    } catch (error: any) {
      console.error(`[AI SERVICE] NVIDIA failed in description: ${error.message}`);
    }
  }

  // Fallback Logic
  console.log(`[AI SERVICE] Using fallback for ${serviceName}`);
  
  let description = "Procedimento personalizado focado em realçar sua beleza natural com máxima qualidade.";
  let cat = "geral";
  
  if (nameLow.includes('gel')) {
    description = "Alongamento resistente com acabamento elegante para unhas bonitas por mais tempo.";
    cat = "unhas";
  } else if (nameLow.includes('porcelana')) {
    description = "Alongamento clássico com aparência natural e acabamento sofisticado.";
    cat = "unhas";
  } else if (nameLow.includes('manicure')) {
    description = "Cuidado completo das unhas com acabamento limpo, bonito e delicado.";
    cat = "unhas";
  } else if (nameLow.includes('pedicure')) {
    description = "Cuidado para os pés com acabamento caprichado e sensação de bem-estar.";
    cat = "unhas";
  } else if (isUnhas) {
    description = "Cuidado técnico das unhas com foco em saúde, beleza e durabilidade.";
    cat = "unhas";
  } else if (nameLow.includes('sobrancelha')) {
    description = "Design personalizado para valorizar o olhar com equilíbrio e naturalidade.";
    cat = "unhas"; // Keeping consistent with original logic which had 'cat = "unhas"' here for some reason? Wait, original had cat = "sobrancelhas" for some. 
    // Re-checking lines 1780 original: cat = "sobrancelhas";
    // Ah, my bad.
    cat = "sobrancelhas";
  } else if (nameLow.includes('cílio') || nameLow.includes('fio a fio')) {
    description = "Olhar marcante e volume natural com aplicação técnica e acabamento impecável.";
    cat = "cílios";
  } else if (nameLow.includes('limpeza de pele') || isEstetica) {
    description = "Tratamento profundo para remover impurezas e devolver a luminosidade natural da sua face.";
    cat = "estética";
  } else if (isCabelo) {
    description = "Cuidado profissional seguindo seu estilo e visagismo para renovar sua autoestima.";
    cat = "cabelo";
  } else if (nameLow.includes('depilação')) {
    description = "Remoção técnica de pelos proporcionando pele lisa e macia com o menor desconforto possível.";
    cat = "depilação";
  } else if (nameLow.includes('maquiagem') || nameLow.includes('makeup')) {
    description = "Produção completa para eventos destacando seus melhores traços com durabilidade.";
    cat = "maquiagem";
  }

  console.log(`[AI SERVICE] fallback used for category: ${cat}`);
  return { success: true, source: "fallback", description };
}
