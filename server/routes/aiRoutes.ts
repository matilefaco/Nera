import express from 'express';
import { requireFirebaseAuth } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/service-description', requireFirebaseAuth as any, async (req, res) => {
  try {
    const { serviceName, professionalSpecialty, duration, price, tone } = req.body;

    if (!serviceName) {
      return res.status(400).json({ success: false, error: 'serviceName is required' });
    }

    if (!process.env.NVIDIA_API_KEY) {
      logger.warn('AI', 'NVIDIA_API_KEY not found in env vars');
      return res.status(503).json({ success: false, error: 'AI service not configured', source: 'fallback' });
    }

    logger.info('AI', 'Service description request', { serviceName, duration, price, tone });

    const systemPrompt = `Você é um assistente especialista em beleza e estética. Sua missão é criar descrições curtas e elegantes (em português do Brasil) para serviços de beleza, de forma atrativa mas sem exageros.
    Retorne APENAS a descrição. Sem aspas iniciais/finais, sem marcadores e sem introduções or saudações. Máximo de 2 frases curtas.`;

    const userPrompt = `Serviço: ${serviceName}
${professionalSpecialty ? `Especialidade: ${professionalSpecialty}` : ''}
${duration ? `Duração: ${duration} minutos` : ''}
${price ? `Preço: R$${price}` : ''}
${tone ? `Tom: ${tone}` : ''}

Crie uma descrição focada no benefício para o cliente.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 100,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('AI', `NVIDIA API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ success: false, error: `NVIDIA API failed: ${response.status}`, details: errorText, source: 'fallback' });
    }

    const data: any = await response.json();
    logger.info('AI', 'NVIDIA API response received', { 
       choices: data.choices?.length, 
       model: data.model 
    });
    
    let description = data.choices?.[0]?.message?.content?.trim();

    if (description) {
      // Remove possible quotes
      description = description.replace(/^["']|["']$/g, '').trim();
      return res.json({ success: true, description, source: 'nvidia' });
    } else {
      return res.status(500).json({ success: false, error: 'Empty response from AI', source: 'fallback' });
    }

  } catch (error: any) {
    logger.error('AI', `Error generating description: ${error.message}\nStack: ${error.stack}`);
    return res.status(500).json({ success: false, error: `Internal server error: ${error.message}`, source: 'fallback' });
  }
});

export default router;
