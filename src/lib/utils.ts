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

/**
 * Humanizes technical error messages for the user.
 */
export function getHumanError(error: any): string {
  if (!error) return "Algo deu errado. Tente novamente.";

  const code = error.code || (typeof error === 'string' ? error : '');
  
  const errorMap: Record<string, string> = {
    'permission-denied': "Você não tem permissão para realizar esta ação.",
    'firestore/permission-denied': "Você não tem permissão para realizar esta ação.",
    'unavailable': "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    'firestore/unavailable': "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    'not-found': "Não conseguimos encontrar essa informação.",
    'firestore/not-found': "Não conseguimos encontrar essa informação.",
    'already-exists': "Isso já foi cadastrado no nosso sistema.",
    'firestore/already-exists': "Isso já foi cadastrado no nosso sistema.",
    'unauthenticated': "Sua sessão expirou. Por favor, entre na sua conta novamente.",
    'auth/unauthenticated': "Sua sessão expirou. Por favor, entre na sua conta novamente.",
    'auth/user-not-found': "Usuário não encontrado.",
    'auth/wrong-password': "E-mail ou senha incorretos.",
    'auth/invalid-email': "E-mail inválido.",
    'auth/email-already-in-use': "Este e-mail já está em uso.",
    'auth/weak-password': "A senha é muito fraca.",
    'auth/popup-blocked': "O navegador bloqueou a janela de login. Por favor, permita popups.",
  };

  // Check for partial matches or specific codes
  for (const [key, message] of Object.entries(errorMap)) {
    if (code.includes(key)) return message;
  }

  return "Algo deu errado. Tente novamente.";
}

/**
 * Removes all non-numeric characters from a string.
 */
export function cleanWhatsapp(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Formats a numeric string into the "(XX) XXXXX-XXXX" pattern for display.
 */
export function formatWhatsappDisplay(raw: string): string {
  const cleaned = cleanWhatsapp(raw);
  // Matches 11 digits: XX XXXXX XXXX
  const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  // Matches 10 digits (no 9): XX XXXX XXXX
  const matchShort = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
  if (matchShort) {
    return `(${matchShort[1]}) ${matchShort[2]}-${matchShort[3]}`;
  }
  return raw;
}

/**
 * Builds a standard WhatsApp chat link.
 */
export function buildWhatsappLink(raw: string, message?: string): string {
  const cleaned = cleanWhatsapp(raw);
  // Ensure we don't have double 55 if the cleaning didn't catch it
  const phone = cleaned.startsWith('55') && cleaned.length > 11 ? cleaned.substring(2) : cleaned;
  return `https://wa.me/55${phone}?text=${encodeURIComponent(message || '')}`;
}

/**
 * Premium Bio Logic for Nera:
 * Splits a bio into a "Hero version" (punchy summary) and an "About version" (the rest).
 * Ensures no repetition and handles small bios by hiding the 'About' section.
 */
export function splitSmartBio(bio: string | undefined, limit: number = 140): { hero: string; about: string | null } {
  if (!bio) return { hero: '', about: null };
  const trimmedBio = bio.trim();

  // If total bio is shorter than the limit, everything goes to hero, about is hidden
  if (trimmedBio.length < limit) {
    return { hero: trimmedBio, about: null };
  }

  // Find a good sentence boundary within a strict target (e.g., 120 chars for a cleaner hero)
  const targetHeroLength = 120;
  
  // Regex to find sentences (ending in . ! or ?)
  const sentences = trimmedBio.match(/[^.!?]+[.!?]+(?:\s+|\n|$)/g) || [trimmedBio];
  
  let heroText = "";
  let currentIndex = 0;

  for (const sentence of sentences) {
    // If adding this sentence stays within a reasonable "punchy" range
    if ((heroText + sentence).length <= targetHeroLength + 20) {
      heroText += sentence;
      currentIndex += sentence.length;
    } else {
      break;
    }
  }

  // Fallback: if the first sentence alone is too long, or we couldn't find good sentences
  if (!heroText || currentIndex === 0) {
    // Take up to targetHeroLength characters
    heroText = trimmedBio.substring(0, targetHeroLength);
    const lastSpace = heroText.lastIndexOf(' ');
    if (lastSpace > targetHeroLength / 2) {
      heroText = heroText.substring(0, lastSpace);
    }
    heroText += '...';
    currentIndex = lastSpace > 0 ? lastSpace : targetHeroLength;
  }

  const aboutText = trimmedBio.substring(currentIndex).trim();

  // If the about text is very small (e.g. just a few words left), 
  // merge it back to hero to avoid a weird "About" section with one line.
  if (aboutText.length < 80) {
    return { hero: trimmedBio, about: null };
  }

  return { 
    hero: heroText.trim(), 
    about: aboutText 
  };
}
