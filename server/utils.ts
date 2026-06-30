import { getDb } from "./firebaseAdmin.js";
import admin from "firebase-admin";
import { logWhatsAppMessage, normalizePhone } from "./services/whatsappService.js";
import { logger } from "./utils/logger.js";

export const PUBLIC_APP_URL = (process.env.APP_URL || "https://usenera.com").replace(/\/+$/, "");

/**
 * Centralized helper for generating the public booking tracking URL.
 * NEVER use "/manage/" manually. Always use this function.
 */
export function buildPublicBookingUrl(token: string): string {
  if (!token) return PUBLIC_APP_URL;
  return `${PUBLIC_APP_URL}/r/${token}`;
}

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
  
  const db = getDb();
  try {
    const doc = await db.collection('appointments').doc(appointmentId).get();
    if (!doc.exists) return true;
    
    const data = doc.data();
    if (data?.emailEvents?.[eventKey]) {
      logger.info("AI", `[EMAIL_SKIP_DUPLICATE] Event ${eventKey} already sent for ${appointmentId}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error("AI", "[EMAIL_GUARD_ERROR]", { error: err });
    return true; 
  }
}

export async function markEmailSent(appointmentId: string, eventKey: string) {
  if (!appointmentId) return;
  const db = getDb();
  try {
    await db.collection('appointments').doc(appointmentId).update({
      [`emailEvents.${eventKey}`]: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    logger.error("AI", "[EMAIL_MARK_ERROR]", { error: err });
  }
}

// WhatsApp Notification Handler (Official Meta Cloud API)
export async function sendWhatsAppMeta(to: string, message: string, metadata: { userId?: string, appointmentId?: string, type?: string, clientName?: string, clientWhatsapp?: string, idempotencyKey?: string } = {}) {
  const db = getDb();

  // ----- INÍCIO DA POLÍTICA WA GLOBAL (META) -----
  const clientTypes = [
    'booking_confirmed_client',
    'booking_rejected',
    'booking_cancelled_client',
    'booking_rescheduled_client',
    'reminder_24h',
    'waitlist_invitation',
    'review_request',
    'reminder_2h'
  ];

  const allowedClientTypes = [
    'booking_confirmed_client',
    'booking_rejected',
    'booking_cancelled_client',
    'booking_rescheduled_client',
    'reminder_24h'
  ];

  if (metadata.userId && metadata.userId !== 'admin') {
    const proDoc = await db.collection("users").doc(metadata.userId).get();
    const pro = proDoc.data();
    
    if (!pro) {
      return false;
    }
    
    const plan = pro.plan || 'free';
    const expiresAt = pro.planExpiresAt;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
    const activePlan = isExpired ? 'free' : plan;

    // Se não for PRO nem tiver flag explícita, bloqueia o envio geral de WhatsApp
    if (activePlan !== 'pro' && !pro.whatsappNotifications) {
      logger.info("WHATSAPP-META", `Policy block: User is not PRO. WhatsApp blocked for type: ${metadata.type}`, {
        userId: metadata.userId
      });
      return false;
    }

    // Se for mensagem destinada ao cliente, aplica filtro adicional de tipos permitidos
    if (metadata.type && clientTypes.includes(metadata.type)) {
      if (!allowedClientTypes.includes(metadata.type)) {
        logger.info("WHATSAPP-META", `Policy block: WhatsApp blocked for client for type: ${metadata.type}`, {
          userId: metadata.userId,
          type: metadata.type
        });
        return false;
      }
    }
  }
  // ----- FIM DA POLÍTICA WA GLOBAL (META) -----

  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    logger.warn("AI", "[WhatsApp-Meta] Configuration missing (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)");
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
    logger.warn("AI", "[WhatsApp-Meta] Request failed", { meta: { error: err.message } });
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
  } catch (err: any) {
    logger.warn("AI", "[WhatsApp] CallMeBot notification failed", { meta: { error: err.message } });
    return false;
  }
}

// AI Rate Limiter state
export const aiRateLimit = new Map<string, { count: number, lastReset: number }>();
export const RATE_LIMIT_WINDOW = 60 * 1000;
export const MAX_REQUESTS = 10;

/**
 * Detects if a string is a data URI/base64 image.
 * Also checks for strings that are suspiciously large to be a normal URL.
 */
export function isDataUriImage(value: any): boolean {
  if (typeof value !== "string") return false;
  
  // Detect data URI
  if (value.startsWith("data:image/")) return true;
  
  // Detect suspicious base64 patterns (e.g., if it doesn't have the data: prefix but is still base64)
  // Usually URLs are < 2048 chars. If it's > 4096 and doesn't look like a URL, it's likely a blob/base64.
  if (value.length > 4096 && !value.startsWith("http")) return true;

  return false;
}

/**
 * Generates a URL-safe slug from text.
 */
export function generateSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique 6-character referral code based on name + random chars.
 */
export function generateReferralCode(name: string): string {
  const cleanName = (name || 'NERA').trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = cleanName.substring(0, 4);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1 for clarity
  let random = '';
  const remainingLength = Math.max(2, 6 - prefix.length);
  
  for (let i = 0; i < remainingLength; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return (prefix + random).substring(0, 6);
}

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
      
      logger.info("AI", `[NVIDIA] model used: ${model}`);
      logger.info("AI", `[NVIDIA] latency: ${latency}ms`);
      logger.info("AI", `[NVIDIA] success: true`);
      
      return content;
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      const isTimeout = err.name === 'AbortError';
      logger.warn("AI", `[NVIDIA] error (Attempt ${attempt + 1})`, { meta: { error: isTimeout ? "Timeout" : err.message } });
      if (attempt === 0) logger.info("AI", `[NVIDIA] Retrying...`);
    }
  }

  logger.error("AI", `[NVIDIA] final failure`, { error: { message: lastError.message } });
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
          logger.info("AI", `[AI SERVICE] description rejected by semantic guard: unhas talking about unrelated area. Content: "${content}"`);
          rejected = true;
        }

        if (!rejected) {
          logger.info("AI", `[AI SERVICE] NVIDIA success for ${serviceName}`);
          return { success: true, source: "nvidia", description: content };
        }
      }
    } catch (error: any) {
      logger.error("AI", `[AI SERVICE] NVIDIA failed in description: ${error.message}`);
    }
  }

  // Fallback Logic
  logger.info("AI", `[AI SERVICE] Using fallback for ${serviceName}`);
  
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

  logger.info("AI", `[AI SERVICE] fallback used for category: ${cat}`);
  return { success: true, source: "fallback", description };
}
