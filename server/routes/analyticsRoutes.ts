import express from "express";
import { getDb } from "../firebaseAdmin.js";
import { 
  callNvidiaAI, 
  aiRateLimit, 
  RATE_LIMIT_WINDOW, 
  MAX_REQUESTS, 
  getServiceDescriptionWithFallback 
} from "../utils.js";
import { checkPlanFeature } from "../middleware/planMiddleware.js";
import { generateMonthlyReportPDF } from "../reports/monthlyReport.js";
import { requireFirebaseAuth, AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

const debugOnly = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not Found");
  }
  return next();
};

/**
 * PUBLIC: Track Analytics Event
 * Protected by analyticsLimiter in server.ts
 */
router.post("/public/track", async (req, res) => {
  try {
    const { professionalId, type, referrer, origin } = req.body;

    if (!professionalId || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = getDb();
    if (!db) throw new Error("Database not connected");

    const proDoc = await db.collection("users").doc(professionalId).get();
    if (proDoc.exists) {
      const proData = proDoc.data();
      if (proData?.internalAccount === true || proData?.excludeFromAnalytics === true) {
        return res.status(200).json({ ok: true });
      }
    }

    // Add document to Firestore (write)
    await db.collection("analytics_events").add({
      professionalId,
      type,
      referrer: referrer || "",
      origin: origin || "other",
      timestamp: new Date()
    });

    res.status(200).json({ ok: true });
  } catch (err: any) {
    logger.error("ANALYTICS", "Failed to track event", { error: err.message });
    // Fail-soft: we respond with 200 basically, so we don't break frontend
    res.status(200).json({ ok: false });
  }
});

router.post("/generate-content", requireFirebaseAuth, async (req: AuthenticatedRequest, res: any) => {
  const { name, specialty, yearsExperience, serviceStyle, differentials, bioStyle } = req.body;
  logger.info("AI", "[BioAI] Entry /generate-content", { meta: { name, specialty } });
  
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
    logger.warn("AI", "[BioAI] Rate limit hit", { meta: { ip } });
    return res.status(429).json({ error: "Muitas solicitações. Tente novamente em um minuto." });
  }
  
  logger.info("AI", "[BioAI] NVIDIA_API_KEY present", { meta: { key: !!process.env.NVIDIA_API_KEY } });
  if (!process.env.NVIDIA_API_KEY) {
    logger.error("AI", "[BioAI] NVIDIA_API_KEY is missing in server environment");
    return res.status(500).json({ error: "Configuração de IA ausente." });
  }

  try {
    const prompt = `Você é redator especialista em personal branding no mercado premium de beleza e estética no Brasil.
Seu objetivo é gerar uma Frase Principal (headline) curta e uma Mini Bio (bio) profissional baseada EXCLUSIVAMENTE nos dados abaixo.

A linguagem deve soar HUMANA, AUTÊNTICA, PROFISSIONAL, VENDEDORA (mas elegante), sem jargões corporativos e NUNCA robótica.

DADOS DA PROFISSIONAL:
- Nome: ${name || 'A profissional'}
- Profissão real/Especialidade: ${specialty || 'Beleza e Bem-estar'}
- Tempo na área: ${yearsExperience ? yearsExperience + ' anos de experiência' : 'Profissional dedicada'}
- Estilo: ${Array.isArray(serviceStyle) ? serviceStyle.join(', ') : (serviceStyle || 'Exclusivo e cuidadoso')}
- Diferenciais focais: ${Array.isArray(differentials) ? differentials.join(', ') : (differentials || 'Resultados de alta qualidade')}
- Tom de Voz Solicitado: ${bioStyle || 'Sofisticado e seguro'}

DIRETRIZES CRÍTICAS DE SEMÂNTICA (LEIA COM ATENÇÃO MÁXIMA):
1. ADAPTAÇÃO TOTAL: A semântica DEVE combinar com a profissão. 
   - Depiladora: Fale de biossegurança, conforto, pele lisa, técnica rápida. NÃO FALE de "resgatar a autoestima com fios dourados" ou "elegância extrema".
   - Lash Designer: Fale de retenção, saúde do fio natural, praticidade, mapeamento facial.
   - Nail Designer: Fale de durabilidade, naturalidade, estrutura, cuticulagem perfeita.
   - Massoterapeuta / Esteticista: Fale de alívio, tratamento, bem-estar profundo, resultados reais.
2. PALAVRAS PROIBIDAS (Evite clichês artificiais): "Referência em [profissão]", "Cuidado com elegância" (se irrelevante), "A melhor", "Aperfeiçoando sua beleza", "Realçar a essência".
3. ESTRUTURA NATURAL: Escreva em primeira pessoa ("Meu foco é...") ou terceira pessoa objetiva ("Atendimento focado em...").

TAMANHO E SAÍDA:
- headline: Uma frase curtíssima (máx 60 caracteres) de super impacto, resumindo a transformação/especialidade. 
- bio: Um texto de 2 a 3 frases. Seja direto. Sem retórica vazia.

Retorne APENAS um JSON válido, puro, sem marcações markdown, estruturado exatamente assim:
{"bio": "Texto da bio humana, sem clichês...", "headline": "Headline focada na profissão real"}
`;

    logger.info("AI", "[BioAI] Calling NVIDIA Model meta/llama-3.1-8b-instruct");
    const content = await callNvidiaAI([
      { role: "user", content: prompt }
    ], { 
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0.5,
      max_tokens: 512
    });
    
    logger.info("AI", "[BioAI] Raw response from NVIDIA", { meta: { content } });
    
    // Attempt to parse JSON from response string
    let parsed;
    try {
      let jsonString = content.replace(/```json|```/g, '').trim();
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace >= firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      parsed = JSON.parse(jsonString);
    } catch (e) {
      logger.error("AI", "[BioAI] JSON parse error from model output", { error: { content } });
      throw new Error("Invalid format from AI model");
    }

    logger.info("AI", `[BioAI] Successfully generated parsed`, { meta: { parsed } });
    res.json(parsed);

  } catch (error: any) {
    logger.error("AI", "[BioAI] Generation error", { error: { message: error.message } });
    res.status(500).json({ error: "Não foi possível gerar o conteúdo." });
  }
});

router.post("/analyze-portfolio-image", requireFirebaseAuth, checkPlanFeature('advancedDashboard'), async (req: AuthenticatedRequest, res: any) => {
  const { imageUrl, specialty } = req.body;
  
  if (!process.env.NVIDIA_API_KEY) {
    logger.error("AI", "[PortfolioAI] NVIDIA_API_KEY is missing");
    return res.json({ category: "Portfólio" });
  }

  try {
    const content = await callNvidiaAI([
      { 
        role: "user", 
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: `Esta é uma foto de portfólio de uma profissional de beleza especializada em ${specialty}. Em no máximo 3 palavras em português, qual procedimento esta foto mostra? Exemplos: 'Design de Sobrancelhas', 'Limpeza de Pele', 'Nail Art', 'Maquiagem', 'Design de Cílios'. Responda APENAS com a categoria, sem pontuação, sem explicação.` }
        ]
      }
    ], { 
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0.2,
      max_tokens: 50
    });
    
    res.json({ category: content || "Portfólio" });

  } catch (error: any) {
    logger.error("AI", "[PortfolioAI] error", { error: { message: error.message } });
    res.json({ category: "Portfólio" });
  }
});

router.get("/debug-ai", debugOnly, async (req, res) => {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const report = {
    nvidiaKeyPresent: !!nvidiaKey,
    nvidiaKeyPrefix: nvidiaKey ? nvidiaKey.substring(0, 8) : 'N/A',
    nvidiaBaseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    nvidiaModel: "meta/llama-3.1-8b-instruct",
    canReachNvidia: false,
    lastError: null as string | null
  };

  if (nvidiaKey) {
    try {
      const content = await callNvidiaAI([{ role: "user", content: "hi" }], { 
        model: report.nvidiaModel,
        max_tokens: 1
      });
      report.canReachNvidia = !!content;
    } catch (err: any) {
      report.lastError = err.message;
    }
  }

  res.json(report);
});

router.get("/test-ai-service-description", debugOnly, async (req, res) => {
  const { serviceName } = req.query;
  if (!serviceName) return res.status(400).json({ error: "Missing serviceName" });

  const result = await getServiceDescriptionWithFallback(serviceName as string, "Beleza", 30, 100, "elegante");
  res.json(result);
});

router.post("/ai/service-description", requireFirebaseAuth, checkPlanFeature('advancedDashboard'), async (req: AuthenticatedRequest, res: any) => {
  const { serviceName, professionalSpecialty, duration, price, tone } = req.body;
  
  const result = await getServiceDescriptionWithFallback(
    serviceName, 
    professionalSpecialty || "Beleza", 
    duration, 
    price, 
    tone
  );
  
  res.json(result);
});

router.post("/ai/categorize-service", requireFirebaseAuth, async (req: AuthenticatedRequest, res: any) => {
  const { serviceName } = req.body;
  if (!process.env.NVIDIA_API_KEY) {
    logger.warn("AI", "[AI SERVICE] NVIDIA failed (missing key), using local fallback");
    return res.json({ category: "Outros" });
  }

  try {
    const prompt = `Classifique o serviço "${serviceName}" em uma destas categorias: Unhas, Sobrancelhas, Cílios, Cabelo, Estética, Outros. Responda apenas o nome da categoria.`;
    const content = await callNvidiaAI([{ role: "user", content: prompt }], {
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0.1,
      max_tokens: 20
    });
    res.json({ category: content || "Outros" });
  } catch (error) {
    logger.warn("AI", "[AI SERVICE] NVIDIA categorization failed, using local fallback");
    res.json({ category: "Outros" });
  }
});

router.post("/ai/categorize-portfolio-item", requireFirebaseAuth, async (req: AuthenticatedRequest, res: any) => {
  const { title, description } = req.body;
  if (!process.env.NVIDIA_API_KEY) {
    logger.warn("AI", "[AI SERVICE] NVIDIA failed (missing key), using local fallback");
    return res.json({ category: "Geral" });
  }

  try {
    const prompt = `Classifique este item de portfólio "${title}" (${description || ''}) em uma destas categorias: Unhas, Sobrancelhas, Cílios, Cabelo, Estética, Outros. Responda apenas o nome da categoria.`;
    const content = await callNvidiaAI([{ role: "user", content: prompt }], {
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0.1,
      max_tokens: 20
    });
    res.json({ category: content || "Geral" });
  } catch (error) {
    logger.warn("AI", "[AI SERVICE] NVIDIA portfolio categorization failed, using local fallback");
    res.json({ category: "Geral" });
  }
});

router.get("/reports/monthly", requireFirebaseAuth, checkPlanFeature('reports'), async (req: AuthenticatedRequest, res: any) => {
  const db = getDb();
  const { month } = req.query;
  const professionalId = String(req.query.professionalId || req.uid);

  if (professionalId !== req.uid) {
    logger.warn("AI", `[REPORT AUTH] User ${req.uid} attempted to access report of ${professionalId}. Access denied.`);
    return res.status(403).json({ error: "Acesso negado. Você só pode gerar relatórios da sua própria conta." });
  }

  if (!month) {
    return res.status(400).json({ error: "Month (YYYY-MM) is required" });
  }

  try {
    const proDoc = await db.collection('users').doc(String(professionalId)).get();
    if (!proDoc.exists) {
      return res.status(404).json({ error: "Profissional não encontrada." });
    }
    const pro = proDoc.data();

    const startOfMonth = `${month}-01`;
    const nextMonthDate = new Date(`${month}-01T12:00:00`);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const endOfMonth = nextMonthDate.toISOString().split('T')[0];

    const appointmentsSnap = await db.collection('appointments')
      .where('professionalId', '==', professionalId)
      .where('date', '>=', startOfMonth)
      .where('date', '<', endOfMonth)
      .get();

    const appointments = appointmentsSnap.docs.map(doc => doc.data());
    const confirmed = appointments.filter(a => ['confirmed', 'accepted', 'completed'].includes(a.status));
    const cancelled = appointments.filter(a => a.status.startsWith('cancelled'));

    const totalRevenue = confirmed.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const averageTicket = confirmed.length > 0 ? totalRevenue / confirmed.length : 0;

    // Top Services
    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    confirmed.forEach(a => {
      const name = a.serviceName || 'Serviço s/ nome';
      if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 };
      serviceMap[name].count++;
      serviceMap[name].revenue += (Number(a.price) || 0);
    });
    const topServices = Object.entries(serviceMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top Days
    const dayMap: Record<string, number> = {};
    confirmed.forEach(a => {
      const day = a.date.split('-')[2]; // Extract DD
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const topDays = Object.entries(dayMap)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count);

    // Clients
    const clientKeys = new Set(confirmed.map(a => a.clientEmail || a.clientWhatsapp));
    // Approximation: for simplicity, we treat all as new for now if we don't scan history
    // But we could scan before startOfMonth
    const newClients = clientKeys.size; 
    const returningClients = 0;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const [yearPart, monthPart] = (month as string).split('-');
    const monthName = `${monthNames[parseInt(monthPart) - 1]} ${yearPart}`;

    const reportData = {
      professionalName: pro?.name || 'Profissional Nera',
      professionalSpecialty: pro?.specialty || pro?.professionalIdentity?.mainSpecialty || 'Especialista',
      month: monthName,
      totalRevenue,
      confirmedAppointments: confirmed.length,
      cancelledAppointments: cancelled.length,
      newClients,
      returningClients,
      topServices,
      topDays,
      averageTicket
    };

    const buffer = await generateMonthlyReportPDF(reportData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=nera-relatorio-${month}.pdf`);
    res.send(buffer);

  } catch (error: any) {
    logger.error("AI", "[REPORT] Generation error", { error });
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

export default router;
