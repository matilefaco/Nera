import { Service, PortfolioItem } from '../types';
import { auth } from '../firebase';

/**
 * AI Service to handle all intelligence features using NVIDIA API via backend proxy.
 */
export async function generateServiceDescription(params: {
  serviceName: string;
  professionalSpecialty?: string;
  duration?: string;
  price?: string | number;
  tone?: string;
}): Promise<{ description: string; source: 'nvidia' | 'fallback', error?: string }> {
  let attempt = 0;
  let lastError: any;

  while (attempt < 2) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const token = await auth.currentUser?.getIdToken(true);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/ai/service-description', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      console.log(`[AI SERVICE] generateServiceDescription attempt ${attempt+1} status:`, response.status);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Parse da resposta backend falhou: ${text.substring(0, 100)}`);
      }
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar descrição');
      }

      return { 
        description: data.description || '', 
        source: data.source || 'nvidia' 
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn(`[AI SERVICE] generateServiceDescription attempt ${attempt+1} failed:`, error.message);
      lastError = error;
      
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
         break; // Não faz retry se for timeout, cai no fallback imediatamente
      }

      attempt++;
      if (attempt < 2) {
        // Wait briefly before retrying
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  console.error('[AI SERVICE] generateServiceDescription failed completely:', lastError.message, lastError.stack, lastError);
  
  return { description: 'Realça os cílios com leveza, mantendo um acabamento delicado e natural.', source: 'fallback', error: `${lastError.name}: ${lastError.message}` }; 
}

export async function categorizeService(serviceName: string): Promise<string> {
  try {
    const token = await auth.currentUser?.getIdToken(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/ai/categorize-service', {
      method: 'POST',
      headers,
      body: JSON.stringify({ serviceName }),
    });

    if (!response.ok) {
      throw new Error('Failed to categorize service');
    }

    const data = await response.json();
    return data.category;
  } catch (error) {
    console.warn('[AI SERVICE] NVIDIA failed for categorizeService, using local fallback');
    // Local fallback logic (already in lib/copy.ts, but we keep it here as safety)
    return 'Outros'; 
  }
}

export async function analyzePortfolio(params: {
  imageUrl: string;
  specialty?: string;
}): Promise<string> {
  try {
    const token = await auth.currentUser?.getIdToken(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/ai/analyze-portfolio-image', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze portfolio');
    }

    const data = await response.json();
    return data.category;
  } catch (error) {
    console.warn('[AI SERVICE] NVIDIA failed for analyzePortfolio, using local fallback');
    return 'Portfólio';
  }
}

export async function categorizePortfolioItem(params: {
  title: string;
  description?: string;
}): Promise<string> {
  try {
    const token = await auth.currentUser?.getIdToken(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/ai/categorize-portfolio-item', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to categorize portfolio item');
    }

    const data = await response.json();
    return data.category;
  } catch (error) {
    console.warn('[AI SERVICE] NVIDIA failed for categorizePortfolioItem, using local fallback');
    return 'Geral';
  }
}
