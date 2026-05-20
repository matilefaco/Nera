export const SERVICE_MODES = {
  studio: {
    label: "Atende no estúdio",
    shortLabel: "Estúdio",
    description: "Clientes vão até você no seu espaço.",
    icon: "Building2"
  },
  home: {
    label: "Atende em domicílio",
    shortLabel: "Domicílio",
    description: "Você vai até o endereço das suas clientes.",
    icon: "Home"
  },
  hybrid: {
    label: "Estúdio e domicílio",
    shortLabel: "Híbrido",
    description: "Você atende no seu espaço e também vai até as clientes.",
    icon: "MapPin"
  }
} as const;

export type ServiceModeKey = keyof typeof SERVICE_MODES;

export const getServiceModeLabel = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.label || mode;
};

export const getServiceModeShortLabel = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.shortLabel || mode;
};

export const getServiceModeDescription = (mode?: string) => {
  if (!mode) return "";
  return (SERVICE_MODES as any)[mode]?.description || "";
};

/**
 * Formats a specialty into a more natural sounding string.
 */
export const formatSpecialtyLabel = (specialty: string = "") => {
  if (!specialty) return "Profissional de beleza";
  const s = specialty.toLowerCase().trim();
  
  const mappings: Record<string, string> = {
    'maquiadora': "Maquiadora",
    'maquiagem': "Maquiadora",
    'make': "Maquiadora",
    'nail designer': "Nail Designer",
    'manicure': "Manicure & Pedicure",
    'pedicure': "Manicure & Pedicure",
    'pés e mãos': "Manicure & Pedicure",
    'design de unhas': "Nail Designer",
    'designer de sobrancelhas': "Designer de Sobrancelhas",
    'sobrancelhas': "Designer de Sobrancelhas",
    'lash designer': "Lash Designer",
    'lash': "Lash Designer",
    'extensionista de cílios': "Extensionista de Cílios",
    'cílios': "Lash Designer",
    'micropigmentadora': "Micropigmentadora",
    'micropigmentação': "Micropigmentadora",
    'micro': "Micropigmentadora",
    'esteticista': "Esteticista",
    'estética': "Esteticista",
    'cabeleireira': "Cabeleireira",
    'cabelo': "Cabeleireira",
    'hair': "Hair Stylist",
    'terapeuta capilar': "Terapeuta Capilar",
    'massoterapeuta': "Massoterapeuta",
    'massagem': "Massoterapeuta",
    'bronzeamento': "Especialista em Bronzeamento",
    'bronze': "Especialista em Bronzeamento",
    'depiladora': "Depiladora",
    'depilação': "Depiladora",
    'body piercing': "Body Piercer",
    'piercing': "Body Piercer"
  };

  if (mappings[s]) return mappings[s];
  
  // Capitalize if not mapped
  return specialty.charAt(0).toUpperCase() + specialty.slice(1);
};

/**
 * Returns dynamic copywriting for the hero section based on the professional's specialty.
 */
export const getProfileHeroCopy = (specialty: string = "", id: string = "") => {
  const s = specialty.toLowerCase().trim();
  
  if (s.includes('unha') || s.includes('manicure') || s.includes('pedicure') || s.includes('nail')) {
    return { main: "Transformando mãos em", accent: "arte" };
  }
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('olhar') || s.includes('micropigmentadora')) {
    return { main: "Design que valoriza o seu", accent: "olhar" };
  }
  if (s.includes('cílios') || s.includes('lash') || s.includes('extensão')) {
    return { main: "O segredo de um", accent: "olhar marcante" };
  }
  if (s.includes('cabelo') || s.includes('hair') || s.includes('penteado') || s.includes('cabeleireira')) {
    return { main: "Expressando sua essência através dos", accent: "fios" };
  }
  if (s.includes('maquiagem') || s.includes('make') || s.includes('maquiadora')) {
    return { main: "Sua beleza autêntica", accent: "realçada" };
  }
  if (s.includes('estética') || s.includes('esteticista')) {
    return { main: "A ciência do cuidado", accent: "com você" };
  }
  
  const formatted = formatSpecialtyLabel(specialty);
  
  if (formatted === "Profissional de beleza") {
    return { main: "Estética &", accent: "Bem-estar" };
  }
  
  return { 
    main: "Especialista em", 
    accent: formatted 
  };
};

/**
 * Generates clear copy for service locations/modes.
 */
export const getServiceLocationCopy = (profile: any) => {
  const { serviceMode, serviceAreaType, city, neighborhood, studioAddress, serviceAreas } = profile;
  
  const hasNeighborhood = !!neighborhood && neighborhood.trim() !== "";
  const hasCity = !!city && city.trim() !== "";
  const locationLabel = hasNeighborhood ? neighborhood : (hasCity ? city : "");
  
  if (serviceMode === 'studio') {
    if (studioAddress?.privacyMode === 'public_full' && studioAddress?.street) {
      const streetPart = `${studioAddress.street}${studioAddress.number ? `, ${studioAddress.number}` : ""}`;
      return `Estúdio em ${streetPart}`;
    }
    if (hasNeighborhood) return `Estúdio em ${neighborhood}`;
    if (hasCity) return `Atende no estúdio em ${city}`;
    return `Atende no estúdio`;
  }
  
  if (serviceMode === 'home') {
    const isCityWide = serviceAreaType === 'city_wide';
    const hasSelectedAreas = serviceAreas && serviceAreas.length > 0;

    if (isCityWide) return `Atende em domicílio em toda a cidade`;
    if (hasSelectedAreas) return `Atende em domicílio nos bairros selecionados`;
    if (hasCity) return `Atende em domicílio em ${city}`;
    return `Atende em domicílio`;
  }
  
  if (serviceMode === 'hybrid') {
    const isCityWide = serviceAreaType === 'city_wide';
    const hasSelectedAreas = serviceAreas && serviceAreas.length > 0;

    if (isCityWide) return `Atende em estúdio e em domicílio em toda a cidade`;
    if (hasSelectedAreas) return `Atende em estúdio e em domicílio nos bairros selecionados`;
    
    if (hasNeighborhood) {
      return `Estúdio em ${neighborhood} e atendimento em domicílio`;
    }
    
    if (hasCity) return `Atende em estúdio e em domicílio em ${city}`;
    return `Atende em estúdio e em domicílio`;
  }
  
  return "";
};

/**
 * Categorizes a service name into one of the predefined categories.
 */
export const categorizeService = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('unha') || n.includes('pé') || n.includes('mão') || n.includes('esmalte') || n.includes('manicure') || n.includes('pedicure') || n.includes('gel') || n.includes('nail')) return 'Unhas';
  if (n.includes('sobrancelha') || n.includes('henna') || n.includes('brow') || n.includes('micro')) return 'Sobrancelhas';
  if (n.includes('cílio') || n.includes('lash') || n.includes('fio a fio')) return 'Cílios';
  if (n.includes('cabelo') || n.includes('corte') || n.includes('escova') || n.includes('mecha') || n.includes('color') || n.includes('hair')) return 'Cabelo';
  if (n.includes('limpeza') || n.includes('pele') || n.includes('facial') || n.includes('massagem') || n.includes('facial') || n.includes('corpo') || n.includes('estética')) return 'Estética';
  return 'Outros';
};

/**
 * Returns the correct notification and professional awareness copy based on plan and WhatsApp availability.
 */
export const getBookingNotificationCopy = (plan: string = 'free', hasWhatsApp: boolean = false) => {
  const isPro = plan === 'pro';
  const isEssencial = plan === 'essencial';
  
  const data = {
    notification: "Você receberá atualizações por e-mail.",
    professional: "A profissional será avisada sobre sua solicitação."
  };

  if (isPro) {
    if (hasWhatsApp) {
      data.notification = "Você receberá atualizações por e-mail e WhatsApp.";
    } else {
      data.notification = "Você receberá atualizações por e-mail.";
    }
    data.professional = "A profissional acompanha sua solicitação em tempo real.";
    return data;
  }

  if (isEssencial) {
    data.notification = "Você receberá confirmação e atualizações por e-mail.";
    data.professional = "A profissional acompanha sua solicitação pela Nera.";
    return data;
  }

  // Free (default)
  return data;
};
