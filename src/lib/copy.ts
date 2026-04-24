/**
 * Nera Copy Helpers
 * Dynamic copy generation based on professional profile data.
 */

interface Tagline {
  main: string;
  accent: string;
}

/**
 * Returns a dynamic tagline based on the professional's specialty.
 * Focused on premium, editorial and trustworthy style.
 */
export function getProfileHeroCopy(specialty?: string): Tagline {
  const s = (specialty || '').toLowerCase().trim();
  
  // Mappings based on keywords
  
  if (s.includes('nail') || s.includes('unha') || s.includes('alongamento')) {
    return { main: "Unhas bem feitas,", accent: "do seu jeito" };
  }
  
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('microblading') || s.includes('cílios') || s.includes('lash')) {
    return { main: "Cuidado profissional,", accent: "sem complicação" };
  }
  
  if (s.includes('esteticista') || s.includes('estética') || s.includes('estetica') || s.includes('facial') || s.includes('corporal')) {
    return { main: "Cuidado profissional,", accent: "sem complicação" };
  }

  // Fallback geral sugerido pelo usuário
  return { main: "Agende seu horário", accent: "com facilidade" };
}

/**
 * Categorizes a service based on its name.
 */
export function categorizeService(serviceName: string): string {
  const s = serviceName.toLowerCase();
  
  if (/unha|gel|porcelana|blindagem|esmaltação|manicure|pedicure|nail|fibra|banho de cristal/.test(s)) {
    return 'Unhas';
  }
  
  if (/sobrancelha|brow|design|henna|micropigmentação|microblading/.test(s)) {
    return 'Sobrancelhas';
  }
  
  if (/cílios|cilios|lash|extensão|volume brasileiro|fio a fio|lifting/.test(s)) {
    return 'Cílios';
  }
  
  if (/cabelo|corte|escova|coloração|hidratação|luzes|terapia capilar|mechas/.test(s)) {
    return 'Cabelo';
  }
  
  if (/limpeza de pele|peeling|drenagem|massagem|estética|facial|corporal|toxina|preenchimento/.test(s)) {
    return 'Estética';
  }
  
  return 'Outros';
}
