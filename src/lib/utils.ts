import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Timestamp, FieldValue } from 'firebase/firestore';
import { AddressData } from '../types';

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
 * Recursively removes undefined fields from an object or array.
 */
export function removeUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefinedDeep(v)])
    );
  }
  return value;
}

/**
 * Recursively removes empty strings, undefined, null, and empty arrays from an object.
 */
export function removeEmptyFields<T>(obj: T): T {
  return removeUndefinedDeep(obj);
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
 * Returns current time in "HH:mm" format relative to local time.
 */
export function getTodayLocaleTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
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

  // Handle errors that were stringified by handleFirestoreError or are plain objects
  let code = '';
  
  if (error.code) {
    code = error.code;
  } else if (typeof error === 'string') {
    code = error;
  } else if (error.message) {
    // Check if message is the JSON string from handleFirestoreError
    try {
      if (error.message.startsWith('{') && error.message.includes('error')) {
        const parsed = JSON.parse(error.message);
        code = parsed.error || error.message;
      } else {
        code = error.message;
      }
    } catch {
      code = error.message;
    }
  }

  const errorMap: Record<string, string> = {
    'auth/email-already-in-use': "Este e-mail já está cadastrado",
    'auth/weak-password': "Senha muito fraca (use pelo menos 6 caracteres)",
    'auth/network-request-failed': "Erro de conexão. Verifique sua internet.",
    'auth/popup-closed-by-user': "A janela foi fechada antes de concluir.",
    'auth/operation-not-allowed': "Este método de login não está ativo.",
    'auth/user-not-found': "Usuário não encontrado.",
    'auth/wrong-password': "E-mail ou senha incorretos.",
    'auth/invalid-email': "E-mail inválido.",
    'auth/invalid-credential': "Credenciais inválidas. Verifique seu e-mail e senha.",
    'auth/too-many-requests': "Muitas tentativas. Tente novamente mais tarde.",
    'auth/invalid-api-key': "Configuração do Firebase inválida (API Key).",
    'auth/app-deleted': "Ocorreu um erro crítico na configuração do app.",
    'auth/configuration-not-found': "Configuração de login não encontrada.",
    'auth/unauthorized-domain': "Este domínio não está autorizado no Firebase.",
    'permission-denied': "Erro interno de permissão. Tente relogar.",
    'firestore/permission-denied': "Erro interno de permissão. Tente relogar.",
    'unavailable': "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    'firestore/unavailable': "O serviço está temporariamente indisponível. Tente novamente em instantes.",
    'not-found': "Não conseguimos encontrar essa informação.",
    'firestore/not-found': "Não conseguimos encontrar essa informação.",
    'already-exists': "Isso já foi cadastrado no nosso sistema.",
    'firestore/already-exists': "Isso já foi cadastrado no nosso sistema.",
    'auth/unauthenticated': "Sua sessão expirou. Por favor, entre na sua conta novamente.",
    'unauthenticated': "Sua sessão expirou. Por favor, entre na sua conta novamente.",
    'auth/popup-blocked': "O navegador bloqueou a janela. Por favor, permita popups.",
    'unauthorized-domain': "Domínio não autorizado nas configurações do Firebase.",
  };

  // Check for exact matches first
  if (errorMap[code]) return errorMap[code];

  // Check for partial matches or specific codes in the string
  for (const [key, message] of Object.entries(errorMap)) {
    if (code.toLowerCase().includes(key.toLowerCase())) return message;
  }

  // Common network strings
  if (code.includes('network-error') || code.includes('failed to fetch') || code.includes('offline')) {
    return "Erro de conexão. Verifique sua internet.";
  }

  return "Não foi possível concluir agora. Tente novamente.";
}

/**
 * Removes all non-numeric characters from a string.
 */
export function cleanWhatsapp(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

/**
 * Formats a numeric string into the "(XX) XXXXX-XXXX" pattern for display.
 * Handles partial inputs gracefully.
 */
export function formatWhatsappDisplay(raw: string): string {
  const cleaned = cleanWhatsapp(raw);
  const len = cleaned.length;

  if (len === 0) return '';
  if (len <= 2) return `(${cleaned}`;
  if (len <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (len <= 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
}

/**
 * Validates if a string is a valid Brazilian WhatsApp number.
 * Must have 10 or 11 digits and start with a valid Brazilian DDD.
 */
export function isValidWhatsapp(raw: string): boolean {
  const cleaned = cleanWhatsapp(raw);
  
  // Basic length check
  if (cleaned.length !== 10 && cleaned.length !== 11) return false;
  
  // DDD check (11 to 99)
  const ddd = parseInt(cleaned.slice(0, 2));
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;
  
  // If 11 digits, must start with 9 after DDD (mobile convention)
  if (cleaned.length === 11 && cleaned[2] !== '9') return false;
  
  return true;
}

/**
 * Generates a premium WhatsApp invitation message for the waitlist.
 */
export function generateWaitlistInviteMessage(
  clientName: string, 
  date: string, 
  time: string, 
  slug: string, 
  entryId: string,
  proName: string = 'Nera'
): string {
  const firstName = clientName.split(' ')[0];
  const isToday = date === getTodayLocale();
  const dateFormatted = isToday ? 'hoje' : formatLocalDate(date, { day: 'numeric', month: 'long' });
  const baseUrl = window.location.origin;

  return `Olá, ${firstName}! ✨ Notícia especial: uma vaga acabou de abrir na agenda de ${proName} para ${dateFormatted}, às ${time}.

Como você está na nossa lista prioritária, reservamos este horário exclusivamente para você pelos próximos 15 minutos. 

Deseja aproveitar? Garanta sua reserva aqui: ${baseUrl}/p/${slug}?w=${entryId}`;
}

/**
 * Generates a premium WhatsApp confirmation message for bookings.
 */
export function generateBookingConfirmationMessage(
  serviceName: string,
  date: string,
  time: string
): string {
  const dateFormatted = formatLocalDate(date, { day: 'numeric', month: 'long' });
  
  return `Oi! Acabei de realizar uma reserva para o serviço *${serviceName}* pelo seu perfil no Nera. ✨ 

🗓️ Data: ${dateFormatted}
⏰ Horário: ${time}

Poderia me confirmar se está tudo certo?`;
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

/**
 * Returns a relative date string in Portuguese (e.g., "há 2 semanas").
 */
export function getRelativeDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays < 1) return 'hoje';
  if (diffInDays === 1) return 'ontem';
  if (diffInDays < 7) return `há ${diffInDays} dias`;
  if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7);
    return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  const months = Math.floor(diffInDays / 30);
  return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

/**
 * Generates a unique 6-character referral code based on name + random chars.
 */
export function generateReferralCode(name: string): string {
  const cleanName = (name || 'NERA').trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
  const prefix = cleanName.substring(0, 4);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, 0, I, 1 for clarity
  let random = '';
  const remainingLength = Math.max(2, 6 - prefix.length);
  
  for (let i = 0; i < remainingLength; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return (prefix + random).substring(0, 6);
}

/**
 * Converts various date formats (Timestamp, Date, ISO String) to a standard JS Date.
 */
export function parseFirestoreDate(date: Timestamp | Date | string | FieldValue): Date {
  if (!date) return new Date();
  
  if (date instanceof Date) return date;
  
  if (typeof date === 'string') {
    return new Date(date);
  }
  
  if (date && typeof date === 'object' && 'seconds' in date) {
    return (date as Timestamp).toDate();
  }
  
  // For FieldValue or unknown types, return current date as fallback
  return new Date();
}

/**
 * Normalizes an address from legacy string format to standard AddressData object.
 */
export function parseAddress(address: AddressData | string): AddressData {
  if (!address) {
    return { street: '', number: '', neighborhood: '', city: '' };
  }
  
  if (typeof address === 'string') {
    // Basic heuristics for legacy string format "Street, Number - Neighborhood, City"
    const parts = address.split(/[,\-]/).map(p => p.trim());
    return {
      street: parts[0] || address,
      number: parts[1] || '',
      neighborhood: parts[2] || '',
      city: parts[3] || '',
    };
  }
  
  return address;
}

/**
 * Normalizes an Instagram handle by removing URLs, @ symbols, spacing, 
 * accents and invalid characters. Converts to lowercase and caps at 30 chars.
 */
export function normalizeInstagram(value: string): string {
  if (!value) return '';
  // Remove "https://instagram.com/" and variations
  let clean = value.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '');
  // Remove "@" from start
  clean = clean.replace(/^@/, '');
  // Remove spaces, accents and invalid characters
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
  clean = clean.replace(/[^a-zA-Z0-9._]/g, '');
  // Convert to lowercase
  clean = clean.toLowerCase();
  // Limit to 30 characters
  return clean.substring(0, 30);
}

export const INSTAGRAM_REGEX = /^[a-zA-Z0-9._]{1,30}$/;
