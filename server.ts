import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { sendNewBookingEmail, sendBookingConfirmationEmail, send24hReminderEmail } from "./src/services/emailService.ts";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

// Helper to format Brazilian phone numbers for WhatsApp Cloud API
function formatBRNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // If it's a standard BR number (10 or 11 digits without country code)
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  
  // If it already starts with 55 but has few digits, or other cases
  // Meta API expects CC + Area + Number
  return cleaned;
}

// WhatsApp Notification Handler (Official Meta Cloud API)
async function sendWhatsAppMeta(to: string, message: string) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    console.warn('[WhatsApp-Meta] Configuration missing (META_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID)');
    return false;
  }

  const formattedTo = formatBRNumber(to);
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

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

    const data = await resp.json();
    if (resp.ok) {
      console.log('[WhatsApp-Meta] Notification sent successfully to:', formattedTo);
      return true;
    } else {
      console.error('[WhatsApp-Meta] API Error:', JSON.stringify(data));
      return false;
    }
  } catch (err) {
    console.warn('[WhatsApp-Meta] Request failed:', err);
    return false;
  }
}

// Legacy WhatsApp Notification Handler (CallMeBot) - Kept for professional-specific keys if they prefer
async function sendWhatsAppNotification(phone: string, message: string, apiKey: string) {
  try {
    const encodedMsg = encodeURIComponent(message);
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedMsg}&apikey=${apiKey}`;
    const resp = await fetch(url);
    console.log('[WhatsApp] Notification sent via CallMeBot. Status:', resp.status);
    return resp.ok;
  } catch (err) {
    console.warn('[WhatsApp] CallMeBot notification failed:', err);
    return false;
  }
}

// Simple In-memory Rate Limiter for AI Generation
const aiRateLimit = new Map<string, { count: number, lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/generate-content", async (req, res) => {
    const { name, specialty, yearsExperience, serviceStyle, differentials, bioStyle } = req.body;
    
    // Simple rate limit check
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous') as string;
    const now = Date.now();
    const rateData = aiRateLimit.get(ip) || { count: 0, lastReset: now };
    
    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
      rateData.count = 1;
      rateData.lastReset = now;
    } else {
      rateData.count++;
    }
    aiRateLimit.set(ip, rateData);

    if (rateData.count > MAX_REQUESTS) {
      return res.status(429).json({ error: "Muitas solicitações. Tente novamente em um minuto." });
    }
    
    if (!process.env.NVIDIA_API_KEY) {
      console.error("[BioAI] NVIDIA_API_KEY is missing in server environment");
      return res.status(500).json({ error: "Configuração de IA ausente." });
    }

    try {
      const prompt = `Você é um especialista em branding para profissionais de beleza brasileiras.
Gere uma bio e um headline para esta profissional:
Nome: ${name}
Especialidade: ${specialty}
Anos de experiência: ${yearsExperience}
Estilo de atendimento: ${serviceStyle}
Diferenciais: ${differentials}
Tom desejado: ${bioStyle} (elegante | natural | direta)

Retorne APENAS um JSON válido, sem markdown, sem explicação, neste formato:
{"bio": "texto aqui", "headline": "texto aqui"}`;

      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-4-maverick-17b-128e-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: 512,
          top_p: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`NVIDIA API responded with ${response.status}`);
      }

      const rawData: any = await response.json();
      const content = rawData.choices[0].message.content;
      
      // Attempt to parse JSON from response string
      let parsed;
      try {
        parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.error("[BioAI] JSON parse error from model output:", content);
        throw new Error("Invalid format from AI model");
      }

      res.json(parsed);

    } catch (error: any) {
      console.error("[BioAI] Generation error:", error.message);
      res.status(500).json({ error: "Não foi possível gerar o conteúdo." });
    }
  });

  app.post("/api/analyze-portfolio-image", async (req, res) => {
    const { imageUrl, specialty } = req.body;
    
    if (!process.env.NVIDIA_API_KEY) {
      console.error("[PortfolioAI] NVIDIA_API_KEY is missing");
      return res.json({ category: "Portfólio" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta/llama-4-maverick-17b-128e-instruct",
          messages: [
            { 
              role: "user", 
              content: [
                { type: "image_url", image_url: { url: imageUrl } },
                { type: "text", text: `Esta é uma foto de portfólio de uma profissional de beleza especializada em ${specialty}. Em no máximo 3 palavras em português, qual procedimento esta foto mostra? Exemplos: 'Design de Sobrancelhas', 'Limpeza de Pele', 'Nail Art', 'Maquiagem', 'Design de Cílios'. Responda APENAS com a categoria, sem pontuação, sem explicação.` }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 50
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NVIDIA API responded with ${response.status}`);
      }

      const rawData: any = await response.json();
      const category = rawData.choices[0].message.content.trim();
      
      res.json({ category: category || "Portfólio" });

    } catch (error: any) {
      clearTimeout(timeout);
      console.error("[PortfolioAI] error:", error.message);
      res.json({ category: "Portfólio" });
    }
  });

  /**
   * Notification Endpoint
   * Handles sending real emails via Resend and WhatsApp via Meta Cloud API.
   */
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    console.log(`[Notification Service] Processing ${type}...`);
    
    try {
      if (type === 'NEW_BOOKING_REQUEST') {
        const { professionalId, clientName, serviceName, date, time, locationType, neighborhood, totalPrice, appointmentId, token } = payload;
        
        // 1. Fetch professional data
        const userDoc = await db.collection('users').doc(professionalId).get();
        if (!userDoc.exists) throw new Error(`Professional ${professionalId} not found`);
        
        const pro = userDoc.data();
        const proEmail = pro?.email;
        const proPhone = pro?.whatsapp;

        // 2. Send real email (as reliable secondary channel)
        if (proEmail) {
          const location = locationType === 'home' ? `Domicílio (${neighborhood})` : 'Estúdio / Local Fixo';
          await sendNewBookingEmail({
            clientName, serviceName, date, time, location,
            totalPrice: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice || 0),
            professionalEmail: proEmail,
            bookingId: appointmentId
          }).catch(err => console.error('[Email] Failed:', err));
        }

        // 3. Send WhatsApp Meta (Primary)
        if (proPhone) {
          const msg = `✨ *Nova reserva no Nera!* 💅\n\n` +
                      `*Cliente:* ${clientName}\n` +
                      `*Serviço:* ${serviceName}\n` +
                      `*Data:* ${date.split('-').reverse().join('/')} às ${time}\n\n` +
                      `*Escolha uma ação:* \n\n` +
                      `1️⃣ *Confirmar:* \n${baseUrl}/pedidos?id=${appointmentId}&token=${token}&action=confirm\n\n` +
                      `2️⃣ *Recusar:* \n${baseUrl}/pedidos?id=${appointmentId}&token=${token}&action=reject\n\n` +
                      `3️⃣ *Ver detalhes:* \n${baseUrl}/pedidos?id=${appointmentId}&token=${token}`;

          const ok = await sendWhatsAppMeta(proPhone, msg);
          
          // Fallback only if Meta fails and professional has CallMeBot setup
          if (!ok && pro?.callmebotApiKey) {
            await sendWhatsAppNotification(proPhone, msg, pro.callmebotApiKey);
          }
        }

        return res.json({ success: true });
      }

      if (type === 'BOOKING_CANCELLED' || type === 'BOOKING_CANCELLED_BY_CLIENT') {
        const { professionalId, clientName, serviceName, date, time } = payload;
        
        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          const pro = proDoc.data();
          const proPhone = pro?.whatsapp;
          
          if (proPhone) {
            const formattedDate = date.split('-').reverse().join('/');
            
            // Waitlist check
            const hour = parseInt(time.split(':')[0]);
            const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'night';

            const waitlistSnap = await db.collection('waitlist')
              .where('professionalId', '==', professionalId)
              .where('requestedDate', '==', date)
              .where('status', '==', 'waiting')
              .get();
            
            const matchesCount = waitlistSnap.docs.filter(doc => {
              const d = doc.data();
              return d.period === 'any' || d.period === period;
            }).length;

            let msg = `Horário liberado! 🗓️\n\nA reserva de ${clientName} em ${formattedDate} às ${time} foi CANCELADA. Seu horário ficou disponível novamente.`;
            
            if (matchesCount > 0) {
              msg = `🚨 *Oportunidade de Recuperação!* \n\nO horário de ${time} (${formattedDate}) ficou livre e *há ${matchesCount} interessada${matchesCount > 1 ? 's' : ''}* na lista de espera.\n\nRecupere esse faturamento agora no Dashboard: \n${baseUrl}/dashboard?recovery=${date}_${time.replace(':', '')}`;
            }

            const ok = await sendWhatsAppMeta(proPhone, msg);
            if (!ok && pro?.callmebotApiKey) {
              await sendWhatsAppNotification(proPhone, msg, pro.callmebotApiKey);
            }
          }
        }
        
        return res.json({ success: true });
      }

      if (type === 'BOOKING_CONFIRMED') {
        const { professionalId, clientName, clientEmail, clientWhatsapp, serviceName, date, time, locationType, neighborhood } = payload;
        
        // Fetch pro info
        const proDoc = await db.collection('users').doc(professionalId).get();
        const proName = proDoc.exists ? proDoc.data()?.name : 'Sua Profissional';

        // 1. WhatsApp to Client (Primary)
        if (clientWhatsapp) {
          const formattedDate = date.split('-').reverse().join('/');
          const msg = `Tudo certo, ${clientName}! ✨\n\nSua reserva com ${proName} foi CONFIRMADA.\n\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${time}\n💅 *Serviço:* ${serviceName}\n📍 *Local:* ${locationType === 'home' ? neighborhood : 'No Estúdio'}\n\nAté logo! 👋`;
          
          await sendWhatsAppMeta(clientWhatsapp, msg);
        }

        // 2. Email Fallback
        if (clientEmail) {
          const location = locationType === 'home' ? `Domicílio (${neighborhood})` : 'Estúdio / Local Fixo';
          await sendBookingConfirmationEmail({
            clientName, serviceName, date, time, location,
            clientEmail, professionalName: proName,
            professionalEmail: '', bookingId: ''
          }).catch(err => console.error('[Email] Confirmation failed:', err));
        }

        return res.json({ success: true });
      }

      if (type === 'WAITLIST_INVITATION') {
        const { clientWhatsapp, clientName, requestedDate, assignedTime, professionalName, expiresAt } = payload;
        
        if (clientWhatsapp) {
          const formattedDate = requestedDate.split('-').reverse().join('/');
          const msg = `Boas notícias, ${clientName}! 🌟\n\nAbriu uma vaga na agenda de ${professionalName} para o dia ${formattedDate} às ${assignedTime}.\n\nComo você estava na lista de espera, tem prioridade para reservar nos próximos 15 minutos!\n\nGaranta sua vaga agora: \n${baseUrl}/p/exemplo?waitlist_invite=true`; // Em prod, usaria o slug real
          
          await sendWhatsAppMeta(clientWhatsapp, msg);
        }
        return res.json({ success: true });
      }

      if (type === 'WAITLIST_SLOT_OPENED') {
        const { professionalId, date, time, candidateName } = payload;
        
        const proDoc = await db.collection('users').doc(professionalId).get();
        if (proDoc.exists) {
          const pro = proDoc.data();
          if (pro?.whatsapp) {
            const formattedDate = date.split('-').reverse().join('/');
            const msg = `Vaga na lista de espera! 🗓️\n\nO horário de ${time} (${formattedDate}) ficou disponível e ${candidateName} está aguardando.\n\nConfira no seu Dashboard: \n${baseUrl}/dashboard`;
            
            await sendWhatsAppMeta(pro.whatsapp, msg);
          }
        }
        return res.json({ success: true });
      }

      res.json({ success: true, message: "Type processed or ignored." });

    } catch (error: any) {
      console.error(`[Notification Service] ERROR:`, error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  /**
   * Cron Job: 24h Reminders
   * Robust multi-channel delivery: Email (primary) -> WhatsApp (fallback) -> Log.
   * Triggered by external cron service using CRON_SECRET.
   */
  app.get('/api/cron/reminders24h', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      console.warn('[Cron] Unauthorized access attempt blocked');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      console.log(`[Cron] Starting 24h reminders for appointments on ${tomorrowStr}...`);

      const appointmentsRef = db.collection('appointments');
      const snap = await appointmentsRef
        .where('date', '==', tomorrowStr)
        .where('status', '==', 'confirmed')
        .where('reminder24hSentAt', '==', null)
        .get();
      
      console.log(`[Cron] Found ${snap.docs.length} pending reminders for tomorrow.`);
      
      let emailSent = 0;
      let whatsappSent = 0;
      let noChannelCount = 0;
      let errorsCount = 0;
      
      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        
        if (!appt.professionalId) {
          console.warn(`[Cron] Skipping appt ${apptId}: No professionalId`);
          continue;
        }
        
        try {
          // 1. Fetch professional data
          const proSnap = await db.collection('users').doc(appt.professionalId).get();
          if (!proSnap.exists) {
            console.warn(`[Cron] Skipping ${apptId}: Professional profile not found`);
            continue;
          }
          
          const pro = proSnap.data();
          let sentSuccessfully = false;
          let deliveryChannel = '';

          // STRATEGY A: WhatsApp Meta (Primary)
          const phone = pro?.callmebotPhone || appt.professionalWhatsapp || pro?.whatsapp;
          if (phone) {
            const formattedDate = tomorrowStr.split('-').reverse().join('/');
            const msg = `Lembrete Nera! 🔔\n\nAmanhã, ${formattedDate}, você tem um atendimento com ${appt.clientName} às ${appt.time} (${appt.serviceName}).\n\nConsidere enviar uma mensagem de confirmação para sua cliente hoje! ✨`;
            
            const ok = await sendWhatsAppMeta(phone, msg);
            if (ok) {
              sentSuccessfully = true;
              deliveryChannel = 'whatsapp_meta';
              whatsappSent++;
            } else if (pro?.callmebotApiKey) {
              // Legacy fallback if professional has their own key
              const legacyOk = await sendWhatsAppNotification(phone, msg, pro.callmebotApiKey);
              if (legacyOk) {
                sentSuccessfully = true;
                deliveryChannel = 'whatsapp_legacy';
                whatsappSent++;
              }
            }
          }

          // STRATEGY B: Email (Fallback) - Only if WhatsApp failed
          if (!sentSuccessfully && process.env.RESEND_API_KEY && pro?.email) {
            try {
              await send24hReminderEmail({
                clientName: appt.clientName,
                serviceName: appt.serviceName,
                date: appt.date,
                time: appt.time,
                location: appt.locationDetail || appt.address || 'Local não informado',
                professionalEmail: pro.email,
                professionalName: pro.name,
                bookingId: apptId
              });
              sentSuccessfully = true;
              deliveryChannel = 'email';
              emailSent++;
            } catch (emailErr) {
              console.error(`[Cron] Email delivery failed for ${apptId}:`, emailErr);
            }
          }

          // 2. Finalize
          if (sentSuccessfully) {
            console.log(`[Cron] Reminder sent for ${apptId} via ${deliveryChannel}`);
            await docSnap.ref.update({ 
              reminder24hSentAt: admin.firestore.FieldValue.serverTimestamp(),
              deliveryChannel 
            });
          } else {
            console.log(`[Cron] No delivery channel available for appointment ${apptId}`);
            noChannelCount++;
            // We DO NOT mark as sent here, so it can retry if configuration is fixed
          }

        } catch (innerErr: any) {
          console.error(`[Cron] Failed processing appointment ${apptId}:`, innerErr.message);
          errorsCount++;
          // Continue to next appointment
        }
      }
      
      const summary = { 
        success: true, 
        date: tomorrowStr,
        totalFound: snap.docs.length,
        sentEmail: emailSent, 
        sentWhatsApp: whatsappSent,
        noChannel: noChannelCount,
        errors: errorsCount
      };
      
      console.log(`[Cron] Completed:`, summary);
      res.json(summary);
    } catch (err: any) {
      console.error('[Cron Critical Error] 24h reminders failed:', err.message);
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * Cron: Review Requests (24h after completion)
   */
  app.get('/api/cron/review-requests', async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const snap = await db.collection('appointments')
        .where('date', '==', yesterdayStr)
        .where('status', '==', 'completed')
        .where('reviewRequestedAt', '==', null)
        .get();

      console.log(`[Cron-Reviews] Found ${snap.docs.length} completed bookings from ${yesterdayStr}`);

      let sentCount = 0;
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';

      for (const docSnap of snap.docs) {
        const appt = docSnap.data();
        const apptId = docSnap.id;
        const clientPhone = appt.clientWhatsapp;

        if (clientPhone) {
          // Generate a secure token for the review request
          const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          
          // Create the review request document that ReviewPage expects
          await db.collection('review_requests').add({
            professionalId: appt.professionalId,
            bookingId: apptId,
            token,
            status: 'pending',
            clientDisplayName: appt.clientName,
            clientNeighborhood: appt.neighborhood || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          const msg = `Oi ${appt.clientName} 💛 como foi sua experiência com ${appt.professionalName || 'sua profissional'}? \n\nSe puder avaliar seu atendimento, isso ajuda muito no crescimento dela: \n\n${baseUrl}/review/${token}`;
          
          const ok = await sendWhatsAppMeta(clientPhone, msg);
          
          // Fallback legacy if global key exists
          let sent = ok;
          if (!sent && process.env.CALLMEBOT_API_KEY) {
            sent = await sendWhatsAppNotification(clientPhone, msg, process.env.CALLMEBOT_API_KEY);
          }

          if (sent) {
            await docSnap.ref.update({
              reviewRequestedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            sentCount++;
          }
        }
      }

      res.json({ success: true, date: yesterdayStr, sent: sentCount });
    } catch (err: any) {
      console.error('[Cron-Reviews] Critical error:', err.message);
      res.status(500).json({ error: String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
