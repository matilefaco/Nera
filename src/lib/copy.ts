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
 * Uses a seed (slug/uid) to ensure consistency.
 */
export function getProfileHeroCopy(specialty?: string, seed?: string): Tagline {
  const s = (specialty || '').toLowerCase().trim();
  
  // Deterministic index determination
  let index = 0;
  if (seed) {
    // Get first 4 chars, convert to numbers, sum them up
    const chars = seed.slice(0, 4).toLowerCase();
    let val = 0;
    for (let i = 0; i < chars.length; i++) {
      val += chars.charCodeAt(i);
    }
    index = val % 3;
  } else {
    index = Math.floor(Math.random() * 3);
  }
  
  // Unhas
  if (s.includes('nail') || s.includes('unha') || s.includes('alongamento') || s.includes('gel') || s.includes('fibra') || s.includes('manicure')) {
    return [
      { main: "Unhas que falam,", accent: "antes de você" },
      { main: "A arte do detalhe,", accent: "em suas mãos" },
      { main: "Resistência e brilho,", accent: "que encantam" }
    ][index];
  }
  // Sobrancelhas e cílios
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('microblading') || s.includes('micropigment') || s.includes('cílio') || s.includes('lash') || s.includes('extensão')) {
    return [
      { main: "Olhos que", accent: "encantam" },
      { main: "O poder do seu olhar,", accent: "redefinido" },
      { main: "Moldura perfeita,", accent: "beleza natural" }
    ][index];
  }
  // Estética facial e corporal
  if (s.includes('esteticista') || s.includes('estética') || s.includes('facial') || s.includes('pele') || s.includes('skin') || s.includes('microagulha') || s.includes('limpeza')) {
    return [
      { main: "Sua melhor pele,", accent: "começa aqui" },
      { main: "Equilíbrio facial,", accent: "resultados reais" },
      { main: "A ciência do cuidado,", accent: "com sua pele" }
    ][index];
  }
  // Cabelo
  if (s.includes('cabel') || s.includes('hair') || s.includes('colorist') || s.includes('escova') || s.includes('corte') || s.includes('tranças') || s.includes('mechas')) {
    return [
      { main: "Cabelo de", accent: "editorial" },
      { main: "Transformação com", accent: "propósito" },
      { main: "Sua identidade,", accent: "em cada fio" }
    ][index];
  }
  // Maquiagem
  if (s.includes('maquiag') || s.includes('make') || s.includes('makeup') || s.includes('noiva') || s.includes('festa')) {
    return [
      { main: "Make que", accent: "dura o dia" },
      { main: "Beleza atemporal,", accent: "para momentos únicos" },
      { main: "Sua melhor versão,", accent: "iluminada" }
    ][index];
  }
  // Massagem e bem-estar
  if (s.includes('massag') || s.includes('relaxa') || s.includes('drenag') || s.includes('bem-estar') || s.includes('corpo')) {
    return [
      { main: "O descanso que", accent: "você merece" },
      { main: "Pausa necessária,", accent: "renovação total" },
      { main: "Conexão profunda,", accent: "com seu corpo" }
    ][index];
  }
  // Depilação
  if (s.includes('depila') || s.includes('cera') || s.includes('laser') || s.includes('pelo')) {
    return [
      { main: "Pele suave,", accent: "sem complicação" },
      { main: "Liberdade e", accent: "conforto" },
      { main: "Cuidado delicado,", accent: "pele renovada" }
    ][index];
  }
  // Podologia e pés
  if (s.includes('podolog') || s.includes('pé') || s.includes('pedicure') || s.includes('cutícula')) {
    return [
      { main: "Cuidado do pé", accent: "à cabeça" },
      { main: "Seus pés em", accent: "boas mãos" },
      { main: "Saúde e bem-estar,", accent: "a cada passo" }
    ][index];
  }
  // Visagismo e imagem
  if (s.includes('visag') || s.includes('imagem') || s.includes('estilo') || s.includes('personal')) {
    return [
      { main: "Sua imagem,", accent: "sua essência" },
      { main: "Comunicação visual,", accent: "com autoconfiança" },
      { main: "O espelho da", accent: "sua alma" }
    ][index];
  }
  // Fallback premium (não genérico)
  return { main: "Profissional de", accent: "excelência" };
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
