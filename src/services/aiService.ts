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
}): Promise<{ description: string; source: 'nvidia' | 'fallback' }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22000); // Slightly longer than backend

  try {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await fetch('/api/ai/service-description', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(params),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate description');
    }

    return { 
      description: data.description || '', 
      source: data.source || 'nvidia' 
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('[AI SERVICE] generateServiceDescription failed:', error.message);
    return { description: '', source: 'fallback' }; 
  }
}

export async function categorizeService(serviceName: string): Promise<string> {
  try {
    const token = await auth.currentUser?.getIdToken(true);
    const response = await fetch('/api/ai/categorize-service', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    const response = await fetch('/api/ai/analyze-portfolio-image', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
    const response = await fetch('/api/ai/categorize-portfolio-item', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
