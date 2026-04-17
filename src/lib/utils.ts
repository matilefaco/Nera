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

/**
 * Parses a "YYYY-MM-DD" string into a Date object at local midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a "YYYY-MM-DD" string into a localized Portuguese string without timezone shift.
 */
export function formatLocalDate(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('pt-BR', options);
}

/**
 * Returns today's date in "YYYY-MM-DD" format relative to local time.
 */
export function getTodayLocale(): string {
  return formatDateKey(new Date());
}

/**
 * Converts a Date object into a "YYYY-MM-DD" string in local time.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
