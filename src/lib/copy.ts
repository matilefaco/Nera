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
  if (!specialty) return "";
  const s = specialty.toLowerCase().trim();
  
  if (s === 'maquiadora') return "Especialista em maquiagem";
  if (s === 'nail designer') return "Especialista em unhas";
  if (s === 'designer de sobrancelhas') return "Especialista em sobrancelhas";
  if (s === 'manicure') return "Especialista em unhas";
  if (s === 'pedicure') return "Especialista em unhas";
  if (s === 'esteticista') return "Especialista em estética";
  if (s === 'cabeleireira') return "Especialista em cabelos";
  
  // If it's already "Especialista em...", return as is
  if (s.startsWith('especialista em')) return specialty;
  
  return `Especialista em ${specialty}`;
};

/**
 * Returns dynamic copywriting for the hero section based on the professional's specialty.
 */
export const getProfileHeroCopy = (specialty: string = "", id: string = "") => {
  const s = specialty.toLowerCase();
  
  if (s.includes('unha') || s.includes('manicure') || s.includes('pedicure') || s.includes('nail')) {
    return { main: "Transformando mãos em", accent: "arte" };
  }
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('olhar')) {
    return { main: "Design que valoriza o seu", accent: "olhar" };
  }
  if (s.includes('cílios') || s.includes('lash') || s.includes('extensão')) {
    return { main: "O segredo de um", accent: "olhar marcante" };
  }
  if (s.includes('cabelo') || s.includes('hair') || s.includes('penteado')) {
    return { main: "Expressando sua essência através dos", accent: "fios" };
  }
  if (s.includes('maquiagem') || s.includes('make') || s.includes('estética')) {
    return { main: "Sua beleza autêntica", accent: "realçada" };
  }
  
  return { main: "Especialista em", accent: specialty || "Beleza" };
};

/**
 * Generates clear copy for service locations/modes.
 */
export const getServiceLocationCopy = (profile: any) => {
  const { serviceMode, serviceAreaType, city, neighborhood, studioAddress, serviceAreas } = profile;
  const areaLabel = neighborhood || city || "";
  
  if (serviceMode === 'studio') {
    if (studioAddress?.privacyMode === 'public_full' && studioAddress?.street) {
      return `Estúdio em ${studioAddress.street}, ${studioAddress.number}`;
    }
    return `Atende em estúdio em ${areaLabel}`;
  }
  
  if (serviceMode === 'home') {
    if (serviceAreaType === 'city_wide') {
      return `Atende em domicílio em toda a cidade`;
    }
    if (serviceAreas && serviceAreas.length > 0) {
       return `Atende em domicílio nos bairros selecionados`;
    }
    return `Atende em domicílio em ${areaLabel}`;
  }
  
  if (serviceMode === 'hybrid') {
    const base = "Atende em estúdio e em domicílio";
    if (serviceAreaType === 'city_wide') {
      return `${base} em toda a cidade`;
    }
    if (serviceAreas && serviceAreas.length > 0) {
      return `${base} nos bairros selecionados`;
    }
    return `${base} em ${areaLabel}`;
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
