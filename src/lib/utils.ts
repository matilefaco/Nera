import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

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
 * Recursively removes empty strings, undefined, null, and empty arrays from an object.
 */
export function removeEmptyFields<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj
      .map(v => (v && typeof v === 'object' ? removeEmptyFields(v) : v))
      .filter(v => v !== null && v !== undefined && v !== '') as any;
  }
  
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const cleaned = value && typeof value === 'object' ? removeEmptyFields(value) : value;
      
      if (
        cleaned !== null && 
        cleaned !== undefined && 
        cleaned !== '' && 
        !(Array.isArray(cleaned) && cleaned.length === 0)
      ) {
        acc[key] = cleaned;
      }
      
      return acc;
    }, {} as any);
  }
  
  return obj;
}
