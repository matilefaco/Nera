import express from "express";
import { getDb } from "../firebaseAdmin.js";
import { callNvidiaAI, aiRateLimit, RATE_LIMIT_WINDOW, MAX_REQUESTS, getServiceDescriptionWithFallback } from "../utils.js";
import { checkPlanFeature } from "../middleware/planMiddleware.js";
import { generateMonthlyReportPDF } from "../reports/monthlyReport.js";
import { requireFirebaseAuth } from "../middleware/authMiddleware.js";
const router = express.Router();
const debugOnly = (req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        return res.status(404).send("Not Found");
    }
    return next();
};
router.post("/generate-content", requireFirebaseAuth, checkPlanFeature('advancedDashboard'), async (req, res) => {
    const { name, specialty, yearsExperience, serviceStyle, differentials, bioStyle } = req.body;
    // Simple rate limit check
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous');
    const now = Date.now();
    const rateData = aiRateLimit.get(ip) || { count: 0, lastReset: now };
    if (now - rateData.lastReset > RATE_LIMIT_WINDOW) {
        rateData.count = 1;
        rateData.lastReset = now;
    }
    else {
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
        const content = await callNvidiaAI([
            { role: "user", content: prompt }
        ], {
            model: "meta/llama-3.1-8b-instruct",
            temperature: 0.5,
            max_tokens: 512
        });
        // Attempt to parse JSON from response string
        let parsed;
        try {
            parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        }
        catch (e) {
            console.error("[BioAI] JSON parse error from model output:", content);
            throw new Error("Invalid format from AI model");
        }
        res.json(parsed);
    }
    catch (error) {
        console.error("[BioAI] Generation error:", error.message);
        res.status(500).json({ error: "Não foi possível gerar o conteúdo." });
    }
});
router.post("/analyze-portfolio-image", requireFirebaseAuth, checkPlanFeature('advancedDashboard'), async (req, res) => {
    const { imageUrl, specialty } = req.body;
    if (!process.env.NVIDIA_API_KEY) {
        console.error("[PortfolioAI] NVIDIA_API_KEY is missing");
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
    }
    catch (error) {
        console.error("[PortfolioAI] error:", error.message);
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
        lastError: null
    };
    if (nvidiaKey) {
        try {
            const content = await callNvidiaAI([{ role: "user", content: "hi" }], {
                model: report.nvidiaModel,
                max_tokens: 1
            });
            report.canReachNvidia = !!content;
        }
        catch (err) {
            report.lastError = err.message;
        }
    }
    res.json(report);
});
router.get("/test-ai-service-description", debugOnly, async (req, res) => {
    const { serviceName } = req.query;
    if (!serviceName)
        return res.status(400).json({ error: "Missing serviceName" });
    const result = await getServiceDescriptionWithFallback(serviceName, "Beleza", 30, 100, "elegante");
    res.json(result);
});
router.post("/ai/service-description", requireFirebaseAuth, checkPlanFeature('advancedDashboard'), async (req, res) => {
    const { serviceName, professionalSpecialty, duration, price, tone } = req.body;
    const result = await getServiceDescriptionWithFallback(serviceName, professionalSpecialty || "Beleza", duration, price, tone);
    res.json(result);
});
router.post("/ai/categorize-service", requireFirebaseAuth, async (req, res) => {
    const { serviceName } = req.body;
    if (!process.env.NVIDIA_API_KEY) {
        console.warn("[AI SERVICE] NVIDIA failed (missing key), using local fallback");
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
    }
    catch (error) {
        console.warn("[AI SERVICE] NVIDIA categorization failed, using local fallback");
        res.json({ category: "Outros" });
    }
});
router.post("/ai/categorize-portfolio-item", requireFirebaseAuth, async (req, res) => {
    const { title, description } = req.body;
    if (!process.env.NVIDIA_API_KEY) {
        console.warn("[AI SERVICE] NVIDIA failed (missing key), using local fallback");
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
    }
    catch (error) {
        console.warn("[AI SERVICE] NVIDIA portfolio categorization failed, using local fallback");
        res.json({ category: "Geral" });
    }
});
router.get("/reports/monthly", requireFirebaseAuth, checkPlanFeature('reports'), async (req, res) => {
    const db = getDb();
    const { month } = req.query;
    const professionalId = String(req.query.professionalId || req.uid);
    if (professionalId !== req.uid) {
        console.warn(`[REPORT AUTH] User ${req.uid} attempted to access report of ${professionalId}. Access denied.`);
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
        const serviceMap = {};
        confirmed.forEach(a => {
            const name = a.serviceName || 'Serviço s/ nome';
            if (!serviceMap[name])
                serviceMap[name] = { count: 0, revenue: 0 };
            serviceMap[name].count++;
            serviceMap[name].revenue += (Number(a.price) || 0);
        });
        const topServices = Object.entries(serviceMap)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.revenue - a.revenue);
        // Top Days
        const dayMap = {};
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
        const [yearPart, monthPart] = month.split('-');
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
    }
    catch (error) {
        console.error("[REPORT] Generation error:", error);
        res.status(500).json({ error: "Erro ao gerar relatório." });
    }
});
export default router;
