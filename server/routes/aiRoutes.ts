import express from 'express';
import { requireFirebaseAuth } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/test-service-description', async (req, res) => {
  try {
    const { serviceName, professionalSpecialty, duration, price, tone } = req.body;

    if (!process.env.NVIDIA_API_KEY) {
      return res.status(503).json({ success: false, error: 'AI service not configured', source: 'fallback' });
    }

    const systemPrompt = `Você é um curador de beleza e bem-estar (padrão premium). Sua missão é criar uma descrição elegante e direta para o serviço informado.
Retorne APENAS a descrição. Sem aspas, sem emojis, sem introdução, sem saudações.

Regras OBRIGATÓRIAS:
- Use exclusivamente Português do Brasil.
- NUNCA use "pestanas" (use "cílios"). NUNCA use "rapariga", "marcação", ou regionalismos de Portugal.
- A profissional é brasileira e atende clientes brasileiras.
- Máximo 120 caracteres. Apenas 1 frase.
- PROIBIDO usar emojis.
- PROIBIDO usar: "Nosso serviço", "Criado especialmente para você", "Por uma profissional experiente", "aumente", "design personalizado e sofisticado".
- Sem promessas perfeitas/absolutas (ex: olhar intenso e atraente), sem clichês.
- Não mencione o tempo de duração.
- Foco: benefício real percebido pela cliente, com clareza, leveza e naturalidade.`;

    const userPrompt = `Serviço: ${serviceName || 'Teste'}
${professionalSpecialty ? `Especialidade: ${professionalSpecialty}` : ''}
${price ? `Preço: R$${price}` : ''}
${tone ? `Tom: ${tone}` : ''}

Crie a descrição seguindo rigorosamente as regras.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

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
        temperature: 0.4,
        max_tokens: 50,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const status = response.status;
    const text = await response.text();

    return res.json({ status, text });

  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

router.post('/service-description', requireFirebaseAuth as any, async (req, res) => {
  try {
    const { serviceName, serviceCategory, professionalSpecialty, duration, price, tone } = req.body;

    if (!serviceName) {
      return res.status(400).json({ success: false, error: 'serviceName is required' });
    }

    if (!process.env.NVIDIA_API_KEY) {
      logger.warn('AI', 'NVIDIA_API_KEY not found in env vars');
      return res.status(503).json({ success: false, error: 'AI service not configured', source: 'fallback' });
    }

    logger.info('AI', 'Service description request', { 
      serviceName, 
      serviceCategory,
      duration, 
      price, 
      tone,
      hasNvidiaKey: !!process.env.NVIDIA_API_KEY,
      endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
      model: 'meta/llama-3.1-70b-instruct'
    });

    const systemPrompt = `Você é um curador de beleza e bem-estar (padrão premium). Sua missão é criar uma descrição elegante e direta para o serviço informado.
Retorne APENAS a descrição. Sem aspas, sem emojis, sem introdução, sem saudações.

Regras OBRIGATÓRIAS:
- Use exclusivamente Português do Brasil.
- NUNCA use "pestanas" (use "cílios"). NUNCA use "rapariga", "marcação", ou regionalismos de Portugal.
- A profissional é brasileira e atende clientes brasileiras.
- Máximo 120 caracteres. Apenas 1 frase.
- PROIBIDO usar emojis.
- PROIBIDO usar: "Nosso serviço", "Criado especialmente para você", "Por uma profissional experiente", "aumente", "design personalizado e sofisticado".
- Sem promessas perfeitas/absolutas (ex: olhar intenso e atraente), sem clichês.
- Não mencione o tempo de duração.
- Foco: benefício real percebido pela cliente, com clareza, leveza e naturalidade.`;

    const userPrompt = `Serviço: ${serviceName}
${serviceCategory ? `Categoria do Serviço: ${serviceCategory}` : ''}
${professionalSpecialty ? `Especialidade: ${professionalSpecialty}` : ''}
${price ? `Preço: R$${price}` : ''}
${tone ? `Tom: ${tone}` : ''}

Crie a descrição seguindo rigorosamente as regras. A descrição deve estar alinhada de forma clara e inquestionável à Categoria do Serviço quando aplicável (não misture depilação com sobrancelhas/cílios, por exemplo).`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

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
        temperature: 0.4,
        max_tokens: 50,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('AI', `NVIDIA API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ success: false, error: `NVIDIA API Erro: ${response.status}`, details: errorText, source: 'fallback' });
    }

    const data: any = await response.json();
    logger.info('AI', 'NVIDIA API response received', { 
       choices: data.choices?.length, 
       model: data.model 
    });
    
    let description = data.choices?.[0]?.message?.content?.trim();

    if (description) {
      // PÓS-PROCESSAMENTO NERA
      description = description.replace(/["']/g, ''); // Sem aspas
      // Sem emojis
      description = description.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{E0020}-\u{E007F}\u{FE0F}\u{200D}\u{2B50}]/gu, ''); 
      description = description.replace(/\s+/g, ' ').trim(); // Sem espaços duplicados
      
      // Ajuste PT-BR obrigatório
      description = description.replace(/pestanas/gi, 'cílios');
      description = description.replace(/pestana/gi, 'cílio');
      description = description.replace(/marcação/gi, 'agendamento');
      description = description.replace(/marcar/gi, 'agendar');
      
      // Tentar evitar frases cortadas
      if (description.length > 120) {
        const match = description.substring(0, 120).match(/(.*[.!?])/);
        if (match && match[1]) {
           description = match[1];
        } else {
           description = description.substring(0, 117) + '...';
        }
      }

      // Proibidos fallback
      const lowerContent = description.toLowerCase();
      if (lowerContent.includes("nosso serviço") || lowerContent.includes("criado especialmente") || !description.trim() || description.length < 10) {
        // Usa um fallback seguro e genérico que será manipulado no frontend e aiService
        return res.status(500).json({ success: false, error: 'AI output rejected by custom filters', source: 'fallback' });
      }

      // Ensure ending punctuation
      if (!/[.!?]$/.test(description)) {
        description += '.';
      }

      return res.json({ success: true, description, source: 'nvidia' });
    } else {
      return res.status(500).json({ success: false, error: 'Empty response from AI', source: 'fallback' });
    }

  } catch (error: any) {
    logger.error('AI', `Error generating description: ${error.message}\nStack: ${error.stack}`);
    
    // Avoid the keyword "failed" to prevent masking by the frontend friendly message utility
    const safeErrorMsg = error.message.replace(/failed/gi, 'falhou');
    return res.status(500).json({ success: false, error: `Erro Interno: ${safeErrorMsg}`, source: 'fallback' });
  }
});

router.post('/suggest-bio', requireFirebaseAuth as any, async (req, res) => {
  try {
    const { 
      context, 
      style, 
      specialty, 
      yearsExperience, 
      differentials 
    } = req.body;

    if (!process.env.NVIDIA_API_KEY) {
      logger.warn('AI', 'NVIDIA_API_KEY not found in env vars for /suggest-bio');
      return res.status(503).json({ success: false, error: 'AI service not configured' });
    }

    const systemPrompt = `Você é um copywriter de alto padrão do mercado de beleza e bem-estar.
Sua tarefa é criar uma bio (biografia curta) e um headline para um perfil profissional.

Regras OBRIGATÓRIAS para a Bio:
- Use exclusivamente Português do Brasil.
- Aja como a própria profissional (primeira pessoa do singular: "eu").
- Máximo de 3 parágrafos curtos.
- Sem aspas no começo/fim. Sem emojis em excesso (máximo 1 muito sutil).
- Aborde como atende, qual transformação entrega e por que a cliente pode confiar.
- PROIBIDO usar "pestanas", "rapariga", "marcação".
- Evite clichês vazios e frases genéricas ("aumente sua autoestima" ou "melhor profissional").

Regras para o Headline:
- Frase curtíssima (máx 100 caracteres) de efeito sobre a especialidade e entrega.
- Ex: "Design de sobrancelhas focado em naturalidade e leveza." ou "Cuidando da sua pele com ciência e carinho."

Retorne os resultados em JSON estritamente válido neste formato:
{
  "headline": "...",
  "bio": "..."
}`;

    let userPrompt = `Especialidade principal: ${specialty || 'Beleza/Estética'}
Tempo de experiência: ${yearsExperience || 'Nenhum informado'}
${differentials && differentials.length > 0 ? `Diferenciais do meu trabalho: ${differentials.join(', ')}\n` : ''}
${style ? `Estilo/Vibe desejada: ${style}\n` : ''}
${context ? `Notas adicionais (super importante incorporar isso): ${context}\n` : ''}

Lembre-se de retornar APENAS o JSON válido. Nenhuma outra palavra fora do JSON.`;

    logger.info('AI', 'Bio suggestion request', { specialty, style });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

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
        max_tokens: 300,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('AI', `NVIDIA API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ success: false, error: `NVIDIA API Erro: ${response.status}` });
    }

    const data: any = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Attempt to extract JSON if LLM returned markdown blocks
    if (content.includes("```json")) {
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    try {
        const parsed = JSON.parse(content);
        if (!parsed.bio && !parsed.headline) throw new Error("JSON não contém as chaves esperadas");
        return res.json({ success: true, bio: parsed.bio || '', headline: parsed.headline || '' });
    } catch(e) {
        logger.error('AI', 'Failed to parse JSON response for suggest-bio');
        return res.status(500).json({ success: false, error: 'JSON parsing failed from AI response', content });
    }

  } catch (error: any) {
    logger.error('AI', `Error generating bio: ${error.message}\nStack: ${error.stack}`);
    return res.status(500).json({ success: false, error: `Erro Interno: ${error.message}` });
  }
});

export default router;
