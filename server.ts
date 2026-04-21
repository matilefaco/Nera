import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { sendNewBookingEmail, sendBookingConfirmationEmail } from "./src/services/emailService.ts";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

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
   * Handles sending real emails via Resend.
   */
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;
    
    console.log(`[Notification Service] Processing ${type}...`);
    
    try {
      if (type === 'NEW_BOOKING_REQUEST') {
        const { professionalId, clientName, serviceName, date, time, locationType, neighborhood, totalPrice, appointmentId } = payload;
        
        console.log(`[Booking] New request detected for professional: ${professionalId}`);

        // 1. Fetch professional email from Firestore
        const userDoc = await db.collection('users').doc(professionalId).get();
        if (!userDoc.exists) {
          throw new Error(`Professional ${professionalId} not found`);
        }
        
        const professionalData = userDoc.data();
        const professionalEmail = professionalData?.email;

        if (!professionalEmail) {
          throw new Error(`Professional ${professionalId} has no email configured`);
        }

        // 2. Format location
        const location = locationType === 'home' ? `Domicílio (${neighborhood})` : 'Estúdio / Local Fixo';

        // 3. Send real email
        console.log(`[Email] Sending real notification to ${professionalEmail}`);
        await sendNewBookingEmail({
          clientName,
          serviceName,
          date,
          time,
          location,
          totalPrice: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice || 0),
          professionalEmail,
          bookingId: appointmentId
        });

        console.log(`[Email] Send success for booking ${appointmentId}`);
        
        return res.json({ 
          success: true, 
          message: "Email notification sent successfully via Resend."
        });
      }

      if (type === 'BOOKING_CONFIRMED') {
        const { professionalId, clientName, clientEmail, serviceName, date, time, locationType, neighborhood } = payload;
        
        if (!clientEmail) {
          console.log(`[Confirmation] No client email provided for ${clientName}. Skipping email.`);
          return res.json({ success: true, message: "No email provided, skipped." });
        }

        // 1. Fetch professional name from Firestore
        const userDoc = await db.collection('users').doc(professionalId).get();
        const professionalName = userDoc.exists ? userDoc.data()?.name : 'Profissional Nera';

        const location = locationType === 'home' ? `Domicílio (${neighborhood})` : 'Estúdio / Local Fixo';

        // 2. Send confirmation email
        console.log(`[Confirmation] Sending to client: ${clientEmail}`);
        await sendBookingConfirmationEmail({
          clientName,
          serviceName,
          date,
          time,
          location,
          clientEmail,
          professionalName,
          professionalEmail: '', // Not needed for confirmation
          bookingId: '' // Not needed for confirmation
        });

        return res.json({ success: true, message: "Confirmation email sent." });
      }

      // Fallback for other types (can be implemented later)
      console.log(`[Notification Service] Type ${type} not explicitly handled yet, but acknowledged.`);
      res.json({ success: true, message: "Notification acknowledged." });

    } catch (error: any) {
      console.error(`[Notification Service] ERROR:`, error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
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
